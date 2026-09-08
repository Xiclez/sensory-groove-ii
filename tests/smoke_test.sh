#!/usr/bin/env bash
# Prueba el ciclo completo del backend de Sensory Groove:
#   subida de comprobante -> listado pendiente -> resolucion -> escaneo de QR
#
# Uso:  ./tests/smoke_test.sh [BASE_URL] [ADMIN_TOKEN]
set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
ADMIN_TOKEN="${2:-${ADMIN_TOKEN:-sensory-admin-dev}}"
AUTH=(-H "X-Admin-Token: ${ADMIN_TOKEN}")

pass() { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$1"; exit 1; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

need() { command -v "$1" >/dev/null || { echo "Falta la herramienta '$1'"; exit 1; }; }
need curl
need python3

# jq es opcional: usamos python3 para parsear JSON y evitar dependencias extra.
json() { python3 -c 'import json,sys;d=json.load(sys.stdin);print(d['"$1"'] if isinstance(d,list) else d['"$1"'])'; }

TMPDIR_SG="$(mktemp -d)"
trap 'rm -rf "${TMPDIR_SG}"' EXIT
COMPROBANTE="${TMPDIR_SG}/comprobante.png"

# PNG 1x1 valido, suficiente para ejercitar el multipart/form-data.
python3 - "$COMPROBANTE" <<'PY'
import base64, sys
png = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)
open(sys.argv[1], "wb").write(png)
PY

step "0. Health check"
curl -fsS "${BASE_URL}/api/health" >/dev/null && pass "API responde" || fail "API no responde en ${BASE_URL}"

step "1. POST /api/transfer (multipart/form-data)"
CREATE_RES="$(curl -fsS -X POST "${BASE_URL}/api/transfer" \
  -F "nombre=Emiliano Vargas" \
  -F "whatsapp=6142550381" \
  -F "accesos=2" \
  -F "comprobante=@${COMPROBANTE};type=image/png")"
echo "     ${CREATE_RES}"
TRANSFER_ID="$(printf '%s' "$CREATE_RES" | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"
[ -n "$TRANSFER_ID" ] && pass "transferencia creada id=${TRANSFER_ID}" || fail "no se obtuvo id"

step "1b. Rechazo de datos invalidos"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/api/transfer" \
  -F "nombre=X" -F "whatsapp=123" -F "accesos=1" \
  -F "comprobante=@${COMPROBANTE};type=image/png")"
[ "$CODE" = "422" ] && pass "nombre/whatsapp invalidos -> 422" || fail "esperaba 422, obtuve ${CODE}"

CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/api/transfer" \
  -F "nombre=Prueba Formato" -F "whatsapp=6141234567" -F "accesos=1" \
  -F "comprobante=@${COMPROBANTE};type=application/x-msdownload")"
[ "$CODE" = "415" ] && pass "formato no soportado -> 415" || fail "esperaba 415, obtuve ${CODE}"

step "2. Autenticacion del panel admin"
CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/api/admin/transfers")"
[ "$CODE" = "401" ] && pass "sin token -> 401" || fail "esperaba 401, obtuve ${CODE}"

step "3. GET /api/admin/transfers (pendientes)"
LIST_RES="$(curl -fsS "${AUTH[@]}" "${BASE_URL}/api/admin/transfers")"
FOUND="$(printf '%s' "$LIST_RES" | python3 -c "
import json,sys
rows = json.load(sys.stdin)
print(any(r['id'] == '${TRANSFER_ID}' and r['status'] == 'pending' for r in rows))
")"
[ "$FOUND" = "True" ] && pass "la transferencia aparece como pending" || fail "no aparece en pendientes: ${LIST_RES}"

step "3b. GET comprobante (revision del admin)"
curl -fsS "${AUTH[@]}" -o /dev/null \
  "${BASE_URL}/api/admin/transfers/${TRANSFER_ID}/comprobante" \
  && pass "comprobante descargable" || fail "no se pudo descargar el comprobante"

step "4. Escaneo antes de aprobar (debe fallar)"
SCAN_RES="$(curl -fsS -X POST "${BASE_URL}/api/scan" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"SG-2026-${TRANSFER_ID}\"}")"
echo "     ${SCAN_RES}"
printf '%s' "$SCAN_RES" | grep -q '"error"' \
  && pass "acceso pendiente rechazado en la puerta" || fail "deberia rechazar accesos no aprobados"

step "5. POST /api/admin/resolve (approve)"
RESOLVE_RES="$(curl -fsS -X POST "${BASE_URL}/api/admin/resolve" \
  "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"id\":\"${TRANSFER_ID}\",\"action\":\"approve\"}")"
echo "     ${RESOLVE_RES}"
printf '%s' "$RESOLVE_RES" | grep -q '"approved"' \
  && pass "transferencia aprobada (revisa el print del mock de WhatsApp en los logs)" \
  || fail "no se aprobo: ${RESOLVE_RES}"

step "5b. Doble resolucion (idempotencia)"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE_URL}/api/admin/resolve" \
  "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"id\":\"${TRANSFER_ID}\",\"action\":\"reject\"}")"
[ "$CODE" = "409" ] && pass "re-resolver -> 409" || fail "esperaba 409, obtuve ${CODE}"

step "5c. Ya no aparece en pendientes"
LIST_RES="$(curl -fsS "${AUTH[@]}" "${BASE_URL}/api/admin/transfers")"
STILL="$(printf '%s' "$LIST_RES" | python3 -c "
import json,sys
print(any(r['id'] == '${TRANSFER_ID}' for r in json.load(sys.stdin)))
")"
[ "$STILL" = "False" ] && pass "salio de la cola de pendientes" || fail "sigue en pendientes"

step "5d. GET QR generado"
curl -fsS "${AUTH[@]}" -o "${TMPDIR_SG}/qr.png" \
  "${BASE_URL}/api/admin/transfers/${TRANSFER_ID}/qr" \
  && pass "QR descargable ($(wc -c <"${TMPDIR_SG}/qr.png") bytes)" || fail "no se genero el QR"

step "6. POST /api/scan (acceso aprobado)"
SCAN_RES="$(curl -fsS -X POST "${BASE_URL}/api/scan" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"SG-2026-${TRANSFER_ID}\"}")"
echo "     ${SCAN_RES}"
printf '%s' "$SCAN_RES" | grep -q '"success"' \
  && pass "acceso valido en la puerta" || fail "el acceso aprobado deberia ser valido"

step "6b. Re-escaneo (deteccion de acceso ya usado)"
SCAN_RES="$(curl -fsS -X POST "${BASE_URL}/api/scan" \
  -H 'Content-Type: application/json' \
  -d "{\"code\":\"${TRANSFER_ID}\"}")"
echo "     ${SCAN_RES}"
printf '%s' "$SCAN_RES" | grep -q '"warning"' \
  && pass "segundo escaneo marcado como ya usado (UUID pelado tambien funciona)" \
  || fail "esperaba warning en el re-escaneo"

step "6c. QR basura"
SCAN_RES="$(curl -fsS -X POST "${BASE_URL}/api/scan" \
  -H 'Content-Type: application/json' -d '{"code":"no-soy-un-qr"}')"
printf '%s' "$SCAN_RES" | grep -q 'QR Invalido' \
  && pass "codigo malformado rechazado" || fail "esperaba QR Invalido"

step "7. Ciclo de rechazo"
REJ_ID="$(curl -fsS -X POST "${BASE_URL}/api/transfer" \
  -F "nombre=Prueba Rechazo" -F "whatsapp=6142854941" -F "accesos=1" \
  -F "comprobante=@${COMPROBANTE};type=image/png" \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["id"])')"
curl -fsS -X POST "${BASE_URL}/api/admin/resolve" \
  "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d "{\"id\":\"${REJ_ID}\",\"action\":\"reject\"}" >/dev/null
SCAN_RES="$(curl -fsS -X POST "${BASE_URL}/api/scan" \
  -H 'Content-Type: application/json' -d "{\"code\":\"SG-2026-${REJ_ID}\"}")"
printf '%s' "$SCAN_RES" | grep -q '"error"' \
  && pass "acceso rechazado no entra" || fail "un acceso rechazado no deberia validar"

printf '\n\033[1;32mTodas las pruebas del ciclo pasaron.\033[0m\n'
printf 'Revisa los logs para el envio simulado:  docker compose logs backend | grep whatsapp:mock\n'
