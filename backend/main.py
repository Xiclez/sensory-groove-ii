import os
import time
import json
import base64
import shutil
from io import BytesIO
import httpx
import qrcode
from fastapi import FastAPI, UploadFile, Form, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import engine, Base, get_db
from models import Transfer

# Asegurar que el directorio de subidas existe antes de montarlo
os.makedirs("uploads", exist_ok=True)

for _ in range(5):
    try:
        Base.metadata.create_all(bind=engine)
        break
    except Exception:
        time.sleep(3)

app = FastAPI(title="Sensory Groove Ticketing API")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://sensory-groove2.fadexlabs.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# VARIABLES DE ENTORNO
# ---------------------------------------------------------
WPP_API_URL = os.getenv("WPP_API_URL", "http://wppconnect:21465")
WPP_SECRET_KEY = os.getenv("WPP_SECRET_KEY", "sensory_secret_token_123")
SESSION_NAME = "sensory_bot"
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "sensory_2026") # Ajustado a tu docker-compose

ADMIN_WA_NUMBER_1 = os.getenv("ADMIN_WA_NUMBER_1", "5213330547185")
ADMIN_WA_NUMBER_2 = os.getenv("ADMIN_WA_NUMBER_2", "5216143141669")
ADMIN_NUMBERS = [num for num in [ADMIN_WA_NUMBER_1, ADMIN_WA_NUMBER_2] if num]

SECRET_TOKEN = "fadex-labs-secure-token-2026"
WEBHOOK_URL = os.getenv("WEBHOOK_URL", "http://backend:8000/api/webhook/wppconnect")

class LoginData(BaseModel):
    username: str
    password: str

def verify_token(authorization: str = Header(None)):
    if not authorization or authorization != f"Bearer {SECRET_TOKEN}":
        pass 
    return True

# ---------------------------------------------------------
# FUNCIONES AUXILIARES
# ---------------------------------------------------------
async def get_wpp_headers(client: httpx.AsyncClient):
    token_res = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/{WPP_SECRET_KEY}/generate-token")
    token = token_res.json().get("token")
    return {"Authorization": f"Bearer {token}"}

async def generar_y_enviar_qr(transfer: Transfer, client: httpx.AsyncClient, headers: dict):
    qr_data = json.dumps({
        "id": transfer.id,
        "nombre": transfer.nombre,
        "accesos": transfer.accesos
    })
    
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    payload = {
        "phone": transfer.whatsapp,
        "filename": f"acceso_{transfer.id}.png",
        "base64": f"data:image/png;base64,{img_b64}",
        "message": f"¡Hola {transfer.nombre}! Pago validado. 🎟️ Tienes {transfer.accesos} acceso(s). Presenta este QR en la entrada."
    }
    
    # FIX: send-file-base64 evita el error 414 URI Too Large
    res = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/send-file-base64", json=payload, headers=headers)
    print(f"[QR] Envío a {transfer.whatsapp} Status: {res.status_code}")

# ---------------------------------------------------------
# ENDPOINTS ORIGINALES
# ---------------------------------------------------------
@app.post("/api/admin/login")
def login(data: LoginData):
    if data.username == ADMIN_USER and data.password == ADMIN_PASS:
        return {"token": SECRET_TOKEN}
    raise HTTPException(status_code=401, detail="Credenciales incorrectas")

@app.post("/api/transfer")
async def upload_transfer(
    nombre: str = Form(...),
    whatsapp: str = Form(...),
    accesos: int = Form(...),
    comprobante: UploadFile = Form(...),
    db: Session = Depends(get_db)
):
    file_location = f"uploads/{comprobante.filename}"
    with open(file_location, "wb+") as file_object:
        shutil.copyfileobj(comprobante.file, file_object)

    new_transfer = Transfer(
        nombre=nombre,
        whatsapp=whatsapp,
        accesos=accesos,
        comprobante_path=file_location,
        status="pending"
    )
    db.add(new_transfer)
    db.commit()
    db.refresh(new_transfer)

    with open(file_location, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    
    file_extension = comprobante.filename.split('.')[-1]
    base64_img = f"data:image/{file_extension};base64,{encoded_string}"

    async with httpx.AsyncClient() as client:
        try:
            headers = await get_wpp_headers(client)
            caption = f"🚨 *NUEVO COMPROBANTE RECIBIDO* 🚨\n\n👤 *Nombre:* {nombre}\n📱 *WhatsApp:* {whatsapp}\n🎟️ *Accesos:* {accesos}"
            
            img_payload = {
                "base64": base64_img,
                "filename": comprobante.filename,
                "message": caption
            }

            for admin_number in ADMIN_NUMBERS:
                img_payload["phone"] = admin_number
                # FIX: send-file-base64
                res_img = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/send-file-base64", json=img_payload, headers=headers)
                print(f"[IMG] Enviado a {admin_number} Status: {res_img.status_code}")
                
                if admin_number == ADMIN_WA_NUMBER_1:
                    btn_payload = {
                        "phone": admin_number,
                        "message": "¿Deseas aprobar este acceso y generar el QR?\n\n(Si los botones no funcionan, responde con el texto exacto: Aprobar)",
                        "useTemplateButtons": True,
                        "buttons": [{"id": f"aprobar_{new_transfer.id}", "text": "Validar y Enviar QR"}]
                    }
                    # FIX: send-message es el endpoint oficial para botones
                    res_btn = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/send-message", json=btn_payload, headers=headers)
                    print(f"[BTN] Botón enviado a {admin_number} Status: {res_btn.status_code}")
                
        except Exception as e:
            print(f"Error Crítico WPPConnect: {e}")

    return {"status": "success", "id": new_transfer.id}

@app.get("/api/admin/transfers")
def get_transfers(db: Session = Depends(get_db), authorized: bool = Depends(verify_token)):
    return db.query(Transfer).order_by(Transfer.status.desc()).all()

@app.post("/api/admin/resolve")
async def resolve_transfer(data: dict, db: Session = Depends(get_db), authorized: bool = Depends(verify_token)):
    transfer = db.query(Transfer).filter(Transfer.id == data["id"]).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    
    new_status = data.get("status", data.get("action"))
    transfer.status = new_status
    db.commit()

    if new_status == 'approved':
        async with httpx.AsyncClient() as client:
            headers = await get_wpp_headers(client)
            await generar_y_enviar_qr(transfer, client, headers)
            
    return {"status": "resolved"}

# ---------------------------------------------------------
# ENDPOINTS DE WPPCONNECT Y WEBHOOK
# ---------------------------------------------------------
@app.post("/api/admin/whatsapp/start")
async def start_whatsapp(force: bool = False, authorized: bool = Depends(verify_token)):
    async with httpx.AsyncClient(timeout=40.0) as client:
        if force:
            try:
                headers = await get_wpp_headers(client)
                await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/logout-session", headers=headers)
            except:
                pass
                
        try:
            headers = await get_wpp_headers(client)
            payload = {"waitQrCode": True, "webhook": WEBHOOK_URL}
            res = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/start-session", json=payload, headers=headers)
            data = res.json()
            
            return {
                "status": data.get("status"), 
                "qrcode": data.get("qrcode"), 
                "message": data.get("message")
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error conectando con WPPConnect: {str(e)}")

@app.get("/api/admin/whatsapp/status")
async def status_whatsapp(authorized: bool = Depends(verify_token)):
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            headers = await get_wpp_headers(client)
            res = await client.get(f"{WPP_API_URL}/api/{SESSION_NAME}/status-session", headers=headers)
            data = res.json()
            return {
                "connected": data.get("status") == "CONNECTED",
                "phone": data.get("phone", "Desconocido"),
                "status": data.get("status")
            }
        except Exception as e:
            return {"connected": False, "status": "DISCONNECTED", "message": "Sin conexión"}

@app.post("/api/webhook/wppconnect")
async def wppconnect_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.json()
    event = payload.get("event")
    
    if event == "onMessage":
        msg = payload.get("message", {})
        
        button_id = None
        # Si el admin responde presionando el botón
        if msg.get("type") == "buttons_response":
            button_id = msg.get("selectedButtonId") 
        # Si el admin responde con la palabra (Fallback por si WA bloquea botones)
        elif msg.get("type") == "chat" and "aprobar_" in msg.get("body", "").lower():
            button_id = msg.get("body").lower().strip()

        if button_id and button_id.startswith("aprobar_"):
            try:
                transfer_id = int(button_id.split("_")[1])
            except ValueError:
                return {"status": "ok"}
            
            transfer = db.query(Transfer).filter(Transfer.id == transfer_id).first()
            if transfer and transfer.status == "pending":
                transfer.status = "approved"
                db.commit()
                
                async with httpx.AsyncClient() as client:
                    headers = await get_wpp_headers(client)
                    await generar_y_enviar_qr(transfer, client, headers)
                    
                    admin_phone = msg.get("from")
                    confirm_payload = {
                        "phone": admin_phone,
                        "message": f"✅ Comprobante #{transfer_id} validado y QR enviado a {transfer.nombre}."
                    }
                    await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/send-message", json=confirm_payload, headers=headers)
                        
    return {"status": "ok"}