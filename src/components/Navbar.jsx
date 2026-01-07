import React, { useState, useEffect } from 'react';
import { Link, useLocation, matchPath } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Asegúrate de que esta ruta sea correcta
import { proyectosService } from '../services/proyectosService'; // Importamos el servicio
import { 
  HardHat, 
  LogOut, 
  Menu,
  X,
  Building2,
  TrendingUp
} from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Estado para guardar la info del proyecto actual
  const [currentProject, setCurrentProject] = useState(null);
  const [avance, setAvance] = useState(0);

  // EFECTO: Detectar si estamos dentro de un proyecto y cargar su data
  useEffect(() => {
    // Verificamos si la URL coincide con el patrón de proyecto
    const match = matchPath("/proyecto/:projectId/*", location.pathname);
    
    if (match && match.params.projectId) {
      const fetchProject = async () => {
        try {
          // Evitamos recargar si ya tenemos el mismo proyecto
          if (currentProject && currentProject.id === parseInt(match.params.projectId)) return;
          
          const data = await proyectosService.getById(match.params.projectId);
          setCurrentProject(data);
          
          // Cargar avance usando la función RPC
          const kpi = await proyectosService.getAvanceGlobal(match.params.projectId);
          if (kpi && kpi.porcentaje_avance !== undefined) {
            setAvance(Number(kpi.porcentaje_avance) || 0);
          }
        } catch (error) {
          console.error("Error cargando info de proyecto en navbar", error);
        }
      };
      fetchProject();
    } else {
      // Si salimos a la home, limpiamos el proyecto actual
      setCurrentProject(null);
      setAvance(0);
    }
  }, [location.pathname]);

  return (
    <nav className="bg-slate-900 text-white shadow-lg sticky-top" style={{zIndex: 1030}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* SECCIÓN IZQUIERDA: LOGO O CONTEXTO DE PROYECTO */}
          <div className="flex items-center gap-4">
            
            {/* Logo General (Siempre visible) */}
            <Link to="/" className="flex items-center gap-2 text-decoration-none text-white">
              <div className="bg-blue-600 p-2 rounded-lg">
                <HardHat className="h-6 w-6 text-white" />
              </div>
              {!currentProject && <span className="font-bold text-xl tracking-tight">Portal Somyl</span>}
            </Link>

            {/* SEPARADOR */}
            {currentProject && <div className="h-8 w-px bg-slate-700 mx-2 hidden md:block"></div>}

            {/* INFO DEL PROYECTO ACTUAL (Solo si estamos dentro de uno) */}
            {currentProject && (
              <div className="hidden md:flex flex-col animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  <span className="font-bold text-sm md:text-base tracking-wide text-white">
                    {currentProject.proyecto}
                  </span>
                  <span className="bg-blue-900 text-blue-200 text-xs px-2 py-0.5 rounded-full border border-blue-700">
                    OT: {currentProject.codigo || 'S/N'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <TrendingUp className="h-3 w-3 text-green-400" />
                  <span className="text-xs text-slate-400">
                    Avance Actual: <span className="text-green-400 font-bold">{Number.isFinite(avance) ? avance.toFixed(1).replace('.', ',') : '0,0'}%</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* PERFIL Y LOGOUT */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white m-0">{user?.nombre || user?.full_name || 'Usuario'}</p>
              <p className="text-xs text-slate-400 m-0">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors border-0 bg-transparent"
              title="Cerrar Sesión"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          {/* MENÚ MÓVIL (HAMBURGUESA) */}
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none border-0 bg-transparent"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* DESPLEGABLE MÓVIL */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-800 border-t border-slate-700">
          <div className="px-4 pt-4 pb-2">
            {currentProject && (
               <div className="mb-4 pb-4 border-b border-slate-700">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Proyecto Activo</p>
                  <p className="text-white font-bold text-lg">{currentProject.proyecto}</p>
                  <p className="text-slate-300 text-sm">Avance: {Number.isFinite(avance) ? avance.toFixed(1).replace('.', ',') : '0,0'}%</p>
               </div>
            )}
            
            <div className="flex items-center gap-3 mb-3">
               <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold">
                  {user?.email?.charAt(0).toUpperCase()}
               </div>
               <div>
                 <p className="text-white font-medium">{user?.full_name || 'Usuario'}</p>
                 <p className="text-slate-400 text-xs">{user?.email}</p>
               </div>
            </div>

            <button
              onClick={logout}
              className="w-full flex items-center px-3 py-3 rounded-md text-base font-medium text-red-400 bg-slate-900/50 hover:bg-slate-900 transition-colors border-0"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}