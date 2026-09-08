import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from database import Base

# Estados validos de una transferencia.
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"


class Transfer(Base):
    __tablename__ = "transfers"

    # Uuid se mapea al tipo UUID nativo en Postgres y degrada a CHAR(32) en
    # SQLite, lo que permite correr las pruebas sin levantar la base completa.
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(120), index=True)
    whatsapp: Mapped[str] = mapped_column(String(20))
    accesos: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(
        String(16), default=STATUS_PENDING, index=True
    )
    comprobante_path: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Momento en que el QR fue escaneado en la puerta (None = sin usar).
    checked_in_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def as_dict(self) -> dict:
        return {
            "id": str(self.id),
            "nombre": self.nombre,
            "whatsapp": self.whatsapp,
            "accesos": self.accesos,
            "status": self.status,
            "comprobante_path": self.comprobante_path,
            "created_at": (
                self.created_at.astimezone(timezone.utc).isoformat()
                if self.created_at
                else None
            ),
            "checked_in_at": (
                self.checked_in_at.astimezone(timezone.utc).isoformat()
                if self.checked_in_at
                else None
            ),
        }
