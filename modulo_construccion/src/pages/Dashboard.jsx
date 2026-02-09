import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { proyectosService } from '../services/proyectosService';
import {
  Building2,
  Lock,
  ArrowRight,
  Loader2,
  Search,
  LayoutList,
  Calendar,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [proyectos, setProyectos] = useState([]);
  const [misAccesos, setMisAccesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  // Lógica de Administrador (Temporal)
  const isAdmin = true;

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const dataProyectos = await proyectosService.getProyectos();
      setProyectos(dataProyectos);

      if (!isAdmin) {
        const accesos = await proyectosService.getMisAccesos(user.id);
        setMisAccesos(accesos);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error cargando proyectos.');
    } finally {
      setLoading(false);
    }
  };

  const handleIngresar = (proyecto) => {
    localStorage.setItem('proyecto_activo', JSON.stringify(proyecto));
    navigate(`/proyecto/${proyecto.id}`);
    toast.success(`Ingresando a: ${proyecto.proyecto}`);
  };

  // Filtrado en tiempo real
  const proyectosFiltrados = proyectos.filter(p => {
    // 1. Filtro de Estado ACTIVO (Base de datos)
    // Si el campo 'activo' viene null, asumimos true por defecto (según schema)
    const isActivo = p.activo !== false;
    if (!isActivo) return false;

    // 2. Filtro de Búsqueda de Texto
    const texto = busqueda.toLowerCase();
    return (
      p.proyecto.toLowerCase().includes(texto) ||
      (p.cliente && p.cliente.toLowerCase().includes(texto)) ||
      String(p.id).includes(texto)
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium animate-pulse">Cargando tus proyectos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">

      {/* 1. HEADER HERO */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white pb-24 pt-24 px-6 md:px-10 shadow-lg relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-10 -mb-10 blur-xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <LayoutList className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Panel de Proyectos</h1>
              </div>
              <p className="text-blue-100 text-lg font-light">
                Bienvenido, <span className="font-semibold">{user.full_name}</span>.
              </p>
            </div>

            {/* Buscador Flotante STICKY */}
            <div className="w-full md:w-96 sticky top-20 z-40">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-slate-500 group-focus-within:text-blue-600 transition-colors" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-4 py-3 border-0 rounded-xl leading-5 bg-white text-slate-900 placeholder-slate-500 shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 ease-out font-medium"
                  placeholder="Buscar obra, cliente o ID..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRID DE PROYECTOS */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 -mt-16 relative z-20">

        {proyectosFiltrados.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">No se encontraron proyectos</h3>
            <p className="text-slate-500 mt-2">Intenta ajustar tu búsqueda o verifica los filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proyectosFiltrados.map((proyecto) => {
              const tieneAcceso = isAdmin || misAccesos.includes(proyecto.id);
              const estadoTexto = proyecto.estado_proyecto || (proyecto.activo ? 'En Ejecución' : 'Inactivo');

              return (
                <div
                  key={proyecto.id}
                  onClick={() => tieneAcceso && handleIngresar(proyecto)}
                  className={`group relative bg-white rounded-2xl overflow-hidden border transition-all duration-300 ${tieneAcceso
                    ? 'hover:-translate-y-1 hover:shadow-xl border-slate-200 cursor-pointer'
                    : 'opacity-70 grayscale border-slate-100 cursor-not-allowed'
                    }`}
                >
                  {/* Banda Superior de Estado */}
                  <div className={`h-1.5 w-full ${tieneAcceso ? 'bg-gradient-to-r from-blue-500 to-indigo-600' : 'bg-slate-300'}`}></div>

                  <div className="p-6">
                    {/* Header Card */}
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-xl ${tieneAcceso ? 'bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors' : 'bg-slate-100 text-slate-400'}`}>
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                          #{proyecto.id}
                        </span>
                      </div>
                    </div>

                    {/* Título y Cliente */}
                    <div className="mb-4">
                      <h3 className={`text-lg font-bold leading-tight mb-1 line-clamp-2 ${tieneAcceso ? 'text-slate-800 group-hover:text-blue-700' : 'text-slate-500'}`}>
                        {proyecto.proyecto}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {proyecto.cliente || 'Sin Cliente'}
                        </span>
                      </div>
                    </div>

                    {/* Observación / Info Extra */}
                    <div className="min-h-[2.5rem]">
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                        {proyecto.observacion || 'Sin observaciones registradas.'}
                      </p>
                    </div>
                  </div>

                  {/* Footer Card */}
                  <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between group-hover:bg-blue-50/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${tieneAcceso ? 'bg-green-500' : 'bg-slate-400'} animate-pulse`}></span>
                      <span className={`text-xs font-medium ${tieneAcceso ? 'text-green-700' : 'text-slate-500'}`}>
                        {tieneAcceso ? estadoTexto : 'Acceso Restringido'}
                      </span>
                    </div>

                    {tieneAcceso ? (
                      <button className="text-blue-600 bg-white p-2 rounded-full shadow-sm border border-slate-100 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-md transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <Lock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">
            Mostrando {proyectosFiltrados.length} proyecto(s) activo(s)
          </p>
        </div>
      </div>
    </div>
  );
}