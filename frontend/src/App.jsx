import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ShaderBackground from './components/ShaderBackground';
import FlyerPage from './pages/FlyerPage';

// El panel arrastra html5-qrcode (~500 kB). Se carga solo al entrar a /admin
// para no penalizar a quien abre el flyer desde el celular.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

export default function App() {
  return (
    <BrowserRouter>
      {/* Fondo fijo en z-index -1, detras de todo el contenido. */}
      <ShaderBackground />
      <Routes>
        <Route path="/" element={<FlyerPage />} />
        <Route
          path="/admin"
          element={
            <Suspense
              fallback={
                <p className="p-10 text-center font-orbitron text-sm uppercase tracking-wider text-sg-glow">
                  Cargando panel...
                </p>
              }
            >
              <AdminDashboard />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
