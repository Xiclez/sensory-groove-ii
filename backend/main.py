from fastapi import FastAPI, UploadFile, Form, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import engine, Base, get_db
from models import Transfer
import httpx
import base64
import shutil
import time
import os

# Asegurar que el directorio de subidas existe antes de montarlo
os.makedirs("uploads", exist_ok=True)

for _ in range(5):
    try:
        Base.metadata.create_all(bind=engine)
        break
    except Exception:
        time.sleep(3)

app = FastAPI(title="Sensory Groove Ticketing API")

# Montar la carpeta uploads para poder ver los comprobantes desde React
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000","https://sensory-groove2.fadexlabs.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WPP_API_URL = os.getenv("WPP_API_URL", "http://wppconnect:21465")
WPP_SECRET_KEY = os.getenv("WPP_SECRET_KEY", "sensory_secret_token_123")
SESSION_NAME = "sensory_bot"
ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "sensory2026")

# Extraer los dos números y meterlos en una lista
ADMIN_WA_NUMBER_1 = os.getenv("ADMIN_WA_NUMBER_1", "5216142550381")
ADMIN_WA_NUMBER_2 = os.getenv("ADMIN_WA_NUMBER_2", "5216142854941")
ADMIN_NUMBERS = [num for num in [ADMIN_WA_NUMBER_1, ADMIN_WA_NUMBER_2] if num]

SECRET_TOKEN = "fadex-labs-secure-token-2026"

class LoginData(BaseModel):
    username: str
    password: str

def verify_token(authorization: str = Header(None)):
    if not authorization or authorization != f"Bearer {SECRET_TOKEN}":
        raise HTTPException(status_code=401, detail="No autorizado")
    return True

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
            token_res = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/{WPP_SECRET_KEY}/generate-token")
            token = token_res.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            caption = f"🚨 *NUEVO COMPROBANTE RECIBIDO* 🚨\n\n👤 *Nombre:* {nombre}\n📱 *WhatsApp:* {whatsapp}\n🎟️ *Accesos:* {accesos}"
            
            payload = {
                "filename": comprobante.filename,
                "base64": base64_img,
                "caption": caption
            }

            # Enviar la imagen a todos los administradores configurados
            for admin_number in ADMIN_NUMBERS:
                payload["phone"] = admin_number
                await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/send-image", json=payload, headers=headers)
                
        except Exception as e:
            print(f"Error WPPConnect: {e}")

    return {"status": "success", "id": new_transfer.id}

@app.get("/api/admin/transfers")
def get_transfers(db: Session = Depends(get_db), authorized: bool = Depends(verify_token)):
    return db.query(Transfer).order_by(Transfer.status.desc()).all()

@app.post("/api/admin/resolve")
async def resolve_transfer(data: dict, db: Session = Depends(get_db), authorized: bool = Depends(verify_token)):
    transfer = db.query(Transfer).filter(Transfer.id == data["id"]).first()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    
    transfer.status = data["action"]
    db.commit()
    return {"status": "resolved"}

@app.get("/api/admin/whatsapp/start")
async def start_whatsapp(authorized: bool = Depends(verify_token)):
    async with httpx.AsyncClient(timeout=40.0) as client:
        try:
            token_res = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/{WPP_SECRET_KEY}/generate-token")
            token = token_res.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            payload = {"waitQrCode": True}
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
            token_res = await client.post(f"{WPP_API_URL}/api/{SESSION_NAME}/{WPP_SECRET_KEY}/generate-token")
            token = token_res.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            res = await client.get(f"{WPP_API_URL}/api/{SESSION_NAME}/status-session", headers=headers)
            return res.json()
        except Exception as e:
            return {"status": "DISCONNECTED", "message": "No hay conexión con WPPConnect"}
