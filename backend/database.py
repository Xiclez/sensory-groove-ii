import os
import time

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg2://user:password@db:5432/sensorygroove"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(retries: int = 15, delay: float = 2.0) -> None:
    """Crea las tablas, esperando a que Postgres acepte conexiones.

    El contenedor de la API arranca casi siempre antes de que Postgres termine
    de inicializar, por lo que un create_all directo revienta el proceso.
    """
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            print(f"[db] esquema listo (intento {attempt})", flush=True)
            return
        except OperationalError as exc:  # base de datos aun no disponible
            last_error = exc
            print(
                f"[db] esperando a Postgres ({attempt}/{retries})...",
                flush=True,
            )
            time.sleep(delay)
    raise RuntimeError(f"No se pudo conectar a la base de datos: {last_error}")
