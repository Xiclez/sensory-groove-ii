// Cliente HTTP unico. Siempre rutas relativas: en desarrollo las resuelve el
// proxy de Vite y en produccion nginx, asi no hay hosts hardcodeados.
const BASE = '/api';

const ADMIN_TOKEN_KEY = 'sg_admin_token';

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY) || '';
export const setAdminToken = (token) =>
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
export const clearAdminToken = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Extrae el mensaje de error de una respuesta de FastAPI. */
async function readError(res) {
  let detail;
  try {
    const body = await res.json();
    detail = body?.detail;
  } catch {
    detail = null;
  }
  if (Array.isArray(detail)) {
    // Errores de validacion de Pydantic: [{loc, msg, ...}]
    return detail.map((d) => d.msg).join('. ');
  }
  if (typeof detail === 'string') return detail;
  return `Error ${res.status}`;
}

async function request(path, { admin = false, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (admin) headers.set('X-Admin-Token', getAdminToken());

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  return res.status === 204 ? null : res.json();
}

// --- Publico ---------------------------------------------------------------

export function createTransfer({ nombre, whatsapp, accesos, comprobante }) {
  const body = new FormData();
  body.append('nombre', nombre);
  body.append('whatsapp', whatsapp);
  body.append('accesos', String(accesos));
  body.append('comprobante', comprobante);
  // Sin Content-Type manual: el navegador agrega el boundary del multipart.
  return request('/transfer', { method: 'POST', body });
}

export function scanCode(code) {
  return request('/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

// --- Admin -----------------------------------------------------------------

export function listPendingTransfers() {
  return request('/admin/transfers', { admin: true });
}

export function resolveTransfer(id, action) {
  return request('/admin/resolve', {
    admin: true,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action }),
  });
}

/** Descarga el comprobante como blob URL (la ruta exige cabecera de admin). */
export async function fetchComprobanteUrl(id) {
  const res = await fetch(`${BASE}/admin/transfers/${id}/comprobante`, {
    headers: { 'X-Admin-Token': getAdminToken() },
  });
  if (!res.ok) throw new ApiError(await readError(res), res.status);
  return URL.createObjectURL(await res.blob());
}
