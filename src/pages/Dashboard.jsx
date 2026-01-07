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
  LayoutList 
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [proyectos, setProyectos] = useState([]);
  const [misAccesos, setMisAccesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState(""); // Estado para el buscador

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
    const texto = busqueda.toLowerCase();
    return (
      p.proyecto.toLowerCase().includes(texto) ||
      (p.cliente && p.cliente.toLowerCase().includes(texto)) ||
      String(p.id).includes(texto)
    );
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p>Cargando listado de obras...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      
      {/* 1. ENCABEZADO Y BUSCADOR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutList className="w-6 h-6 text-blue-600" />
            Panel de Proyectos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Hola, {user.full_name}. Selecciona una obra para gestionar.
          </p>
        </div>

        {/* Barra de Búsqueda */}
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition duration-150 ease-in-out"
            placeholder="Buscar por nombre, cliente o ID..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* 2. TABLA DE PROYECTOS */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Encabezados de Tabla */}
        <div className="grid grid-cols-12 gap-4 bg-slate-50 px-6 py-3 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-1">ID</div>
          <div className="col-span-4">Proyecto</div>
          <div className="col-span-3">Cliente / Info</div>
          <div className="col-span-2 text-center">Estado</div>
          <div className="col-span-2 text-end">Acción</div>
        </div>

        {/* Filas */}
        <div className="divide-y divide-slate-100">
          {proyectosFiltrados.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No se encontraron proyectos que coincidan con tu búsqueda.
            </div>
          ) : (
            proyectosFiltrados.map((proyecto) => {
              const tieneAcceso = isAdmin || misAccesos.includes(proyecto.id);

              return (
                <div 
                  key={proyecto.id}
                  onClick={() => tieneAcceso && handleIngresar(proyecto)}
                  className={`grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors duration-150 ${
                    tieneAcceso 
                      ? 'hover:bg-blue-50 cursor-pointer' 
                      : 'bg-slate-50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* ID */}
                  <div className="col-span-1 text-slate-400 font-mono text-xs">
                    #{proyecto.id}
                  </div>

                  {/* Nombre Proyecto */}
                  <div className="col-span-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${tieneAcceso ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className={`text-sm font-semibold ${tieneAcceso ? 'text-slate-800' : 'text-slate-500'}`}>
                          {proyecto.proyecto}
                        </h4>
                        {/* Móvil: Mostrar observación truncada si es necesario */}
                        <p className="text-xs text-slate-400 line-clamp-1 md:hidden">
                          {proyecto.cliente}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Cliente / Observación */}
                  <div className="col-span-3 text-sm text-slate-500">
                    <div className="font-medium text-slate-700">
                      {proyecto.cliente || '—'}
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-[200px]" title={proyecto.observacion}>
                      {proyecto.observacion || ''}
                    </div>
                  </div>

                  {/* Estado (Badge) */}
                  <div className="col-span-2 flex justify-center">
                    {tieneAcceso ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600 border border-slate-300">
                        <Lock className="w-3 h-3 mr-1" />
                        Restringido
                      </span>
                    )}
                  </div>

                  {/* Botón Acción */}
                  <div className="col-span-2 flex justify-end">
                    <button
                      disabled={!tieneAcceso}
                      className={`p-2 rounded-full transition-all ${
                        tieneAcceso 
                          ? 'text-blue-600 hover:bg-blue-200' 
                          : 'text-slate-400'
                      }`}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      <div className="mt-4 text-xs text-slate-400 text-right">
        Mostrando {proyectosFiltrados.length} de {proyectos.length} proyectos
      </div>
    </div>
  );
}