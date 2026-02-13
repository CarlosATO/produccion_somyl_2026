import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { proyectosService } from '../services/proyectosService';
import {
  Building2,
  Lock,
  ArrowRight,
  Loader2,
  Search,
  LayoutGrid,
  List,
  Briefcase,
  TrendingUp,
  AlertCircle,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from 'react-bootstrap';

// Standard Card for Grid View (Others)
const ProyectoCard = ({ proyecto, isFav, toggleFavorito, tieneAcceso, handleIngresar, avance }) => {
  const isActivo = proyecto.activo !== false;

  return (
    <div
      onClick={() => tieneAcceso && handleIngresar(proyecto)}
      className={`group bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 relative overflow-hidden flex flex-col ${!tieneAcceso ? 'opacity-60 grayscale' : 'cursor-pointer'}`}
    >
      <div className="absolute top-3 right-3 z-10">
        <button
          onClick={(e) => toggleFavorito(proyecto.id, e)}
          className={`p-1.5 rounded-full transition-all ${isFav ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100' : 'bg-slate-50 text-slate-300 hover:text-yellow-400 hover:bg-slate-100'}`}
          title={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          <Star size={18} fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-4 pr-8">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActivo ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">{proyecto.proyecto}</h3>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wide flex items-center gap-1 mt-0.5">
                <Briefcase size={10} />
                {proyecto.cliente || 'Sin Cliente'}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <Badge bg={isActivo ? 'success' : 'secondary'} className="text-[10px] px-2 py-0.5 font-bold">
            {isActivo ? 'ACTIVO' : 'INACTIVO'}
          </Badge>
        </div>

        {/* Progress Section */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500 font-medium">Avance Financiero</span>
            <span className="text-slate-800 font-bold">{avance ? `${avance.porcentaje_avance}%` : '-'}</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            {avance ? (
              <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${avance.porcentaje_avance}%` }}></div>
            ) : (
              <div className={`h-full bg-slate-200 rounded-full ${isActivo ? 'animate-pulse w-1/3' : 'w-full'}`}></div>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-400 line-clamp-2 min-h-[2.5em]">
          {proyecto.observacion || 'Sin observaciones registradas para este proyecto.'}
        </div>
      </div>

      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
        <span className="text-xs font-mono text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">ID: {proyecto.id}</span>
        {tieneAcceso ? (
          <div className="flex items-center gap-1 text-blue-600 text-xs font-bold group-hover:translate-x-1 transition-transform">
            INGRESAR <ArrowRight size={14} />
          </div>
        ) : <Lock size={14} className="text-slate-400" />}
      </div>
    </div>
  );
};

// Compact Card for Favorites
const CompactProyectoCard = ({ proyecto, toggleFavorito, tieneAcceso, handleIngresar, avance }) => {
  const isActivo = proyecto.activo !== false;

  return (
    <div
      onClick={() => tieneAcceso && handleIngresar(proyecto)}
      className={`group bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 relative overflow-hidden flex items-center p-3 gap-3 ${!tieneAcceso ? 'opacity-60 grayscale' : 'cursor-pointer'}`}
    >
      {/* Icon Area */}
      <div className={`w-10 h-10 min-w-[2.5rem] rounded-lg flex items-center justify-center ${isActivo ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
        <Building2 size={18} />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <h3 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-blue-600 transition-colors truncate pr-6">{proyecto.proyecto}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="truncate max-w-[120px] font-medium">{proyecto.cliente}</span>
          <span className="text-slate-300">•</span>
          <span className={`${isActivo ? 'text-green-600' : 'text-slate-400'}`}>{isActivo ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>

      {/* Progress & Action Area */}
      <div className="flex flex-col items-end gap-1.5 min-w-[60px]">
        {/* Star Button */}
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => toggleFavorito(proyecto.id, e)}
            className="text-yellow-500 hover:text-yellow-600 transition-colors"
            title="Quitar de favoritos"
          >
            <Star size={14} fill="currentColor" />
          </button>
        </div>

        <div className="flex items-center gap-1 mt-3">
          <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${avance?.porcentaje_avance || 0}%` }}></div>
          </div>
          <span className="text-[10px] font-bold text-slate-600">{avance ? `${Math.round(avance.porcentaje_avance)}%` : '0%'}</span>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [proyectos, setProyectos] = useState([]);
  const [misAccesos, setMisAccesos] = useState([]); // eslint-disable-line no-unused-vars
  const [avances, setAvances] = useState({}); // Cache de avances { id: { porcentaje_avance: 0, ... } }
  const [loading, setLoading] = useState(true);

  // UI State
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list' - Por defecto lista
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState('activos'); // 'todos' | 'activos' | 'inactivos' - Por defecto solo activos

  // Favoritos State
  const [favoritos, setFavoritos] = useState([]);

  const isAdmin = true; // Temporal, lógica real pendiente

  // Clave para localStorage basada en el usuario
  // Aseguramos que sea consistente incluso si user.id es numérico o string
  // const RAV_FAVORITOS_KEY = `somyl_construccion_favs_${user?.id}`;

  useEffect(() => {
    cargarDatos();
    cargarFavoritos();
  }, [user?.id]);

  const cargarFavoritos = () => {
    try {
      if (user?.id) {
        const storedFavs = localStorage.getItem(`somyl_construccion_favs_${user.id}`);
        if (storedFavs) {
          const parsed = JSON.parse(storedFavs);
          // Asegurar que todos sean strings para comparación consistente
          setFavoritos(parsed.map(id => String(id)));
        }
      }
    } catch (error) {
      console.warn("Error cargando favoritos", error);
    }
  };

  const toggleFavorito = useCallback((id, e) => {
    e.stopPropagation(); // Evitar navegar al hacer click en la estrella
    const idStr = String(id);

    setFavoritos(prevFavoritos => {
      let nuevosFavoritos;
      if (prevFavoritos.includes(idStr)) {
        nuevosFavoritos = prevFavoritos.filter(favId => favId !== idStr);
        toast.info("Proyecto eliminado de favoritos");
      } else {
        nuevosFavoritos = [...prevFavoritos, idStr];
        toast.success("Proyecto añadido a favoritos");
      }

      // Guardar en localStorage inmediatamente con el nuevo estado calculado
      if (user?.id) {
        localStorage.setItem(`somyl_construccion_favs_${user.id}`, JSON.stringify(nuevosFavoritos));
      }

      return nuevosFavoritos;
    });
  }, [user?.id]);

  const cargarDatos = async () => {
    try {
      const dataProyectos = await proyectosService.getProyectos();
      setProyectos(dataProyectos);

      if (!isAdmin) {
        const accesos = await proyectosService.getMisAccesos(user.id);
        setMisAccesos(accesos);
      }

      // Cargar avances en background (Lazy Loading)
      cargarAvancesBackground(dataProyectos);

    } catch (error) {
      console.error(error);
      toast.error('Error cargando proyectos.');
    } finally {
      setLoading(false);
    }
  };

  const cargarAvancesBackground = async (listaProyectos) => {
    // Cargar uno por uno para no saturar, priorizando los activos
    for (const p of listaProyectos) {
      if (p.activo !== false) {
        try {
          const kpi = await proyectosService.getAvanceGlobal(p.id);
          setAvances(prev => ({ ...prev, [p.id]: kpi }));
        } catch (e) {
          console.warn(`No se pudo cargar avance para ${p.id}`);
        }
      }
    }
  };

  const handleIngresar = useCallback((proyecto) => {
    localStorage.setItem('proyecto_activo', JSON.stringify(proyecto));
    navigate(`/proyecto/${proyecto.id}`);
    toast.success(`Ingresando a: ${proyecto.proyecto}`);
  }, [navigate]);

  // KPI CALCULATIONS
  const stats = useMemo(() => {
    const total = proyectos.length;
    const activos = proyectos.filter(p => p.activo !== false).length;
    // Críticos: Activos con menos del 10% avance pero iniciado (>0)
    const criticos = proyectos.filter(p => {
      const pAvance = avances[p.id]?.porcentaje_avance || 0;
      return p.activo !== false && pAvance < 10 && pAvance > 0;
    }).length;
    return { total, activos, criticos };
  }, [proyectos, avances]);

  // FILTERING & SPLITTING (Favoritos vs Otros)
  const { proyectosFavoritos, proyectosOtros } = useMemo(() => {
    // Primero filtrar por búsqueda y estado
    const filtrados = proyectos.filter(p => {
      const isActive = p.activo !== false;

      // 1. Filtro Estado
      if (filtroEstado === 'activos' && !isActive) return false;
      if (filtroEstado === 'inactivos' && isActive) return false;

      // 2. Búsqueda
      const texto = busqueda.toLowerCase();
      return (
        p.proyecto?.toLowerCase().includes(texto) ||
        (p.cliente && p.cliente.toLowerCase().includes(texto)) ||
        String(p.id).includes(texto)
      );
    });

    // Luego separar en favoritos y otros
    const favs = [];
    const otros = [];

    filtrados.forEach(p => {
      // Comparison: ensure consistent string comparison
      if (favoritos.includes(String(p.id))) {
        favs.push(p);
      } else {
        otros.push(p);
      }
    });

    return { proyectosFavoritos: favs, proyectosOtros: otros };
  }, [proyectos, busqueda, filtroEstado, favoritos]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Cargando portafolio...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-inter">

      {/* 1. HERO HEADER KPI */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Panel de Control</h1>
              <p className="text-slate-500 text-sm">Bienvenido de nuevo, <span className="font-semibold text-slate-700">{user.full_name}</span>.</p>
            </div>

            {/* KPI CARDS MINI */}
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full text-blue-600"><Building2 size={18} /></div>
                <div>
                  <div className="text-2xl font-bold text-blue-700 leading-none">{stats.activos}</div>
                  <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Activos</div>
                </div>
              </div>
              <div className="px-4 py-2 bg-green-50 border border-green-100 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full text-green-600"><TrendingUp size={18} /></div>
                <div>
                  <div className="text-2xl font-bold text-green-700 leading-none">{stats.total}</div>
                  <div className="text-[10px] uppercase font-bold text-green-400 tracking-wider">Total</div>
                </div>
              </div>
              <div className="px-4 py-2 bg-orange-50 border border-orange-100 rounded-lg flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-full text-orange-600"><AlertCircle size={18} /></div>
                <div>
                  <div className="text-2xl font-bold text-orange-700 leading-none">{stats.criticos}</div>
                  <div className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">Críticos</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* 2. TOOLBAR */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          {/* Buscador */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar por nombre, cliente o ID..."
              className="w-full pl-10 pr-4 py-2 text-sm border-0 focus:ring-0 text-slate-700 placeholder-slate-400 outline-none"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 px-2 border-l border-slate-100 pl-4">
            {/* Filtro Estado */}
            <select
              className="text-sm border-slate-200 rounded-lg focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-2 pr-8 outline-none"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="todos">Todos los Estados</option>
              <option value="activos">Sólo Activos</option>
              <option value="inactivos">Inactivos / Finalizados</option>
            </select>

            {/* View Toggles */}
            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Cuadrícula"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Lista"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. CONTENT AREA */}

        {/* SECTION: FAVORITOS (Always Compact Grid) */}
        {proyectosFavoritos.length > 0 && (
          <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-2 mb-4 px-1">
              <Star className="text-yellow-500 fill-yellow-500" size={20} />
              <h2 className="text-lg font-bold text-slate-700">Proyectos Favoritos</h2>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{proyectosFavoritos.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {proyectosFavoritos.map(proyecto => (
                <CompactProyectoCard
                  key={proyecto.id}
                  proyecto={proyecto}
                  toggleFavorito={toggleFavorito}
                  tieneAcceso={isAdmin}
                  handleIngresar={handleIngresar}
                  avance={avances[proyecto.id]}
                />
              ))}
            </div>

            {/* Divider if there are more projects */}
            {proyectosOtros.length > 0 && (
              <div className="mt-10 mb-6 border-b border-slate-200 relative">
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-slate-50 px-4 text-xs font-medium text-slate-400 uppercase tracking-widest">
                  Otros Proyectos
                </span>
              </div>
            )}
          </div>
        )}

        {/* SECTION: OTROS PROYECTOS */}
        {proyectosOtros.length === 0 && proyectosFavoritos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-slate-600 font-medium">No se encontraron proyectos</h3>
            <p className="text-slate-400 text-sm">Prueba ajustando los filtros de búsqueda o estado</p>
          </div>
        ) : (
          proyectosOtros.length > 0 && (
            viewMode === 'grid' ? (
              // --- GRID VIEW (OTROS) ---
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {proyectosOtros.map(proyecto => (
                  <ProyectoCard
                    key={proyecto.id}
                    proyecto={proyecto}
                    isFav={false}
                    toggleFavorito={toggleFavorito}
                    tieneAcceso={isAdmin}
                    handleIngresar={handleIngresar}
                    avance={avances[proyecto.id]}
                  />
                ))}
              </div>
            ) : (
              // --- LIST VIEW (OTROS) ---
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 w-10"></th> {/* Star Column */}
                      <th className="px-6 py-4 w-20">ID</th>
                      <th className="px-6 py-4">Proyecto</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 w-48">Avance</th>
                      <th className="px-6 py-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proyectosOtros.map(proyecto => {
                      const tieneAcceso = isAdmin;
                      const isActivo = proyecto.activo !== false;
                      const avance = avances[proyecto.id];
                      // isFav is always false in this list because we filtered them out

                      return (
                        <tr key={proyecto.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="pl-6 pr-0 py-4 w-10">
                            <button
                              onClick={(e) => toggleFavorito(proyecto.id, e)}
                              className="p-1.5 rounded-full text-slate-300 hover:text-yellow-400 hover:bg-slate-100 transition-all"
                              title="Añadir a favoritos"
                            >
                              <Star size={18} />
                            </button>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-400 text-xs">#{proyecto.id}</td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{proyecto.proyecto}</div>
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1 max-w-[200px]">{proyecto.observacion}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{proyecto.cliente}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${isActivo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isActivo ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                              {isActivo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                {avance ? (
                                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${avance.porcentaje_avance}%` }}></div>
                                ) : (
                                  <div className={`h-full bg-slate-200 rounded-full ${isActivo ? 'animate-pulse w-1/3' : 'w-full'}`}></div>
                                )}
                              </div>
                              <span className="text-xs font-bold text-slate-600 w-8 text-right">{avance ? `${avance.porcentaje_avance}%` : '-'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => tieneAcceso && handleIngresar(proyecto)}
                              disabled={!tieneAcceso}
                              className={`p-2 rounded-lg border transition-all ${tieneAcceso ? 'bg-white border-slate-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200' : 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed'}`}
                              title="Ingresar al proyecto"
                            >
                              <ArrowRight size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}