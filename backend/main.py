import base64
import hashlib
import hmac
import json
import os
import re
import uuid

import httpx
from fastapi import Depends, FastAPI, Form, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import String, cast
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import STATUS_APPROVED, STATUS_PENDING, Transfer
from ticket import build_ticket_png

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

init_db()

app = FastAPI(title="Sensory Groove Ticketing API")

app.mount(f"/{UPLOAD_DIR}", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---------------------------------------------------------
# VARIABLES DE ENTORNO
# ---------------------------------------------------------
WPP_API_URL = os.getenv("WPP_API_URL", "http://wppconnect:21465")
WPP_SECRET_KEY = os.getenv("WPP_SECRET_KEY", "sensory_secret_token_123")
SESSION_NAME = os.getenv("WPP_SESSION_NAME", "sensory_bot")

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "sensory_2026")

ADMIN_WA_NUMBER_1 = os.getenv("ADMIN_WA_NUMBER_1", "5213330547185")
ADMIN_WA_NUMBER_2 = os.getenv("ADMIN_WA_NUMBER_2", "5216143141669")
ADMIN_NUMBERS = [n for n in (ADMIN_WA_NUMBER_1, ADMIN_WA_NUMBER_2) if n]

SECRET_TOKEN = os.getenv("ADMIN_TOKEN", "fadex-labs-secure-token-2026")

# Prefijo de pais para los telefonos de 10 digitos que captura el formulario.
WA_COUNTRY_CODE = os.getenv("WA_COUNTRY_CODE", "52")

# URL publica del backend: se incrusta en el enlace de aprobacion que recibe el
# admin por WhatsApp, por lo que NO puede ser un host interno de Docker.
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "http://localhost:8000").rstrip("/")

# Logo que encabeza el ticket con QR. Mismo archivo que usa el frontend
# (frontend/src/data/lineup.js -> logo).
EVENT_LOGO_URL = os.getenv(
    "EVENT_LOGO_URL",
    "https://res.cloudinary.com/dn4m0kr7j/image/upload/v1787165847/SesnoryGrooveII.jpg",
)

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,"
    "http://127.0.0.1:5173,https://sensory-groove2.fadexlabs.com",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Timeout generoso: subir un comprobante en base64 supera el default de 5s de
# httpx y provoca fallos silenciosos por ReadTimeout.
WPP_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


class LoginData(BaseModel):
    username: str
    password: str


def verify_token(authorization: str = Header(None)):
    # NOTA: la validacion sigue desactivada como en la version previa porque el
    # dashboard todavia no envia la cabecera. Ver aviso en el README.
    return True


# ---------------------------------------------------------
# HELPERS DE IDENTIFICACION
# ---------------------------------------------------------
def short_code(transfer_id: uuid.UUID) -> str:
    """Codigo corto tecleable por el admin (primeros 8 hex del UUID)."""
    return transfer_id.hex[:8]


def approval_signature(transfer_id: uuid.UUID) -> str:
    """Firma HMAC para que el enlace de aprobacion no sea adivinable."""
    return hmac.new(
        SECRET_TOKEN.encode(), str(transfer_id).encode(), hashlib.sha256
    ).hexdigest()[:20]


def approval_link(transfer_id: uuid.UUID) -> str:
    return f"{PUBLIC_API_URL}/api/aprobar/{transfer_id}?t={approval_signature(transfer_id)}"


def find_transfer(db: Session, raw_id: str) -> Transfer | None:
    """Resuelve una transferencia por UUID completo o por codigo corto."""
    raw_id = (raw_id or "").strip().lower()
    try:
        return db.query(Transfer).filter(Transfer.id == uuid.UUID(raw_id)).first()
    except (ValueError, AttributeError):
        pass

    # Codigo corto: el UUID se guarda con guiones en Postgres y sin ellos en
    # SQLite, pero los primeros 8 hex son iguales en ambos casos.
    if re.fullmatch(r"[0-9a-f]{6,8}", raw_id):
        return (
            db.query(Transfer)
            .filter(cast(Transfer.id, String).ilike(f"{raw_id}%"))
            .first()
        )
    return None


def only_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


# ---------------------------------------------------------
# CLIENTE WPPCONNECT
# ---------------------------------------------------------
async def get_wpp_headers(client: httpx.AsyncClient) -> dict:
    url = f"{WPP_API_URL}/api/{SESSION_NAME}/{WPP_SECRET_KEY}/generate-token"
    res = await client.post(url)
    if res.status_code >= 400:
        raise RuntimeError(f"generate-token fallo {res.status_code}: {res.text[:300]}")
    token = res.json().get("token")
    if not token:
        raise RuntimeError(f"generate-token sin token: {res.text[:300]}")
    return {"Authorization": f"Bearer {token}"}


async def wpp_post(client: httpx.AsyncClient, path: str, payload: dict, headers: dict, tag: str):
    """POST a WPPConnect con log del cuerpo real; nada de fallos silenciosos."""
    url = f"{WPP_API_URL}/api/{SESSION_NAME}/{path}"
    res = await client.post(url, json=payload, headers=headers)
    body = res.text[:400].replace("\n", " ")
    print(f"[WPP:{tag}] {path} -> {res.status_code} {body}", flush=True)
    if res.status_code >= 400:
        raise RuntimeError(f"{path} respondio {res.status_code}: {body}")
    return res


async def resolve_wa_phone(client: httpx.AsyncClient, headers: dict, raw_phone: str) -> str:
    """Convierte los 10 digitos del formulario en el numero que WhatsApp acepta.

    Mexico tiene cuentas registradas con y sin el "1" tras el 52, asi que se
    pregunta a WhatsApp cual de las dos variantes existe en lugar de adivinar.
    """
    digits = only_digits(raw_phone)
    if len(digits) > 10:  # ya trae lada internacional
        return digits

    candidates = [f"{WA_COUNTRY_CODE}1{digits}", f"{WA_COUNTRY_CODE}{digits}"]
    for candidate in candidates:
        try:
            res = await client.get(
                f"{WPP_API_URL}/api/{SESSION_NAME}/check-number-status/{candidate}",
                headers=headers,
            )
            data = res.json().get("response") or {}
            exists = data.get("numberExists", data.get("canReceiveMessage"))
            print(f"[WA:check] {candidate} -> exists={exists}", flush=True)
            if exists:
                # WhatsApp devuelve el JID real; se prefiere ese numero.
                jid = (data.get("id") or {}).get("user")
                return only_digits(jid) if jid else candidate
        except Exception as exc:
            print(f"[WA:check] {candidate} error: {exc}", flush=True)

    fallback = candidates[0]
    print(f"[WA:check] sin confirmacion, se usa {fallback}", flush=True)
    return fallback


# ---------------------------------------------------------
# GENERACION Y ENVIO DEL QR
# ---------------------------------------------------------
# Cache en memoria: el logo no cambia y se reusa en cada ticket.
_logo_cache: bytes | None = None


async def get_event_logo(client: httpx.AsyncClient) -> bytes | None:
    """Descarga el logo una sola vez; si falla, el ticket se arma sin banda."""
    global _logo_cache
    if _logo_cache is not None:
        return _logo_cache or None

    try:
        res = await client.get(EVENT_LOGO_URL)
        res.raise_for_status()
        _logo_cache = res.content
    except Exception as exc:
        print(f"[TICKET] logo no disponible ({exc}); se usa el titulo en texto", flush=True)
        _logo_cache = b""  # no se vuelve a intentar en cada aprobacion
    return _logo_cache or None


def qr_payload(transfer: Transfer) -> str:
    return json.dumps(
        {
            # str() obligatorio: transfer.id es uuid.UUID y json.dumps revienta.
            "id": str(transfer.id),
            "nombre": transfer.nombre,
            "accesos": transfer.accesos,
        },
        ensure_ascii=False,
    )


async def generar_y_enviar_qr(transfer: Transfer, client: httpx.AsyncClient, headers: dict):
    ticket_png = build_ticket_png(
        nombre=transfer.nombre,
        accesos=transfer.accesos,
        folio=short_code(transfer.id),
        payload=qr_payload(transfer),
        logo_bytes=await get_event_logo(client),
    )
    img_b64 = base64.b64encode(ticket_png).decode()
    phone = await resolve_wa_phone(client, headers, transfer.whatsapp)

    payload = {
        "phone": phone,
        "filename": f"acceso_{short_code(transfer.id)}.png",
        "base64": f"data:image/png;base64,{img_b64}",
        # sendFile usa `message || caption`; se mandan ambos por compatibilidad.
        "message": (
            f"¡Hola {transfer.nombre}! Tu pago fue validado. 🎟️\n"
            f"Accesos: {transfer.accesos}\n"
            f"Folio: {short_code(transfer.id)}\n\n"
            "Presenta este QR en la entrada."
        ),
    }
    payload["caption"] = payload["message"]

    # send-file-base64 va en el cuerpo y evita el 414 URI Too Large de send-image.
    await wpp_post(client, "send-file-base64", payload, headers, "QR")
    print(f"[QR] enviado a {phone} (transfer {transfer.id})", flush=True)


async def aprobar_transfer(transfer: Transfer, db: Session) -> None:
    """Marca la transferencia como aprobada y manda el QR.

    Si el envio falla se revierte el estado para que la aprobacion se pueda
    reintentar en lugar de quedar en 'approved' sin QR entregado.
    """
    transfer.status = STATUS_APPROVED
    db.commit()
    db.refresh(transfer)

    try:
        async with httpx.AsyncClient(timeout=WPP_TIMEOUT) as client:
            headers = await get_wpp_headers(client)
            await generar_y_enviar_qr(transfer, client, headers)
    except Exception:
        transfer.status = STATUS_PENDING
        db.commit()
        raise


# ---------------------------------------------------------
# ENDPOINTS PUBLICOS
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
    db: Session = Depends(get_db),
):
    new_transfer = Transfer(
        nombre=nombre,
        whatsapp=only_digits(whatsapp),
        accesos=accesos,
        comprobante_path="",
        status=STATUS_PENDING,
    )
    db.add(new_transfer)
    db.flush()  # asigna el UUID sin cerrar la transaccion

    # El nombre lo pone el servidor: el del cliente puede colisionar o traer
    # rutas relativas ("../").
    extension = os.path.splitext(comprobante.filename or "")[1].lower()
    if extension not in {".jpg", ".jpeg", ".png", ".pdf"}:
        extension = ".bin"
    file_location = f"{UPLOAD_DIR}/{new_transfer.id}{extension}"

    contenido = await comprobante.read()
    with open(file_location, "wb") as destino:
        destino.write(contenido)

    new_transfer.comprobante_path = file_location
    db.commit()
    db.refresh(new_transfer)

    mime = "application/pdf" if extension == ".pdf" else f"image/{extension.lstrip('.')}"
    archivo_b64 = f"data:{mime};base64,{base64.b64encode(contenido).decode()}"

    codigo = short_code(new_transfer.id)
    datos = (
        "🚨 *NUEVO COMPROBANTE* 🚨\n\n"
        f"👤 *Nombre:* {nombre}\n"
        f"📱 *WhatsApp:* {whatsapp}\n"
        f"🎟️ *Accesos:* {accesos}\n"
        f"🔖 *Folio:* {codigo}"
    )
    # El enlace firmado va en el mismo caption del comprobante: WhatsApp lo
    # vuelve tocable y el admin ya no recibe un segundo mensaje.
    caption_admin = (
        f"{datos}\n\n"
        "👉 *Validar y Enviar QR* (un toque):\n"
        f"{approval_link(new_transfer.id)}"
    )

    async with httpx.AsyncClient(timeout=WPP_TIMEOUT) as client:
        try:
            headers = await get_wpp_headers(client)

            for admin_number in ADMIN_NUMBERS:
                # Solo el admin principal recibe el enlace de validacion; el
                # resto ve el comprobante en modo informativo.
                mensaje = caption_admin if admin_number == ADMIN_WA_NUMBER_1 else datos
                await wpp_post(
                    client,
                    "send-file-base64",
                    {
                        "phone": admin_number,
                        "filename": f"comprobante_{codigo}{extension}",
                        "base64": archivo_b64,
                        "message": mensaje,
                        "caption": mensaje,
                    },
                    headers,
                    "COMPROBANTE",
                )
        except Exception as exc:
            # La transferencia ya esta guardada; el admin puede validar desde el
            # dashboard aunque WhatsApp este caido.
            print(f"[ERROR] notificacion WhatsApp fallida: {exc}", flush=True)

    return {"status": "success", "id": str(new_transfer.id), "folio": codigo}


# ---------------------------------------------------------
# ENDPOINTS DE ADMIN
# ---------------------------------------------------------
@app.get("/api/admin/transfers")
def get_transfers(db: Session = Depends(get_db), authorized: bool = Depends(verify_token)):
    transfers = (
        db.query(Transfer)
        .order_by(Transfer.status.desc(), Transfer.created_at.desc())
        .all()
    )
    # as_dict(): FastAPI no puede serializar objetos ORM directamente.
    return [
        {**t.as_dict(), "folio": short_code(t.id)} for t in transfers
    ]


@app.post("/api/admin/resolve")
async def resolve_transfer(
    data: dict, db: Session = Depends(get_db), authorized: bool = Depends(verify_token)
):
    transfer = find_transfer(db, str(data.get("id", "")))
    if not transfer:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")

    new_status = data.get("status") or data.get("action")
    if new_status not in {STATUS_APPROVED, "rejected"}:
        raise HTTPException(status_code=400, detail=f"Estado invalido: {new_status}")

    if new_status != STATUS_APPROVED:
        transfer.status = new_status
        db.commit()
        return {"status": "resolved", "id": str(transfer.id)}

    if transfer.status == STATUS_APPROVED:
        return {"status": "already_approved", "id": str(transfer.id)}

    try:
        await aprobar_transfer(transfer, db)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"No se pudo enviar el QR: {exc}")

    return {"status": "resolved", "id": str(transfer.id)}


@app.get("/api/aprobar/{transfer_id}", response_class=HTMLResponse)
async def aprobar_por_enlace(transfer_id: str, t: str = "", db: Session = Depends(get_db)):
    """Aprobacion de un toque desde el enlace que recibe el admin en WhatsApp."""

    def pagina(titulo: str, detalle: str, color: str) -> HTMLResponse:
        return HTMLResponse(
            "<!doctype html><meta charset='utf-8'>"
            "<meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<body style='background:#0b0b12;color:#fff;font-family:system-ui;"
            "display:flex;align-items:center;justify-content:center;height:100vh;margin:0'>"
            f"<div style='text-align:center;padding:24px;border-left:4px solid {color};"
            "background:#15151f;border-radius:12px;max-width:420px'>"
            f"<h2 style='margin:0 0 8px'>{titulo}</h2>"
            f"<p style='margin:0;color:#b9b9c9'>{detalle}</p></div></body>"
        )

    transfer = find_transfer(db, transfer_id)
    if not transfer:
        return pagina("Folio no encontrado", "El comprobante ya no existe.", "#f87171")

    if not hmac.compare_digest(t, approval_signature(transfer.id)):
        return pagina("Enlace invalido", "La firma no coincide.", "#f87171")

    if transfer.status == STATUS_APPROVED:
        return pagina(
            "Ya estaba validado",
            f"{transfer.nombre} ya recibio su QR.",
            "#fbbf24",
        )

    try:
        await aprobar_transfer(transfer, db)
    except Exception as exc:
        return pagina("Error al enviar el QR", str(exc), "#f87171")

    return pagina(
        "✅ Validado",
        f"QR enviado a {transfer.nombre} ({transfer.accesos} acceso/s).",
        "#34d399",
    )


# ---------------------------------------------------------
# SESION DE WPPCONNECT
# ---------------------------------------------------------
@app.post("/api/admin/whatsapp/start")
async def start_whatsapp(force: bool = False, authorized: bool = Depends(verify_token)):
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
        try:
            headers = await get_wpp_headers(client)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc))

        if force:
            try:
                await client.post(
                    f"{WPP_API_URL}/api/{SESSION_NAME}/logout-session", headers=headers
                )
            except Exception as exc:
                print(f"[WPP] logout-session ignorado: {exc}", flush=True)

        try:
            res = await client.post(
                f"{WPP_API_URL}/api/{SESSION_NAME}/start-session",
                json={"waitQrCode": True},
                headers=headers,
            )
            data = res.json()
            return {
                "status": data.get("status"),
                "qrcode": data.get("qrcode"),
                "message": data.get("message"),
            }
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Error con WPPConnect: {exc}")


@app.get("/api/admin/whatsapp/status")
async def status_whatsapp(authorized: bool = Depends(verify_token)):
    async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
        try:
            headers = await get_wpp_headers(client)
            res = await client.get(
                f"{WPP_API_URL}/api/{SESSION_NAME}/status-session", headers=headers
            )
            data = res.json()
            return {
                "connected": data.get("status") == "CONNECTED",
                "phone": data.get("phone") or "Desconocido",
                "status": data.get("status"),
                "webhook": f"{PUBLIC_API_URL}/api/webhook/wppconnect",
            }
        except Exception as exc:
            return {"connected": False, "status": "DISCONNECTED", "message": str(exc)}


# ---------------------------------------------------------
# WEBHOOK (solo log)
# ---------------------------------------------------------
@app.post("/api/webhook/wppconnect")
async def wppconnect_webhook(request: Request):
    """Solo observabilidad de la sesion de WhatsApp.

    La validacion es exclusivamente por el enlace firmado del caption: ya no se
    aprueba con mensajes de texto tipo "validar <folio>", asi que un mensaje
    entrante nunca dispara el envio del QR.
    """
    payload = await request.json()

    # Log acotado: el payload completo trae la media en base64.
    print(
        f"[WEBHOOK] event={str(payload.get('event', '')).lower()} "
        f"from={payload.get('from')} type={payload.get('type')} "
        f"body={str(payload.get('body'))[:80]!r}",
        flush=True,
    )
    return {"status": "ignored"}
