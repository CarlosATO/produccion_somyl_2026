import React, { useState, useEffect } from 'react';
import { Link, useLocation, matchPath, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { proyectosService } from '../services/proyectosService';
import {
  HardHat,
  LogOut,
  Menu,
  X,
  Building2,
  TrendingUp,
  Bell,
  Clock,
  AlertTriangle,
  ChevronDown,
  Search
} from 'lucide-react';
import { tareasService } from '../services/tareasService';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // PROJECT SWITCHER STATE
  const [allProjects, setAllProjects] = useState([]);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');

  // Cargar lista completa de proyectos para el selector
  useEffect(() => {
    if (user) {
      proyectosService.getProyectos().then(data => {
        if (Array.isArray(data)) setAllProjects(data)
      }).catch(err => console.error("Error loading projects list", err))
    }
  }, [user]);

  // Handle project switch
  const handleSwitchProject = (newProjectId) => {
    setIsProjectMenuOpen(false);
    setProjectSearchTerm('');
    // Mantener la sub-ruta actual pero cambiando el ID del proyecto
    const currentPath = location.pathname;
    const newPath = currentPath.replace(/\/proyecto\/\d+/, `/proyecto/${newProjectId}`);
    navigate(newPath);
  };

  // Filter projects
  const filteredProjects = allProjects.filter(p =>
    p.activo !== false && // Mostrar solo activos
    ((p.proyecto || '').toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
      (p.codigo || '').toLowerCase().includes(projectSearchTerm.toLowerCase()))
  );

  const [currentProject, setCurrentProject] = useState(null);
  const [avance, setAvance] = useState(0);

  useEffect(() => {
    const match = matchPath("/proyecto/:projectId/*", location.pathname);

    if (match && match.params.projectId) {
      const fetchProject = async () => {
        try {
          if (currentProject && currentProject.id === parseInt(match.params.projectId)) return;

          const data = await proyectosService.getById(match.params.projectId);
          setCurrentProject(data);

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
      setCurrentProject(null);
      setAvance(0);
    }
  }, [location.pathname]);

  // --- GLOBAL ALERT LOGIC ---
  const [staleTasks, setStaleTasks] = useState([]);

  const checkStaleTasks = async () => {
    if (!currentProject) return;
    try {
      const tasks = await tareasService.getTareasPorEstado(currentProject.id, 'APROBADA');
      const now = new Date();
      /* 
         Umbral: 12 horas.
         Si updated_at es anterior a (now - 12h), es stale.
      */
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

      const stale = tasks.filter(t => {
        const lastUpdate = new Date(t.updated_at); // Supabase devuelve ISO string
        return lastUpdate < twelveHoursAgo;
      });

      setStaleTasks(stale);
    } catch (e) {
      console.error("Error checking stale tasks", e);
    }
  };

  useEffect(() => {
    // 1. Check initial
    // if (currentProject) checkStaleTasks();

    // 2. Interval Check (every 5 min)
    /* const interval = setInterval(() => {
      if (currentProject) checkStaleTasks();
    }, 5 * 60 * 1000); */

    // 3. Listen for global events
    const handleUpdate = () => {
      // Delay slighty to allow DB propagation
      /* setTimeout(() => {
        if (currentProject) checkStaleTasks();
      }, 500); */
    };

    window.addEventListener('kanban-updated', handleUpdate);

    return () => {
      // clearInterval(interval);
      window.removeEventListener('kanban-updated', handleUpdate);
    };
  }, [currentProject]);

  return (
    <nav className="bg-slate-900 text-white shadow-md fixed top-0 w-full z-50 transition-all duration-300 h-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-6 h-full">
        <div className="flex items-center justify-between h-full">

          {/* LEFT: BRAND & CONTEXT */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-1.5 text-decoration-none text-white hover:text-slate-200 transition-colors">
              <div className="bg-blue-600 p-1 rounded-md">
                <HardHat className="h-4 w-4 text-white" />
              </div>
              {!currentProject && <span className="font-bold text-lg tracking-tight">Portal Somyl</span>}
            </Link>

            {currentProject && <div className="h-6 w-px bg-slate-700 mx-1 hidden md:block"></div>}

            {currentProject && (
              <div className="hidden md:block relative">
                <button
                  onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                  className="flex flex-col items-start leading-tight hover:bg-slate-800 rounded px-2 py-1 transition-colors group text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm tracking-wide text-white group-hover:text-blue-400 transition-colors">
                      {currentProject.proyecto}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isProjectMenuOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <span className="bg-slate-800 text-slate-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 mt-0.5 group-hover:border-slate-600 transition-colors">
                    OT: {currentProject.codigo || 'S/N'}
                  </span>
                </button>

                {/* DROPDOWN MENU */}
                {isProjectMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProjectMenuOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      {/* Search Header */}
                      <div className="p-2 border-b border-slate-700 bg-slate-900/50">
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Buscar proyecto..."
                            className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                            autoFocus
                            value={projectSearchTerm}
                            onChange={(e) => setProjectSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>

                      {/* Projects List */}
                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {filteredProjects.length > 0 ? (
                          filteredProjects.map(p => (
                            <button
                              key={p.id}
                              onClick={() => handleSwitchProject(p.id)}
                              className={`w-full text-left px-3 py-2.5 hover:bg-slate-700/50 transition-colors border-l-2 flex flex-col ${p.id === currentProject.id
                                ? 'bg-blue-900/10 border-blue-500'
                                : 'border-transparent'
                                }`}
                            >
                              <span className={`text-xs font-bold ${p.id === currentProject.id ? 'text-blue-400' : 'text-slate-200'}`}>
                                {p.proyecto}
                              </span>
                              <span className="text-[10px] text-slate-500 mt-0.5">
                                OT: {p.codigo || 'S/N'}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-500 text-xs">
                            No se encontraron proyectos
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* CENTER: ALERTS */}
          {staleTasks.length > 0 && (
            <div className="hidden md:flex items-center gap-2 bg-red-500/10 border border-red-500/50 rounded-lg px-3 py-1 animate-pulse">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-xs font-bold text-red-200">
                {staleTasks.length} {staleTasks.length === 1 ? 'tarea' : 'tareas'} por validar ({'>'}12h)
              </span>
            </div>
          )}

          {/* RIGHT: USER PROFILE */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold text-white m-0">{user?.nombre || user?.full_name || 'Usuario'}</p>
              <p className="text-[10px] text-slate-400 m-0">{user?.email}</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-xs font-bold text-slate-300">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* MOBILE MENU TOGGLE */}
          <div className="flex md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE DROPDOWN */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-800 border-t border-slate-700 absolute w-full left-0 top-14">
          <div className="px-4 py-3 space-y-3">
            {currentProject && (
              <div className="pb-3 border-b border-slate-700">
                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Proyecto Activo</p>
                <p className="text-white font-medium">{currentProject.proyecto}</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="bg-slate-700 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-white font-medium">{user?.full_name}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-red-400 bg-slate-900/50 hover:bg-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}