import os
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import qrcode
import base64
from io import BytesIO

app = FastAPI()

# Configuración de CORS estricta
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://sensory-groove2.fadexlabs.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# VARIABLES DE ENTORNO (Desde tu docker-compose)
# ---------------------------------------------------------
# Usamos os.getenv para jalar las variables de Docker. 
# Si no las encuentra, usa los valores por defecto.
WPP_URL = os.getenv("WPP_URL", "http://wppconnect:21465/api/sensory_session")
WPP_SECRET = os.getenv("WPP_SECRET", "tu_clave_secreta") 
ADMIN_WA_NUMBER = os.getenv("ADMIN_WA_NUMBER", "521XXXXXXXXXX") 

# Modelos Pydantic
class ResolveTransferRequest(BaseModel):
    id: int
    status: str


# =========================================================
# TUS ENDPOINTS ORIGINALES DE BASE DE DATOS (Mantenlos aquí)
# =========================================================
# Aquí van tus rutas anteriores como:
# @app.post("/api/transfer")
# @app.get("/api/admin/transfers")
# ... etc.

# =========================================================
# FUNCIONES AUXILIARES DE WHATSAPP Y QR
# =========================================================
async def generar_y_enviar_qr(transfer_id: int, user_phone: str, user_name: str, accesos: int):
    """Genera un QR en formato JSON con los datos completos y lo manda por WA"""
    
    # Datos completos para el escáner
    qr_data = json.dumps({
        "id": transfer_id,
        "nombre": user_name,
        "accesos": accesos
    })
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    payload = {
        "phone": user_phone,
        "filename": f"acceso_sg_{transfer_id}.png",
        "base64": f"data:image/png;base64,{img_b64}",
        "caption": f"¡Hola {user_name}! Pago validado exitosamente. 🎟️ Tienes {accesos} acceso(s). Presenta este QR en la entrada."
    }
    
    async with httpx.AsyncClient() as client:
        try:
            await client.post(
                f"{WPP_URL}/sendImage", 
                json=payload, 
                headers={"Authorization": f"Bearer {WPP_SECRET}"}
            )
        except Exception as e:
            print(f"Error enviando QR: {e}")

async def notificar_admin_comprobante(transfer_id: int, user_phone: str, comprobante_url: str):
    """Manda un mensaje interactivo al Admin con el botón de Aprobar"""
    payload = {
        "phone": ADMIN_WA_NUMBER,
        "message": f"Nuevo comprobante de pago recibido.\nCliente: {user_phone}\nVer comprobante: {comprobante_url}",
        "title": "Validación de Acceso",
        "footer": "Sensory Groove System",
        "buttons": [
            {"id": f"aprobar_{transfer_id}", "text": "Validar y Enviar QR"}
        ]
    }
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{WPP_URL}/sendButtons",
            json=payload,
            headers={"Authorization": f"Bearer {WPP_SECRET}"}
        )

# =========================================================
# ENDPOINTS DE ADMINISTRACIÓN Y WHATSAPP
# =========================================================
@app.post("/api/admin/resolve")
async def resolve_transfer(req: ResolveTransferRequest):
    # 1. TODO: Lógica de DB para actualizar status a 'approved'
    
    if req.status == 'approved':
        # 2. TODO: Obtener datos reales del usuario desde la BD usando req.id
        user_phone = "5210000000000" 
        user_name = "Usuario Evento"
        cantidad_accesos = 2
        
        # 3. Disparar generación y envío de QR
        await generar_y_enviar_qr(req.id, user_phone, user_name, cantidad_accesos)
        
    return {"status": "success", "message": "Transferencia resuelta y QR enviado."}

@app.get("/api/admin/whatsapp/status")
async def get_whatsapp_status():
    """Consulta a WPPConnect si la sesión está conectada"""
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(
                f"{WPP_URL}/check-connection-session",
                headers={"Authorization": f"Bearer {WPP_SECRET}"}
            )
            data = res.json()
            if data.get("status") == True:
                return {"connected": True, "phone": "Conectado a Sesión", "lastSeen": "Reciente"}
            return {"connected": False}
        except:
            return {"connected": False}

@app.post("/api/admin/whatsapp/start")
async def start_whatsapp_session(force: bool = False):
    """Maneja la desconexión forzada y genera una nueva sesión"""
    async with httpx.AsyncClient() as client:
        if force:
            try:
                await client.post(
                    f"{WPP_URL}/logout-session",
                    headers={"Authorization": f"Bearer {WPP_SECRET}"}
                )
            except:
                pass 
                
        try:
            await client.post(
                f"{WPP_URL}/start-session",
                headers={"Authorization": f"Bearer {WPP_SECRET}"},
                json={"webhook": "http://backend:8000/api/webhook/wppconnect"}
            )
            return {"status": "success", "message": "Sesión iniciada/reiniciada."}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# WEBHOOK DE WPPCONNECT (ESCUCHA DE EVENTOS Y BOTONES)
# =========================================================
@app.post("/api/webhook/wppconnect")
async def wppconnect_webhook(request: Request):
    payload = await request.json()
    event = payload.get("event")
    
    if event == "onMessage":
        msg = payload.get("message", {})
        
        if msg.get("type") == "buttons_response":
            button_id = msg.get("selectedButtonId") 
            
            if button_id and button_id.startswith("aprobar_"):
                transfer_id = int(button_id.split("_")[1])
                
                # 1. TODO: Lógica de DB para verificar que no esté aprobado ya y cambiar status
                # 2. TODO: Sacar datos del usuario de la DB
                user_phone = "5210000000000"
                user_name = "Usuario BD"
                accesos = 2
                
                # 3. Enviar el QR al usuario
                await generar_y_enviar_qr(transfer_id, user_phone, user_name, accesos)
                
                # 4. Confirmarle al Admin en el mismo chat
                admin_phone = msg.get("from")
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"{WPP_URL}/sendText",
                        json={"phone": admin_phone, "text": f"✅ Comprobante #{transfer_id} validado. QR enviado al cliente."},
                        headers={"Authorization": f"Bearer {WPP_SECRET}"}
                    )
                    
    return {"status": "ok"}