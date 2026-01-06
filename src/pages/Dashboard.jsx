import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { proyectosService } from '../services/proyectosService';
import { Building2, Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();

  const [proyectos, setProyectos] = useState([]);
  const [misAccesos, setMisAccesos] = useState([]); // Lista de IDs permitidos
  const [loading, setLoading] = useState(true);

  // Lógica: ¿Soy Admin? (temporalmente forzado para pruebas)
  const isAdmin = true; // <- TEMPORAL: reemplaza roles?.produccion === 'admin'

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      // 1. Cargamos TODOS los proyectos (Galería)
      const dataProyectos = await proyectosService.getProyectos();
      setProyectos(dataProyectos);

      // 2. Si NO soy admin, busco mis permisos específicos
      if (!isAdmin) {
        const accesos = await proyectosService.getMisAccesos(user.id);
        setMisAccesos(accesos);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error cargando proyectos. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  // Función para entrar al proyecto
  const handleIngresar = (proyecto) => {
    // Guardamos el proyecto seleccionado en LocalStorage para recordarlo mientras navega
    localStorage.setItem('proyecto_activo', JSON.stringify(proyecto));
    
    // Navegamos al menú de reportes (o donde quieras que empiece el trabajo)
    navigate(`/proyecto/${proyecto.id}`);
    toast.success(`Ingresando a: ${proyecto.proyecto}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p>Cargando obras disponibles...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">
          Bienvenido, {user.full_name}
        </h1>
        <p className="text-slate-500 mt-2">
          {isAdmin 
            ? 'Modo Administrador: Tienes acceso total a todos los proyectos.' 
            : 'Selecciona un proyecto asignado para comenzar a trabajar.'}
        </p>
      </div>

      {/* Grid de Proyectos */}
      {proyectos.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-yellow-800">No hay proyectos activos</h3>
          <p className="text-yellow-600">Contacta al administrador para dar de alta obras.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proyectos.map((proyecto) => {
            // VERIFICACIÓN DE PERMISO (El Corazón del Sistema)
            // Entro si: Soy Admin O el ID del proyecto está en mi lista de permitidos
            const tieneAcceso = isAdmin || misAccesos.includes(proyecto.id);

            return (
              <div 
                key={proyecto.id}
                className={`group relative bg-white rounded-xl shadow-sm border transition-all duration-200 ${
                  tieneAcceso 
                    ? 'border-slate-200 hover:shadow-md hover:border-blue-300' 
                    : 'border-slate-100 opacity-70 bg-slate-50'
                }`}
              >
                {/* Etiqueta de Estado */}
                <div className="absolute top-4 right-4">
                  {tieneAcceso ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                      Habilitado
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-200 text-slate-500">
                      <Lock className="w-3 h-3 mr-1" />
                      Restringido
                    </span>
                  )}
                </div>

                <div className="p-6">
                  {/* Icono */}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                    tieneAcceso ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'
                  }`}>
                    <Building2 className="w-6 h-6" />
                  </div>

                  {/* Títulos */}
                  <h3 className={`text-lg font-semibold mb-2 ${tieneAcceso ? 'text-slate-800' : 'text-slate-500'}`}>
                    {proyecto.proyecto}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {proyecto.observacion || 'Sin observaciones.'}
                  </p>

                  {/* Mostrar cliente opcionalmente */}
                  {proyecto.cliente && (
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      Cliente: {proyecto.cliente}
                    </p>
                  )}
                </div>

                {/* Pie de Tarjeta (Botón) */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-xl flex justify-between items-center">
                  <span className="text-xs font-mono text-slate-400">ID: {proyecto.id}</span>
                  
                  <button
                    onClick={() => tieneAcceso && handleIngresar(proyecto)}
                    disabled={!tieneAcceso}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      tieneAcceso
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {tieneAcceso ? 'Ingresar' : 'Sin Acceso'}
                    {tieneAcceso && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}