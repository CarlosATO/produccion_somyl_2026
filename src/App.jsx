import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard'; // Este es el selector general de proyectos
import DashboardProyecto from './pages/produccion/DashboardProyecto'; // <--- EL NUEVO DASHBOARD
import GestionCuadrillas from './pages/produccion/GestionCuadrillas';
import GestionActividades from './pages/produccion/GestionActividades';
import AsignarTareas from './pages/produccion/AsignarTareas';
import Cubicacion from './pages/produccion/Cubicacion';
import GestionZonas from './pages/produccion/GestionZonas';
import GestionDescuentos from './pages/produccion/GestionDescuentos';
import ResumenSubcontrato from './pages/produccion/reportes/ResumenSubcontrato';
import ProduccionActividad from './pages/produccion/reportes/ProduccionActividad';

// --- Placeholder Components ---
const Reportes = () => <div className="p-5"><h1>Reportes</h1></div>;
const Maestros = () => <div className="p-5"><h1>Maestros</h1></div>;
const Configuracion = () => <div className="p-5"><h1>Configuración</h1></div>;

function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <div className="d-flex vh-100 justify-content-center align-items-center">Cargando...</div>;

  if (!user) {
    return (
      <div className="d-flex vh-100 justify-content-center align-items-center bg-light">
        <div className="text-center p-5 bg-white rounded shadow">
          <h2 className="mb-3">Acceso Restringido</h2>
          <a href={import.meta.env.VITE_PORTAL_URL} className="btn btn-primary">Ir al Portal</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light">
      <Navbar />
      <main>
        <Routes>
          {/* 1. SELECCIÓN DE PROYECTO (Home) */}
          <Route path="/" element={<Dashboard />} />
          
          {/* 2. DASHBOARD ESPECÍFICO DEL PROYECTO (Centro de Mando) */}
          <Route 
            path="/proyecto/:projectId" 
            element={<DashboardProyecto />} 
          />

          {/* 3. MÓDULOS DEL PROYECTO */}
          <Route 
            path="/proyecto/:projectId/cuadrillas" 
            element={<GestionCuadrillas />} 
          />
          <Route 
            path="/proyecto/:projectId/actividades" 
            element={<GestionActividades />} 
          />
          <Route 
            path="/proyecto/:projectId/tareas"
            element={<AsignarTareas />}
          />
          <Route 
            path="/proyecto/:projectId/zonas"
            element={<GestionZonas />}
          />
          <Route
            path="/proyecto/:projectId/gastos/cuadrillas"
            element={<GestionDescuentos />}
          />
          <Route
            path="/proyecto/:projectId/cubicaciones"
            element={<Cubicacion />}
          />
          {/* REPORTES */}
          <Route
            path="/proyecto/:projectId/reportes/resumen-subcontrato"
            element={<ResumenSubcontrato />}
          />
          <Route
            path="/proyecto/:projectId/reportes/produccion-actividad"
            element={<ProduccionActividad />}
          />
          {/* Aquí agregaremos Zonas, Reportes, Avance... */}

          {/* 4. RUTAS GLOBALES */}
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/maestros" element={<Maestros />} />
          <Route path="/configuracion" element={<Configuracion />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ProtectedLayout />
    </BrowserRouter>
  );
}

export default App;