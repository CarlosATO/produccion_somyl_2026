import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import DashboardProyecto from './pages/produccion/DashboardProyecto';
import GestionCuadrillas from './pages/produccion/GestionCuadrillas';
import GestionActividades from './pages/produccion/GestionActividades';
import AsignarTareas from './pages/produccion/AsignarTareas';
import Cubicacion from './pages/produccion/Cubicacion';
import GestionZonas from './pages/produccion/GestionZonas';
import GestionDescuentos from './pages/produccion/GestionDescuentos';
import ResumenSubcontrato from './pages/produccion/reportes/ResumenSubcontrato';
import ProduccionActividad from './pages/produccion/reportes/ProduccionActividad';
import EstadosPagos from './pages/produccion/reportes/EstadosPagos';
import ReporteCubicacion from './pages/produccion/reportes/ReporteCubicacion'; // <--- IMPORTAR
import ProjectLayout from './layouts/ProjectLayout';

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
      <main className="pt-14">
        <Routes>
          {/* 1. SELECCIÓN DE PROYECTO (Home) */}
          <Route path="/" element={<Dashboard />} />

          {/* 2. RUTAS DE PROYECTO CON LAYOUT GLOBAL (RIBBON) */}
          <Route path="/proyecto/:projectId" element={<ProjectLayout />}>
            {/* Dashboard del Proyecto (Financial View) */}
            <Route index element={<DashboardProyecto />} />

            {/* Módulos */}
            <Route path="cuadrillas" element={<GestionCuadrillas />} />
            <Route path="actividades" element={<GestionActividades />} />
            <Route path="tareas" element={<AsignarTareas />} />
            <Route path="zonas" element={<GestionZonas />} />
            <Route path="gastos/cuadrillas" element={<GestionDescuentos />} />
            <Route path="cubicaciones" element={<Cubicacion />} />

            {/* Reportes */}
            <Route path="reportes/resumen-subcontrato" element={<ResumenSubcontrato />} />
            <Route path="reportes/produccion-actividad" element={<ProduccionActividad />} />
            <Route path="reportes/estado-pagos" element={<EstadosPagos />} />
            <Route path="reportes/cubicacion" element={<ReporteCubicacion />} />
          </Route>

          {/* 3. RUTAS GLOBALES */}
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