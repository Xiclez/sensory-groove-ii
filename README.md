# Sensory Groove — Plataforma V2

Plataforma interactiva y de gestión de accesos para el evento de Tech House
**Sensory Groove**, producido por **Fadex Labs**.

- **Frontend**: React 18 + Vite + Tailwind + GSAP/ScrollTrigger + shader WebGL
- **Backend**: FastAPI + SQLAlchemy 2 + PostgreSQL
- **Infra**: Docker Compose (frontend / backend / db)

---

## Arranque rápido

```bash
cp .env.example .env        # y cambia ADMIN_TOKEN
docker compose up -d --build
```

| Servicio | URL |
| --- | --- |
| Flyer público | http://localhost:3000 |
| Panel de staff | http://localhost:3000/admin |
| API (docs) | http://localhost:8000/docs |

El panel pide el `ADMIN_TOKEN` definido en `.env`.

### Desarrollo sin Docker

```bash
# Terminal 1 — API (requiere un Postgres accesible)
cd backend
pip install -r requirements.txt
DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/sensorygroove \
  uvicorn main:app --reload

# Terminal 2 — Frontend (proxy /api -> :8000)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

El frontend **siempre** llama a rutas relativas (`/api/...`): en desarrollo las
resuelve el proxy de Vite y en producción nginx. No hay hosts hardcodeados.

---

## Ciclo de un acceso

```
Comprador                     Staff                        Puerta
   |                            |                            |
   |-- POST /api/transfer ----->|                            |
   |   (multipart + comprobante)|                            |
   |        status = pending    |                            |
   |                            |-- GET /api/admin/transfers  |
   |                            |-- POST /api/admin/resolve   |
   |                            |   approve -> genera QR      |
   |                            |   + envío simulado (print)  |
   |                            |                            |
   |                            |         POST /api/scan ---->|
   |                            |         valida "approved"   |
```

### Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Health check |
| POST | `/api/transfer` | — | Sube comprobante (`multipart/form-data`), queda `pending` |
| POST | `/api/scan` | — | Valida un QR en la puerta |
| GET | `/api/admin/transfers` | token | Lista los `pending` |
| POST | `/api/admin/resolve` | token | `approve` / `reject` |
| GET | `/api/admin/transfers/{id}/comprobante` | token | Descarga el comprobante |
| GET | `/api/admin/transfers/{id}/qr` | token | Descarga el PNG del QR |

Las rutas `/api/admin/*` exigen la cabecera `X-Admin-Token`.

### WhatsApp: excluido a propósito

No hay integración con WPPConnect ni Evolution API. El envío del QR se **simula
con `print()`** en `_mock_enviar_whatsapp` (`backend/main.py`). Para verlo:

```bash
docker compose logs backend | grep whatsapp:mock
```

Ese es el único punto a reemplazar cuando se conecte un proveedor real.

---

## Pruebas

```bash
# Ciclo completo del backend: subida -> listado -> resolución -> escaneo
./tests/smoke_test.sh http://localhost:8000 "$ADMIN_TOKEN"

# El texto en español de la V1 se conserva literalmente
python3 tests/check_textos_v1.py
```

`tests/api.http` contiene las mismas peticiones para la extensión **REST
Client** de VS Code o el HTTP Client de JetBrains.

---

## Estructura

```
backend/
  main.py           endpoints, validación de subidas, mock de WhatsApp
  models.py         modelo Transfer (id UUID, status, comprobante_path, ...)
  database.py       engine, sesión y espera a que Postgres esté listo
frontend/
  nginx.conf        SPA fallback + proxy /api -> backend:8000
  src/
    components/
      ShaderBackground.jsx   shader WebGL, UNIFORMS en rojo neón, z-index -1
      TicketForm.jsx         formulario de accesos -> POST /api/transfer
      QrScanner.jsx          html5-qrcode -> POST /api/scan
      DjModal.jsx            modal de artistas
    pages/
      FlyerPage.jsx          traducción de refs/index.html a componentes
      AdminDashboard.jsx     cola de validación + escáner (/admin)
    data/lineup.js           textos y assets del lineup (literales de la V1)
    lib/api.js               cliente HTTP único
tests/
  smoke_test.sh     ciclo completo con curl
  api.http          peticiones para REST Client
  check_textos_v1.py verificación del texto de la V1
refs/               material base de la V1 (no se toca)
```

---

## Notas de diseño

**Estética "Red Underground".** La paleta sale del flyer de referencia
(`refs/WhatsApp Image 2026-08-19...jpeg`): campo negro, humo rojo oscuro y rojo
neón sólo como acento. La rampa del shader se detiene en `#7a0014` a propósito —
un fondo de plasma rojo saturado se come el texto blanco. El neón lo aportan los
bordes y los glows de la UI. Sobre el shader hay un *scrim* radial que garantiza
el contraste del texto en cualquier resolución.

Variables en `frontend/tailwind.config.js` (`sg.*`) y en `src/styles/global.css`.

**Texto de la V1.** Todas las cadenas en español están copiadas literalmente de
`refs/index.html`: sin correcciones de ortografía ni acentos, sin autocompletar
palabras y sin alterar la jerga. `tests/check_textos_v1.py` lo verifica en CI.
Al editar textos, mantén esa regla.

**Rendimiento.** El panel `/admin` arrastra `html5-qrcode` (~380 kB), así que se
carga con `React.lazy` sólo al entrar a esa ruta: quien abre el flyer desde el
celular descarga 311 kB en lugar de 694 kB. El shader pausa su bucle de render
cuando la pestaña no está visible y respeta `prefers-reduced-motion`.

---

## Pendientes para producción

- [ ] Cambiar `ADMIN_TOKEN` y las credenciales de Postgres en `.env`.
- [ ] Ajustar `CORS_ORIGINS` al dominio real.
- [ ] Servir por HTTPS: la cámara del escáner (`getUserMedia`) sólo funciona en
      contextos seguros (`https://` o `localhost`).
- [ ] Actualizar la fecha del evento en `frontend/src/data/lineup.js`
      (`EVENT_DATE`) para la segunda edición.
- [ ] Sustituir los assets del flyer y el logo por el arte de la segunda edición
      (los actuales, en Cloudinary, siguen siendo los azules de la V1).
- [ ] Conectar un proveedor real de mensajería en `_mock_enviar_whatsapp`.
