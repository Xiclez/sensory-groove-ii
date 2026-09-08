import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QrScanner from '../components/QrScanner';
import {
  clearAdminToken,
  fetchComprobanteUrl,
  getAdminToken,
  listPendingTransfers,
  resolveTransfer,
  setAdminToken,
} from '../lib/api';

export default function AdminDashboard() {
  const [autenticado, setAutenticado] = useState(Boolean(getAdminToken()));

  if (!autenticado) {
    return <LoginGate onListo={() => setAutenticado(true)} />;
  }

  return (
    <Panel
      onSalir={() => {
        clearAdminToken();
        setAutenticado(false);
      }}
    />
  );
}

function LoginGate({ onListo }) {
  const [token, setToken] = useState('');

  const onSubmit = (event) => {
    event.preventDefault();
    if (!token.trim()) return;
    setAdminToken(token.trim());
    onListo();
  };

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md items-center px-5">
      <form onSubmit={onSubmit} className="sg-panel w-full text-left">
        <h1 className="sg-heading mb-6 text-center text-2xl text-sg-glow">
          Acceso Staff
        </h1>
        <label htmlFor="admin-token" className="sg-label">
          Token de administrador
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="current-password"
          className="sg-input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button type="submit" className="sg-btn mt-5 w-full">
          Entrar
        </button>
        <Link
          to="/"
          className="mt-5 block text-center text-xs uppercase tracking-wider text-white/50 hover:text-white"
        >
          Volver al flyer
        </Link>
      </form>
    </main>
  );
}

function Panel({ onSalir }) {
  const [transfers, setTransfers] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [resolviendo, setResolviendo] = useState(null);
  const [comprobante, setComprobante] = useState(null); // { url, tipo, nombre }

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setTransfers(await listPendingTransfers());
    } catch (err) {
      if (err?.status === 401) {
        setError('Token inválido o expirado. Vuelve a iniciar sesión.');
      } else {
        setError(err?.message || 'No se pudo cargar la lista.');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    // Refresco periodico: varias personas suben comprobantes en paralelo.
    const id = setInterval(cargar, 20000);
    return () => clearInterval(id);
  }, [cargar]);

  const onResolver = async (id, action) => {
    setResolviendo(id);
    setError(null);
    try {
      await resolveTransfer(id, action);
      // Optimista: lo sacamos de la cola sin esperar el siguiente refresco.
      setTransfers((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err?.message || 'No se pudo resolver la transferencia.');
      cargar();
    } finally {
      setResolviendo(null);
    }
  };

  const onVerComprobante = async (transfer) => {
    setError(null);
    try {
      const url = await fetchComprobanteUrl(transfer.id);
      const tipo = transfer.comprobante_path.endsWith('.pdf') ? 'pdf' : 'imagen';
      setComprobante({ url, tipo, nombre: transfer.nombre });
    } catch (err) {
      setError(err?.message || 'No se pudo abrir el comprobante.');
    }
  };

  const cerrarComprobante = () => {
    if (comprobante) URL.revokeObjectURL(comprobante.url);
    setComprobante(null);
  };

  const totalAccesos = transfers.reduce((sum, t) => sum + t.accesos, 0);

  return (
    <main className="relative mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="sg-heading text-3xl text-sg-glow md:text-4xl">
            Panel Administrativo
          </h1>
          <p className="mt-1 font-orbitron text-xs uppercase tracking-wider text-white/50">
            Sensory Groove · Control de accesos
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/" className="sg-btn text-xs">
            Flyer
          </Link>
          <button type="button" className="sg-btn text-xs" onClick={onSalir}>
            Salir
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-sg-neon bg-sg-neon/10 p-3 text-sm text-sg-glow"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* --- Cola de validacion --- */}
        <section className="sg-panel text-left">
          <div className="mb-6 flex items-baseline justify-between gap-3">
            <h2 className="sg-heading text-xl">Pendientes de Validación</h2>
            <span className="font-orbitron text-xs text-white/50">
              {transfers.length} · {totalAccesos} accesos
            </span>
          </div>

          {cargando ? (
            <p className="text-sm text-white/50">Cargando...</p>
          ) : transfers.length === 0 ? (
            <p className="text-sm text-white/50">
              No hay transferencias pendientes.
            </p>
          ) : (
            <ul className="space-y-4">
              {transfers.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-sg-neon/60 bg-black/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold">{t.nombre}</p>
                      <p className="text-sm text-white/60">
                        WA: {t.whatsapp} · Accesos: {t.accesos}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-white/35">
                        {t.id}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        className="rounded border border-white/25 px-4 py-1 font-orbitron text-xs uppercase text-white/70 transition-colors hover:border-white hover:text-white"
                        onClick={() => onVerComprobante(t)}
                      >
                        Comprobante
                      </button>
                      <button
                        type="button"
                        disabled={resolviendo === t.id}
                        className="rounded border border-emerald-500 bg-emerald-500/15 px-4 py-1 font-orbitron text-xs uppercase text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-black disabled:opacity-50"
                        onClick={() => onResolver(t.id, 'approve')}
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        disabled={resolviendo === t.id}
                        className="rounded border border-sg-neon bg-sg-neon/15 px-4 py-1 font-orbitron text-xs uppercase text-sg-glow transition-colors hover:bg-sg-neon hover:text-black disabled:opacity-50"
                        onClick={() => onResolver(t.id, 'reject')}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Escaner de puerta --- */}
        <section className="sg-panel text-left">
          <h2 className="sg-heading mb-6 text-xl">Escáner de Accesos</h2>
          <QrScanner />
        </section>
      </div>

      {comprobante && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={cerrarComprobante}
        >
          <div
            className="animate-fade-in relative max-h-full w-full max-w-2xl overflow-auto rounded-xl border border-sg-neon bg-sg-void p-4 shadow-neon-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="sg-heading truncate text-base">
                {comprobante.nombre}
              </h3>
              <button
                type="button"
                aria-label="Cerrar"
                className="text-2xl leading-none text-sg-glow hover:text-white"
                onClick={cerrarComprobante}
              >
                &times;
              </button>
            </div>
            {comprobante.tipo === 'pdf' ? (
              <iframe
                src={comprobante.url}
                title="Comprobante"
                className="h-[70vh] w-full rounded border border-sg-neon/40 bg-white"
              />
            ) : (
              <img
                src={comprobante.url}
                alt="Comprobante de pago"
                className="mx-auto max-h-[70vh] rounded border border-sg-neon/40"
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
