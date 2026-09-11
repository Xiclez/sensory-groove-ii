import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { API_BASE_URL } from '../lib/config';


export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('comprobantes');
  const [menuOpen, setMenuOpen] = useState(false); // Para el menú en móvil

  return (
    <div className="flex flex-col md:flex-row h-screen text-white relative z-10">

      {/* NAVBAR (Superior en móvil, Lateral en Desktop) */}
      <aside className="md:w-64 bg-black/50 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 flex flex-col">
        <div className="p-4 md:p-6 flex justify-between items-center border-b border-white/10">
          <div className="text-xl md:text-2xl font-bold tracking-wider">
            Sensory Admin
          </div>
          {/* Botón Hamburguesa para móvil */}
          <button
            className="md:hidden text-white focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
        </div>

        <nav className={`${menuOpen ? 'flex' : 'hidden'} md:flex flex-col p-4 space-y-2`}>
          <button onClick={() => { setActiveTab('comprobantes'); setMenuOpen(false); }} className={`w-full text-left p-3 rounded transition-colors flex items-center gap-3 ${activeTab === 'comprobantes' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
            🧾 Comprobantes
          </button>
          <button onClick={() => { setActiveTab('whatsapp'); setMenuOpen(false); }} className={`w-full text-left p-3 rounded transition-colors flex items-center gap-3 ${activeTab === 'whatsapp' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
            💬 WhatsApp
          </button>
          <button onClick={() => { setActiveTab('scanner'); setMenuOpen(false); }} className={`w-full text-left p-3 rounded transition-colors flex items-center gap-3 ${activeTab === 'scanner' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
            📷 Escáner
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {activeTab === 'comprobantes' && <ViewComprobantes />}
        {activeTab === 'whatsapp' && <ViewWhatsApp />}
        {activeTab === 'scanner' && <ViewScanner />}
      </main>
    </div>
  );
}

// ==========================================
// VISTA 1: COMPROBANTES
// ==========================================
function ViewComprobantes() {
  const [transfers, setTransfers] = useState([]);
  const [showValidarModal, setShowValidarModal] = useState(false);
  const [transferAValidar, setTransferAValidar] = useState(null);

  useEffect(() => { fetchTransfers(); }, []);

  const fetchTransfers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/transfers`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransfers(data);
      } else {
        setTransfers([]);
      }
    } catch (e) {
      console.error(e);
      setTransfers([]);
    }
  };

  const ejecutarValidacion = async () => {
    setShowValidarModal(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transferAValidar.id, status: 'approved' })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(data.status === 'already_approved'
          ? 'Este comprobante ya estaba validado.'
          : 'Validado y QR enviado.');
      } else {
        // El backend devuelve 502 si WhatsApp rechazo el envio: sin esto el
        // fallo quedaba invisible y parecia que el QR se habia enviado.
        alert(`No se pudo validar: ${data.detail || res.status}`);
      }
      fetchTransfers();
    } catch (e) {
      console.error(e);
      alert('Error de conexion con el backend.');
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white drop-shadow-md">Comprobantes</h2>
      <div className="bg-black/40 backdrop-blur-md rounded-lg shadow-xl border border-white/10 overflow-hidden w-full">
        {/* Contenedor responsivo para la tabla */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-white text-sm md:text-base">
            <thead className="bg-black/60 border-b border-white/10">
              <tr>
                <th className="py-3 md:py-4 px-3 md:px-4 text-left font-semibold">Folio</th>
                <th className="py-3 md:py-4 px-3 md:px-4 text-left font-semibold">Nombre</th>
                <th className="py-3 md:py-4 px-3 md:px-4 text-left font-semibold">Teléfono</th>
                <th className="py-3 md:py-4 px-3 md:px-4 text-left font-semibold">Accesos</th>
                <th className="py-3 md:py-4 px-3 md:px-4 text-left font-semibold">Comprobante</th>
                <th className="py-3 md:py-4 px-3 md:px-4 text-left font-semibold">Estado</th>
                <th className="py-3 md:py-4 px-3 md:px-4 text-left font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-400">No hay comprobantes pendientes.</td>
                </tr>
              ) : (
                transfers.map(t => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 md:px-4 font-mono text-xs uppercase">{t.folio}</td>
                    <td className="py-3 px-3 md:px-4">{t.nombre}</td>
                    <td className="py-3 px-3 md:px-4">{t.whatsapp}</td>
                    <td className="py-3 px-3 md:px-4">{t.accesos}</td>
                    <td className="py-3 px-3 md:px-4">
                      <a href={`${API_BASE_URL}/${t.comprobante_path}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
                        Ver Imagen
                      </a>
                    </td>
                    <td className="py-3 px-3 md:px-4">
                      <span className={`px-2 py-1 rounded text-xs uppercase font-bold tracking-wider ${t.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 md:px-4">
                      {t.status === 'pending' && (
                        <button onClick={() => { setTransferAValidar(t); setShowValidarModal(true); }} className="bg-emerald-500/80 text-white px-3 md:px-4 py-1.5 md:py-2 rounded shadow hover:bg-emerald-400 transition-colors w-full md:w-auto">
                          Validar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showValidarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/10 p-6 rounded-lg shadow-2xl max-w-sm md:max-w-md w-full">
            <h4 className="text-lg md:text-xl font-bold mb-2">¿Validar pago?</h4>
            <p className="mb-6 text-sm md:text-base text-gray-300">Se generará y enviará el QR de acceso al usuario por WhatsApp.</p>
            <div className="flex flex-col md:flex-row justify-end gap-3 md:gap-4">
              <button onClick={() => setShowValidarModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors w-full md:w-auto">Cancelar</button>
              <button onClick={ejecutarValidacion} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors w-full md:w-auto">Sí, Validar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// VISTA 2: WHATSAPP
// ==========================================
function ViewWhatsApp() {
  const [waInfo, setWaInfo] = useState({ connected: false, phone: '', lastSeen: '' });
  const [showWaModal, setShowWaModal] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkWaStatus();
    const interval = setInterval(() => { checkWaStatus(); }, 4000);
    return () => clearInterval(interval);
  }, []);

  const checkWaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/whatsapp/status`);
      const data = await res.json();
      setWaInfo(data);
      if (data.connected) setQrCode(null);
    } catch (e) { console.error(e); }
  };

  const iniciarNuevaSesionWA = async () => {
    setShowWaModal(false);
    setLoading(true);
    setQrCode(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/whatsapp/start?force=true`, { method: 'POST' });
      const data = await res.json();
      if (data.qrcode) {
        setQrCode(data.qrcode.startsWith('data:image') ? data.qrcode : `data:image/png;base64,${data.qrcode}`);
      } else {
        checkWaStatus();
      }
    } catch (e) {
      console.error(e);
      alert("Error al conectar con WPPConnect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white drop-shadow-md">Estado WhatsApp</h2>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 p-4 md:p-6 rounded-lg shadow-xl w-full xl:w-1/2 h-fit">
          {waInfo.connected ? (
            <div className="text-emerald-400 font-bold text-base md:text-lg mb-4 flex items-center gap-2">
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
              Conectado a {waInfo.phone}
            </div>
          ) : (
            <div className="text-red-400 font-bold text-base md:text-lg mb-4">🔴 Desconectado</div>
          )}

          <button
            onClick={() => { waInfo.connected ? setShowWaModal(true) : iniciarNuevaSesionWA() }}
            disabled={loading}
            className="bg-white/10 border border-white/20 text-white px-4 py-3 rounded hover:bg-white/20 w-full font-bold transition-colors disabled:opacity-50"
          >
            {loading ? 'Generando QR...' : (waInfo.connected ? 'Forzar Nueva Sesión' : 'Iniciar Sesión')}
          </button>
        </div>

        {qrCode && !waInfo.connected && (
          <div className="bg-black/40 backdrop-blur-md border border-emerald-500/50 p-4 md:p-6 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] flex flex-col items-center justify-center text-center w-full xl:w-1/2 animate-pulse-slow">
            <h3 className="text-lg md:text-xl font-bold text-emerald-400 mb-4">Escanea para conectar</h3>
            <div className="bg-white p-3 md:p-4 rounded-xl shadow-2xl mb-4 inline-block">
              <img
                src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="WhatsApp QR Code"
                className="w-48 h-48 md:w-64 md:h-64 object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {showWaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/10 p-6 rounded-lg shadow-2xl max-w-sm md:max-w-md w-full">
            <h4 className="text-lg md:text-xl font-bold mb-2 text-red-400">¿Reemplazar sesión?</h4>
            <p className="mb-6 text-sm md:text-base text-gray-300">Se desconectará el número actual.</p>
            <div className="flex flex-col md:flex-row justify-end gap-3 md:gap-4">
              <button onClick={() => setShowWaModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-white w-full md:w-auto">Cancelar</button>
              <button onClick={iniciarNuevaSesionWA} className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded font-bold w-full md:w-auto">Sí, Reemplazar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// VISTA 3: ESCÁNER QR
// ==========================================
function ViewScanner() {
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let scanner = null;
    if (scanning) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((decodedText) => {
        try {
          const data = JSON.parse(decodedText);
          setScanResult(data);
          scanner.clear();
          setScanning(false);
        } catch (e) {
          alert("QR Inválido");
        }
      }, (error) => { });
    }
    return () => { if (scanner) scanner.clear().catch(e => console.error(e)); };
  }, [scanning]);

  return (
    <div className="w-full">
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-white drop-shadow-md">Escáner</h2>

      {!scanning && !scanResult && (
        <button onClick={() => setScanning(true)} className="w-full md:w-auto bg-indigo-500/80 backdrop-blur-sm border border-indigo-400 text-white px-6 py-4 rounded-lg text-lg md:text-xl font-bold hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.5)]">
          Activar Cámara 📷
        </button>
      )}

      {scanning && (
        <div className="max-w-md w-full bg-black/40 backdrop-blur-md p-4 rounded-lg shadow-xl border border-white/10">
          <div id="reader" className="w-full bg-black/50 rounded overflow-hidden"></div>
          <button onClick={() => setScanning(false)} className="mt-4 w-full bg-red-500/80 hover:bg-red-500 text-white py-3 rounded-lg font-bold transition-colors">Cancelar</button>
        </div>
      )}

      {scanResult && (
        <div className="bg-black/60 backdrop-blur-md border-l-4 border-emerald-500 p-4 md:p-6 rounded-lg shadow-xl max-w-sm md:max-w-lg mt-4 text-white w-full">
          <h3 className="text-xl md:text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2">✅ Acceso Válido</h3>
          <p className="text-base md:text-lg mb-2 text-gray-300"><strong>ID Ticket:</strong> <span className="text-white">#{scanResult.id}</span></p>
          <p className="text-base md:text-lg mb-2 text-gray-300"><strong>Titular:</strong> <span className="text-white">{scanResult.nombre}</span></p>
          <div className="mt-4">
            <span className="text-base md:text-lg font-bold text-indigo-300 bg-indigo-900/50 border border-indigo-500/30 px-4 py-2 rounded-lg inline-block shadow-inner w-full md:w-auto text-center">
              🎟️ Accesos: {scanResult.accesos}
            </span>
          </div>
          <div className="mt-6 md:mt-8">
            <button onClick={() => setScanResult(null)} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-3 rounded-lg w-full font-bold transition-colors">
              Escanear Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
