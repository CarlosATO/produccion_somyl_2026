// ELIMINAMOS la URL fija para usar el Proxy de Vite (igual que en usuariosService)
const API_BASE = '/api/proyectos'; 

export const proyectosService = {
  // 1. Obtener TODOS los proyectos (Lógica original con Python)
  async getProyectos() {
    try {
      // IMPORTANTE: { credentials: 'include' } es la clave para que Python te reconozca
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
      console.log("✅ Proyectos recibidos:", data.length);
      return data;

    } catch (error) {
      console.error("❌ Error en proyectosService:", error);
      return []; 
    }
  },

  // 2. Obtener MIS permisos (Lógica original con Python)
  async getMisAccesos(userId) {
    try {
      // También aquí usamos credenciales
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

  // 3. Obtener UN solo proyecto por ID (usa la API del backend)
  // Evita problemas de RLS/keys del cliente Supabase en el navegador.
  async getById(id) {
    try {
      if (!id) throw new Error('getById: id requerido')

      const response = await fetch(API_BASE, { credentials: 'include' })
      if (!response.ok) throw new Error('Error cargando proyectos desde el servidor')

      const proyectos = await response.json()
      const proyecto = proyectos.find(p => String(p.id) === String(id))
      if (!proyecto) throw new Error('Proyecto no encontrado')
      return proyecto
    } catch (error) {
      console.error('❌ Error al obtener detalle del proyecto:', error)
      throw error
    }
  },
};