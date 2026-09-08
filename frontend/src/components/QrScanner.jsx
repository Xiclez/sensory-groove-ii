import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { scanCode } from '../lib/api';

const REGION_ID = 'sg-qr-reader';
// html5-qrcode dispara el callback en cada fotograma mientras el QR sigue en
// cuadro; ignoramos el mismo codigo durante este intervalo.
const COOLDOWN_MS = 3000;

const ESTILOS_RESULTADO = {
  success: 'border-emerald-500 bg-emerald-500/10 text-emerald-300',
  warning: 'border-sg-warn bg-sg-warn/10 text-sg-warn',
  error: 'border-sg-neon bg-sg-neon/10 text-sg-glow',
};

export default function QrScanner() {
  const [activo, setActivo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);
  const scannerRef = useRef(null);
  const ultimoRef = useRef({ code: null, at: 0 });

  const onDetectado = useCallback(async (texto) => {
    const ahora = Date.now();
    const previo = ultimoRef.current;
    if (previo.code === texto && ahora - previo.at < COOLDOWN_MS) return;
    ultimoRef.current = { code: texto, at: ahora };

    try {
      const data = await scanCode(texto);
      setResultado(data);
      setHistorial((prev) =>
        [{ ...data, key: `${texto}-${ahora}` }, ...prev].slice(0, 8),
      );
    } catch (error) {
      setResultado({
        status: 'error',
        message: error?.message || 'No se pudo validar el acceso.',
      });
    }
  }, []);

  useEffect(() => {
    if (!activo) return;

    const scanner = new Html5QrcodeScanner(
      REGION_ID,
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
      /* verbose */ false,
    );
    scannerRef.current = scanner;
    // El segundo callback recibe errores por fotograma sin QR: es ruido normal.
    scanner.render(onDetectado, () => {});

    return () => {
      scannerRef.current = null;
      // clear() rechaza si la camara ya se detuvo; no es un fallo real.
      scanner.clear().catch(() => {});
    };
  }, [activo, onDetectado]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="sg-btn text-xs"
          onClick={() => setActivo((v) => !v)}
        >
          {activo ? 'Detener cámara' : 'Activar cámara'}
        </button>
        {resultado && (
          <button
            type="button"
            className="text-xs uppercase tracking-wider text-white/50 hover:text-white"
            onClick={() => setResultado(null)}
          >
            Limpiar
          </button>
        )}
      </div>

      {activo ? (
        <div
          id={REGION_ID}
          className="overflow-hidden rounded-lg border border-sg-neon/60 bg-black/60 [&_button]:cursor-pointer [&_img]:mx-auto [&_video]:w-full"
        />
      ) : (
        <p className="rounded-lg border border-dashed border-sg-neon/40 bg-black/40 p-6 text-center text-sm text-white/50">
          Activa la cámara para validar los QR en la puerta.
        </p>
      )}

      {resultado && (
        <div
          role="status"
          aria-live="assertive"
          className={`mt-5 rounded-lg border p-4 text-center font-orbitron text-base ${
            ESTILOS_RESULTADO[resultado.status] || ESTILOS_RESULTADO.error
          }`}
        >
          {resultado.message}
        </div>
      )}

      {historial.length > 1 && (
        <ul className="mt-4 space-y-1 text-xs text-white/45">
          {historial.slice(1).map((item) => (
            <li key={item.key} className="truncate">
              · {item.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
