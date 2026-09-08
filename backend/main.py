"""API de accesos de Sensory Groove (Fadex Labs).

Ciclo de vida de un acceso:
    1. El comprador sube su comprobante        -> POST /api/transfer   (status=pending)
    2. Un admin lo revisa y lo resuelve        -> POST /api/admin/resolve
    3. En la puerta se escanea el QR generado  -> POST /api/scan

NOTA: la integracion con WhatsApp (WPPConnect / Evolution API) queda fuera de
esta version por decision de producto. El envio del QR se simula con print()
en `_mock_enviar_whatsapp`; ahi es donde se debe enchufar el proveedor real.
"""

import os
import re
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import qrcode
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    Header,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import (
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    Transfer,
)

# --- Configuracion -----------------------------------------------------------

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
QR_DIR = UPLOAD_DIR / "qr"

# Token que protege /api/admin/*. En produccion SIEMPRE debe venir del entorno.
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")
DEV_ADMIN_TOKEN = "sensory-admin-dev"

# Origenes permitidos para el navegador. Por defecto solo desarrollo local.
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",")
    if o.strip()
]

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "8")) * 1024 * 1024
ALLOWED_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "application/pdf": ".pdf",
}

QR_PREFIX = "SG-2026-"
WHATSAPP_RE = re.compile(r"^\d{10,13}$")
MAX_ACCESOS = int(os.getenv("MAX_ACCESOS", "20"))

@asynccontextmanager
async def lifespan(_: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    QR_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    if not ADMIN_TOKEN:
        print(
            "[auth] AVISO: ADMIN_TOKEN no configurado, usando token de "
            f"desarrollo '{DEV_ADMIN_TOKEN}'. Define ADMIN_TOKEN antes de "
            "exponer esta API a internet.",
            flush=True,
        )
    yield


app = FastAPI(title="Sensory Groove API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --- Autenticacion de admin --------------------------------------------------


def require_admin(x_admin_token: str = Header(default="")) -> None:
    expected = ADMIN_TOKEN or DEV_ADMIN_TOKEN
    if x_admin_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de administrador invalido",
        )


# --- Esquemas ----------------------------------------------------------------


class ResolveRequest(BaseModel):
    id: uuid.UUID
    action: str

    @field_validator("action")
    @classmethod
    def normalize_action(cls, v: str) -> str:
        # Aceptamos tanto "approve"/"reject" como "approved"/"rejected".
        mapping = {
            "approve": STATUS_APPROVED,
            "approved": STATUS_APPROVED,
            "reject": STATUS_REJECTED,
            "rejected": STATUS_REJECTED,
        }
        key = v.strip().lower()
        if key not in mapping:
            raise ValueError("action debe ser 'approve' o 'reject'")
        return mapping[key]


class ScanRequest(BaseModel):
    code: str = Field(min_length=1, max_length=128)


# --- Helpers -----------------------------------------------------------------


def _qr_payload(transfer_id: uuid.UUID) -> str:
    return f"{QR_PREFIX}{transfer_id}"


def _parse_scan_code(code: str) -> uuid.UUID | None:
    """Extrae el UUID de un codigo escaneado.

    Acepta el formato completo ("SG-2026-<uuid>") y el UUID pelado, porque
    algunos lectores de QR recortan prefijos.
    """
    raw = code.strip()
    if raw.upper().startswith(QR_PREFIX):
        raw = raw[len(QR_PREFIX) :]
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


def _generate_qr(transfer: Transfer) -> Path:
    """Genera y persiste el PNG del QR del acceso."""
    qr_path = QR_DIR / f"{transfer.id}.png"
    qrcode.make(_qr_payload(transfer.id)).save(qr_path)
    return qr_path


def _mock_enviar_whatsapp(transfer: Transfer, qr_path: Path | None) -> None:
    """Simula el envio del acceso por WhatsApp.

    Punto de extension: aqui se sustituiria el print por la llamada real al
    proveedor de mensajeria.
    """
    if transfer.status == STATUS_APPROVED:
        print(
            "[whatsapp:mock] ENVIO SIMULADO\n"
            f"  destino  : +{transfer.whatsapp}\n"
            f"  mensaje  : ¡Acceso confirmado para {transfer.nombre}! "
            f"Cantidad: {transfer.accesos} accesos. "
            "Presenta este QR en la entrada.\n"
            f"  qr_data  : {_qr_payload(transfer.id)}\n"
            f"  qr_file  : {qr_path}",
            flush=True,
        )
    else:
        print(
            "[whatsapp:mock] ENVIO SIMULADO\n"
            f"  destino  : +{transfer.whatsapp}\n"
            "  mensaje  : Lo sentimos, su comprobante no pudo ser validado. "
            "Por favor, intente de nuevo.",
            flush=True,
        )


def _get_transfer_or_404(db: Session, transfer_id: uuid.UUID) -> Transfer:
    transfer = db.get(Transfer, transfer_id)
    if transfer is None:
        raise HTTPException(status_code=404, detail="Transferencia no encontrada")
    return transfer


async def _save_comprobante(upload: UploadFile) -> str:
    """Guarda el comprobante con un nombre generado por el servidor.

    Nunca usamos `upload.filename` para construir la ruta: llega del cliente y
    permitiria sobrescribir archivos o escapar del directorio (path traversal).
    """
    extension = ALLOWED_MIME.get((upload.content_type or "").lower())
    if extension is None:
        raise HTTPException(
            status_code=415,
            detail="Formato no soportado. Sube una imagen (JPG, PNG, WEBP) o PDF.",
        )

    destination = UPLOAD_DIR / f"{uuid.uuid4()}{extension}"
    written = 0
    try:
        with destination.open("wb") as handle:
            while chunk := await upload.read(1024 * 1024):
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "El comprobante excede "
                            f"{MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
                        ),
                    )
                handle.write(chunk)
    except HTTPException:
        destination.unlink(missing_ok=True)
        raise

    if written == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="El comprobante esta vacio")

    return str(destination)


# --- Endpoints publicos ------------------------------------------------------


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/transfer", status_code=201)
async def upload_transfer(
    nombre: str = Form(..., min_length=2, max_length=120),
    whatsapp: str = Form(...),
    accesos: int = Form(..., ge=1, le=MAX_ACCESOS),
    comprobante: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """Registra un comprobante de pago y deja el acceso en revision."""
    digits = re.sub(r"\D", "", whatsapp)
    if not WHATSAPP_RE.match(digits):
        raise HTTPException(
            status_code=422,
            detail="El WhatsApp debe tener entre 10 y 13 digitos",
        )

    comprobante_path = await _save_comprobante(comprobante)

    transfer = Transfer(
        nombre=nombre.strip(),
        whatsapp=digits,
        accesos=accesos,
        status=STATUS_PENDING,
        comprobante_path=comprobante_path,
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)

    return {"status": "success", "id": str(transfer.id)}


@app.post("/api/scan")
def scan_qr(payload: ScanRequest, db: Session = Depends(get_db)) -> dict:
    """Valida en la puerta si un QR corresponde a un acceso aprobado."""
    transfer_id = _parse_scan_code(payload.code)
    if transfer_id is None:
        return {"status": "error", "message": "QR Invalido"}

    transfer = db.get(Transfer, transfer_id)
    if transfer is None or transfer.status != STATUS_APPROVED:
        return {"status": "error", "message": "Acceso no válido o no aprobado"}

    if transfer.checked_in_at is not None:
        # No bloqueamos la entrada, pero avisamos que ya se habia escaneado.
        return {
            "status": "warning",
            "message": (
                f"Acceso ya escaneado: {transfer.nombre} "
                f"({transfer.accesos} accesos)"
            ),
            "checked_in_at": transfer.checked_in_at.astimezone(
                timezone.utc
            ).isoformat(),
        }

    transfer.checked_in_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "status": "success",
        "message": f"Acceso Válido: {transfer.nombre} ({transfer.accesos} accesos)",
    }


# --- Endpoints de administracion ---------------------------------------------


@app.get("/api/admin/transfers", dependencies=[Depends(require_admin)])
def get_transfers(db: Session = Depends(get_db)) -> list[dict]:
    """Lista las transferencias en espera de validacion (mas antigua primero)."""
    transfers = db.scalars(
        select(Transfer)
        .where(Transfer.status == STATUS_PENDING)
        .order_by(Transfer.created_at)
    ).all()
    return [t.as_dict() for t in transfers]


@app.post("/api/admin/resolve", dependencies=[Depends(require_admin)])
def resolve_transfer(
    payload: ResolveRequest, db: Session = Depends(get_db)
) -> dict:
    """Aprueba o rechaza una transferencia y dispara el envio (simulado)."""
    transfer = _get_transfer_or_404(db, payload.id)

    if transfer.status != STATUS_PENDING:
        raise HTTPException(
            status_code=409,
            detail=f"La transferencia ya fue resuelta como '{transfer.status}'",
        )

    transfer.status = payload.action
    db.commit()
    db.refresh(transfer)

    qr_path = _generate_qr(transfer) if transfer.status == STATUS_APPROVED else None
    _mock_enviar_whatsapp(transfer, qr_path)

    return {
        "status": "resolved",
        "id": str(transfer.id),
        "new_status": transfer.status,
        "qr_data": _qr_payload(transfer.id)
        if transfer.status == STATUS_APPROVED
        else None,
    }


@app.get(
    "/api/admin/transfers/{transfer_id}/comprobante",
    dependencies=[Depends(require_admin)],
)
def get_comprobante(transfer_id: uuid.UUID, db: Session = Depends(get_db)):
    """Devuelve el comprobante subido para que el admin pueda revisarlo."""
    transfer = _get_transfer_or_404(db, transfer_id)
    path = Path(transfer.comprobante_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return FileResponse(path)


@app.get(
    "/api/admin/transfers/{transfer_id}/qr",
    dependencies=[Depends(require_admin)],
)
def get_qr(transfer_id: uuid.UUID, db: Session = Depends(get_db)):
    """Devuelve el PNG del QR de un acceso aprobado."""
    transfer = _get_transfer_or_404(db, transfer_id)
    if transfer.status != STATUS_APPROVED:
        raise HTTPException(
            status_code=409, detail="La transferencia no esta aprobada"
        )
    qr_path = QR_DIR / f"{transfer.id}.png"
    if not qr_path.is_file():
        qr_path = _generate_qr(transfer)
    return FileResponse(qr_path, media_type="image/png")
