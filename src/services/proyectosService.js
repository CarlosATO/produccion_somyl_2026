// 1. IMPORTANTE: Importar el cliente de Supabase
import { supabase } from './supabaseClient'; 

const API_BASE = '/api/proyectos'; 

export const proyectosService = {
  // 1. Obtener TODOS los proyectos (Backend Python)
  async getProyectos() {
    try {
      const response = await fetch(API_BASE, {
        credentials: 'include'  
      });

      if (response.status === 401) {
        console.error("🔒 Sesión expirada o no iniciada.");
        return [];
      }

      if (!response.ok) {
        throw new Error('Error al conectar con el servidor');
      }

      const data = await response.json();
      return data;

    } catch (error) {
      console.error("❌ Error en proyectosService:", error);
      return []; 
    }
  },

  // 2. Obtener MIS permisos (Backend Python)
  async getMisAccesos(userId) {
    try {
      const response = await fetch(`/api/mis-accesos/${userId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn("⚠️ No se pudieron cargar accesos específicos");
      return [];
    }
  },

  // 3. Obtener UN solo proyecto por ID
  async getById(id) {
    try {
      if (!id) throw new Error('getById: id requerido')

      const response = await fetch(API_BASE, { credentials: 'include' })
      if (!response.ok) throw new Error('Error cargando proyectos desde el servidor')

      const proyectos = await response.json()
      // Buscamos el proyecto específico en la lista devuelta
      const proyecto = proyectos.find(p => String(p.id) === String(id))
      
      if (!proyecto) throw new Error('Proyecto no encontrado')
      return proyecto
    } catch (error) {
      console.error('❌ Error al obtener detalle del proyecto:', error)
      throw error
    }
  },

  // 4. NUEVO: Obtener KPI de avance financiero global (Supabase RPC)
  async getAvanceGlobal(id) {
    // Usamos el cliente importado arriba
    const { data, error } = await supabase
      .rpc('get_kpi_avance_global', { p_proyecto_id: Number(id) })
      .single() // Esperamos una sola fila
    
    if (error) {
      console.error('Error fetching KPI avance:', error)
      return { total_presupuestado: 0, total_ejecutado: 0, porcentaje_avance: 0 }
    }
    return data
  }
  ,
  // 5. NUEVO: Obtener solo nombre e ID (Ultra rápido para el Navbar)
  async getBasico(id) {
    const { data, error } = await supabase
      .rpc('get_proyecto_basico', { p_id: Number(id) });
      // Quitamos .single() aquí para manejar el array manualmente y evitar errores 406/400

    if (error) {
      console.error('Error obteniendo nombre proyecto:', error);
      return null;
    }

    // Si devuelve un array con datos, tomamos el primero
    if (data && data.length > 0) {
        return data[0];
    }
    
    return null;
  }
};