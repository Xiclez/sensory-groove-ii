import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [token, setToken] = useState(localStorage.getItem('sgAdminToken') || '');

  const [transfers, setTransfers] = useState([]);
  const [qrCode, setQrCode] = useState(null);
  const [waStatus, setWaStatus] = useState('Verificando estado...');
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      fetchTransfers(token);
      checkWaStatus();
    }
  }, [token]);

  useEffect(() => {
    let interval;
    if (isAuthenticated && qrCode) {
      interval = setInterval(() => {
        checkWaStatus();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isAuthenticated, qrCode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`https://api-sensory-groove2.fadexlabs.com/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('sgAdminToken', data.token);
        setToken(data.token);
        setIsAuthenticated(true);
      } else {
        setLoginError('Credenciales incorrectas');
      }
    } catch (err) {
      setLoginError('Error conectando al servidor');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sgAdminToken');
    setToken('');
    setIsAuthenticated(false);
  };

  const fetchTransfers = async (authToken) => {
    try {
      const res = await fetch(`https://api-sensory-groove2.fadexlabs.com/api/admin/transfers`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      setTransfers(data);
    } catch (error) {
      console.error("Error fetching transfers:", error);
    }
  };

  const handleResolve = async (id, action) => {
    try {
      await fetch(`https://api-sensory-groove2.fadexlabs.com/api/admin/resolve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({id, action})
      });
      fetchTransfers(token); 
    } catch (error) {
      console.error("Error resolving transfer:", error);
    }
  };

  const checkWaStatus = async () => {
    try {
      const res = await fetch(`https://api-sensory-groove2.fadexlabs.com/api/admin/whatsapp/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      
      if (data.status === 'CONNECTED') {
        setWaStatus('¡WhatsApp ya está conectado y listo!');
        setQrCode(null);
      } else if (!qrCode) {
        setWaStatus('Desconectado');
      }
    } catch (error) {
      if(!qrCode) setWaStatus('Error verificando conexión');
    }
  };

  const startWhatsAppSession = async () => {
    setIsLoadingQr(true);
    setWaStatus('Generando QR...');
    try {
      const res = await fetch(`https://api-sensory-groove2.fadexlabs.com/api/admin/whatsapp/start`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) return handleLogout();
      const data = await res.json();
      
      if (data.qrcode) {
        const qrImageSrc = data.qrcode.startsWith('data:image') 
          ? data.qrcode 
          : `data:image/png;base64,${data.qrcode}`;
        setQrCode(qrImageSrc);
        setWaStatus('Escanea el QR con tu WhatsApp...');
      } else if (data.status === 'CONNECTED') {
        setWaStatus('¡WhatsApp ya está conectado y listo!');
        setQrCode(null);
      } else {
        setWaStatus(data.message || 'Error al iniciar sesión');
      }
    } catch (error) {
      setWaStatus('Error de conexión con el servidor');
    } finally {
      setIsLoadingQr(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 relative z-10">
        <form onSubmit={handleLogin} className="bg-black/60 border border-cyber-red p-8 rounded-xl backdrop-blur-md shadow-[0_0_20px_rgba(255,0,60,0.3)] w-full max-w-sm text-center flex flex-col gap-5">
          <img src="https://res.cloudinary.com/dn4m0kr7j/image/upload/v1783381927/Sensory_Groove_Logo_d86xuu.jpg" alt="Logo" className="w-24 h-24 mx-auto rounded-full border-2 border-cyber-red shadow-[0_0_15px_rgba(255,0,60,0.5)] object-cover mb-2" />
          <h2 className="font-orbitron text-2xl text-cyber-red uppercase tracking-widest">Admin Login</h2>
          
          <input type="text" placeholder="Usuario" required 
            className="bg-black/50 border border-cyber-red p-3 rounded text-white outline-none focus:shadow-[0_0_10px_rgba(255,0,60,0.5)] text-center"
            onChange={e => setCredentials({...credentials, username: e.target.value})} />
            
          <input type="password" placeholder="Contraseña" required 
            className="bg-black/50 border border-cyber-red p-3 rounded text-white outline-none focus:shadow-[0_0_10px_rgba(255,0,60,0.5)] text-center"
            onChange={e => setCredentials({...credentials, password: e.target.value})} />
            
          <button type="submit" className="font-orbitron bg-transparent border border-cyber-red text-cyber-red py-3 px-4 rounded-full hover:bg-cyber-red hover:text-black transition-all shadow-[0_0_10px_rgba(255,0,60,0.2)] mt-2">
            INGRESAR
          </button>
          
          {loginError && <p className="text-cyber-red font-bold mt-2">{loginError}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 py-10 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <div className="lg:col-span-1">
        <h1 className="text-4xl font-orbitron text-cyber-red neon-text mb-8">Admin Panel</h1>
        <div className="bg-cyber-panel neon-border p-6 rounded-xl text-center">
          <h2 className="font-orbitron text-xl mb-4">Estado de WhatsApp</h2>
          <p className={`mb-4 font-bold ${waStatus.includes('conectado') ? 'text-green-500' : 'text-cyber-red'}`}>{waStatus}</p>
          {qrCode && (
            <div className="bg-white p-2 rounded-lg inline-block mb-4 border-2 border-cyber-red">
              <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
            </div>
          )}
          <button onClick={startWhatsAppSession} disabled={isLoadingQr} className="w-full font-orbitron bg-transparent border border-cyber-red text-cyber-red py-2 px-4 rounded hover:bg-cyber-red hover:text-black transition-all shadow-[0_0_10px_rgba(255,0,60,0.2)] disabled:opacity-50 mb-4">
            {isLoadingQr ? 'CARGANDO...' : 'VINCULAR WHATSAPP'}
          </button>
          <button onClick={handleLogout} className="w-full font-orbitron bg-black/50 border border-gray-600 text-gray-400 py-2 px-4 rounded hover:bg-gray-800 transition-all text-sm">
            CERRAR SESIÓN
          </button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-cyber-panel neon-border p-6 rounded-xl mt-[4.5rem]">
          <h2 className="font-orbitron text-2xl mb-6">Control de Transferencias</h2>
          <div className="space-y-4">
            {transfers.map(t => (
              <div key={t.id} className={`bg-black/80 border p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4 ${t.status === 'pending' ? 'border-cyber-red' : t.status === 'approved' ? 'border-green-500' : 'border-gray-500'}`}>
                <div className="flex-1">
                  <p className="font-bold text-xl mb-1">
                    {t.nombre} 
                    <span className={`text-xs uppercase ml-3 px-2 py-1 rounded font-orbitron ${t.status === 'pending' ? 'bg-cyber-red text-black' : t.status === 'approved' ? 'bg-green-500 text-black' : 'bg-gray-500 text-white'}`}>
                      {t.status}
                    </span>
                  </p>
                  <p className="text-sm text-gray-300">WA: {t.whatsapp} | Accesos: {t.accesos}</p>
                </div>
                
                <div className="flex gap-2">
                  <a 
                    href={`https://api-sensory-groove2.fadexlabs.com/${t.comprobante_path}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-orbitron transition-colors text-center text-white"
                  >
                    Ver Comprobante
                  </a>
                  {t.status === 'pending' && (
                    <button onClick={() => handleResolve(t.id, 'approved')} className="bg-green-700 hover:bg-green-600 px-4 py-2 rounded font-orbitron transition-colors text-white">
                      Aprobar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {transfers.length === 0 && <p className="text-gray-400">No hay transferencias en el sistema.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
