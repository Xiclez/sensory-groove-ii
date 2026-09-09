import React, { useState, useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('comprobantes');

  return (
    // Quitamos los bg-gray y bg-white. Dejamos que el shader mande al fondo.
    <div className="flex h-screen text-white font-sans relative z-10">
      
      {/* SIDE NAVBAR (Glassmorphism oscuro) */}
      <aside className="w-64 bg-black/50 backdrop-blur-md border-r border-white/10 flex flex-col">
        <div className="p-6 text-2xl font-bold border-b border-white/10 tracking-wider">
          Sensory Admin
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('comprobantes')} className={`w-full text-left p-3 rounded transition-colors flex items-center gap-3 ${activeTab === 'comprobantes' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
            🧾 Comprobantes
          </button>
          <button onClick={() => setActiveTab('whatsapp')} className={`w-full text-left p-3 rounded transition-colors flex items-center gap-3 ${activeTab === 'whatsapp' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
            💬 WhatsApp
          </button>
          <button onClick={() => setActiveTab('scanner')} className={`w-full text-left p-3 rounded transition-colors flex items-center gap-3 ${activeTab === 'scanner' ? 'bg-white/20 text-white' : 'text-gray-400 hover:bg-white/10'}`}>
            📷 Escáner QR
          </button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto">
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
      const res = await fetch('https://api-sensory-groove2.fadexlabs.com/api/admin/transfers');
      const data = await res.json();
      
      // FIX del error h.map: Aseguramos que sea un arreglo antes de guardarlo
      if (Array.isArray(data)) {
        setTransfers(data);
      } else {
        console.warn("La API no devolvió un arreglo:", data);
        setTransfers([]); // Forzamos un arreglo vacío para evitar el crasheo
      }
    } catch (e) { 
      console.error("Error de red al traer transferencias:", e); 
      setTransfers([]);
    }
  };

  const ejecutarValidacion = async () => {
    setShowValidarModal(false);
    try {
      const res = await fetch('https://api-sensory-groove2.fadexlabs.com/api/admin/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transferAValidar.id, status: 'approved' })
      });
      if (res.ok) {
        alert("Validado y QR enviado.");
        fetchTransfers();
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-white drop-shadow-md">Comprobantes Pendientes</h2>
      <div className="bg-black/40 backdrop-blur-md rounded-lg shadow-xl border border-white/10 overflow-hidden">
        <table className="min-w-full text-white">
          <thead className="bg-black/60 border-b border-white/10">
            <tr>
              <th className="py-4 px-4 text-left font-semibold">ID</th>
              <th className="py-4 px-4 text-left font-semibold">Teléfono</th>
              <th className="py-4 px-4 text-left font-semibold">Comprobante</th>
              <th className="py-4 px-4 text-left font-semibold">Estado</th>
              <th className="py-4 px-4 text-left font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan="5" className="py-8 text-center text-gray-400">No hay comprobantes pendientes o hubo un error al cargar.</td>
              </tr>
            ) : (
              transfers.map(t => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">{t.id}</td>
                  <td className="py-3 px-4">{t.phone}</td>
                  <td className="py-3 px-4">
                    <a href={`https://api-sensory-groove2.fadexlabs.com/${t.comprobante_path}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 underline">
                      Ver Imagen
                    </a>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs uppercase font-bold tracking-wider ${t.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {t.status === 'pending' && (
                      <button onClick={() => { setTransferAValidar(t); setShowValidarModal(true); }} className="bg-emerald-500/80 text-white px-4 py-2 rounded shadow hover:bg-emerald-400 transition-colors">
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

      {/* MODAL CON GLASSMORPHISM */}
      {showValidarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/10 p-6 rounded-lg shadow-2xl max-w-md w-full">
            <h4 className="text-xl font-bold mb-2">¿Validar pago?</h4>
            <p className="mb-6 text-gray-300">Se generará y enviará el QR de acceso al usuario por WhatsApp.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowValidarModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded transition-colors">Cancelar</button>
              <button onClick={ejecutarValidacion} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded transition-colors">Sí, Validar</button>
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

  useEffect(() => { checkWaStatus(); }, []);

  const checkWaStatus = async () => {
    try {
      const res = await fetch('https://api-sensory-groove2.fadexlabs.com/api/admin/whatsapp/status');
      const data = await res.json();
      setWaInfo(data);
    } catch (e) { console.error(e); }
  };

  const iniciarNuevaSesionWA = async () => {
    setShowWaModal(false);
    try {
      await fetch('https://api-sensory-groove2.fadexlabs.com/api/admin/whatsapp/start?force=true', { method: 'POST' });
      alert("Reiniciando sesión. Revisa los logs para escanear el QR en la terminal.");
      checkWaStatus();
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-white drop-shadow-md">Estado del Bot de WhatsApp</h2>
      <div className="bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-lg shadow-xl max-w-lg">
        {waInfo.connected ? (
          <div className="text-emerald-400 font-bold text-lg mb-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
            Conectado a {waInfo.phone}
          </div>
        ) : (
          <div className="text-red-400 font-bold text-lg mb-4">🔴 Desconectado</div>
        )}
        <button onClick={() => { waInfo.connected ? setShowWaModal(true) : iniciarNuevaSesionWA() }} className="bg-white/10 border border-white/20 text-white px-4 py-3 rounded hover:bg-white/20 w-full font-bold transition-colors">
          {waInfo.connected ? 'Forzar Nueva Sesión' : 'Iniciar Sesión'}
        </button>
      </div>

      {showWaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/10 p-6 rounded-lg shadow-2xl max-w-md w-full">
            <h4 className="text-xl font-bold mb-2 text-red-400">¿Reemplazar sesión activa?</h4>
            <p className="mb-6 text-gray-300">Se desconectará el número actual y deberás escanear un nuevo QR.</p>
            <div className="flex justify-end gap-4">
              <button onClick={() => setShowWaModal(false)} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded">Cancelar</button>
              <button onClick={iniciarNuevaSesionWA} className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded">Sí, Reemplazar</button>
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
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
      scanner.render((decodedText) => {
        try {
          const data = JSON.parse(decodedText);
          setScanResult(data);
          scanner.clear(); 
          setScanning(false);
        } catch (e) {
          alert("QR Inválido o no pertenece al evento.");
        }
      }, (error) => {});
    }
    return () => { if (scanner) scanner.clear().catch(e => console.error(e)); };
  }, [scanning]);

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-white drop-shadow-md">Escáner de Accesos</h2>
      
      {!scanning && !scanResult && (
        <button onClick={() => setScanning(true)} className="bg-indigo-500/80 backdrop-blur-sm border border-indigo-400 text-white px-6 py-4 rounded-lg text-xl font-bold hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.5)]">
          Activar Cámara 📷
        </button>
      )}

      {scanning && (
        <div className="max-w-md bg-black/40 backdrop-blur-md p-4 rounded-lg shadow-xl border border-white/10">
          <div id="reader" className="w-full bg-black/50 rounded overflow-hidden"></div>
          <button onClick={() => setScanning(false)} className="mt-4 w-full bg-red-500/80 hover:bg-red-500 text-white py-3 rounded-lg font-bold transition-colors">Cancelar Escáner</button>
        </div>
      )}

      {scanResult && (
        <div className="bg-black/60 backdrop-blur-md border-l-4 border-emerald-500 p-6 rounded-lg shadow-xl max-w-lg mt-4 text-white">
          <h3 className="text-2xl font-bold text-emerald-400 mb-4 flex items-center gap-2">✅ Acceso Válido</h3>
          <p className="text-lg mb-2 text-gray-300"><strong>ID Ticket:</strong> <span className="text-white">#{scanResult.id}</span></p>
          <p className="text-lg mb-2 text-gray-300"><strong>Titular:</strong> <span className="text-white">{scanResult.nombre}</span></p>
          <div className="mt-4">
            <span className="text-lg font-bold text-indigo-300 bg-indigo-900/50 border border-indigo-500/30 px-4 py-2 rounded-lg inline-block shadow-inner">
              🎟️ Accesos Permitidos: {scanResult.accesos}
            </span>
          </div>
          
          <div className="mt-8">
            <button onClick={() => setScanResult(null)} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-3 rounded-lg w-full font-bold transition-colors">
              Escanear Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}