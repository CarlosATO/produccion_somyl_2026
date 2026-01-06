// AJUSTA ESTA IMPORTACIÓN SEGÚN DONDE TENGAS TU CLIENTE:
// Si está en src/supabase/client.js usa:
import { supabase } from './supabaseClient'
// Si está en src/supabaseClient.js usa:
// import { supabase } from '../supabaseClient'

export const cuadrillasService = {

  // 1. Obtener lista de Proveedores Disponibles
  async getProveedoresSubcontratos() {
    try {
      // CORRECCIÓN 1: Usamos .from() en lugar de .table()
      // CORRECCIÓN 2: Pedimos 'nombre' en vez de 'razon_social'
      const { data, error } = await supabase
        .from('proveedores') 
        .select('id, nombre, rut, subcontrato')
        .order('nombre')

      if (error) throw error

      // --- FILTRO CORREGIDO ---
      // Tu base de datos devuelve el NÚMERO 1.
      // Usamos '==' (doble igual) para aceptar tanto 1 como "1".
      const soloSubcontratos = data.filter(p => p.subcontrato == 1);

      console.log(`📦 Total descargados: ${data.length}`);
      console.log(`✅ Subcontratos encontrados: ${soloSubcontratos.length}`);
      
      return soloSubcontratos; 

    } catch (error) {
      console.error('Error buscando proveedores:', error)
      return []
    }
  },

  // 2. Obtener las Cuadrillas YA asignadas a un proyecto
  async getCuadrillasProyecto(proyectoId) {
    try {
      const { data, error } = await supabase
        .from('prod_cuadrillas_proyecto') // <--- CORREGIDO .from()
        .select(`
          id,
          alias,
          activo,
          fecha_ingreso,
          proveedor:proveedores (id, nombre, rut),
          trabajadores:prod_trabajadores (count)
        `)
        .eq('proyecto_id', proyectoId)
        .order('id')

      if (error) throw error
      
      return data.map(item => ({
        ...item,
        total_trabajadores: item.trabajadores ? item.trabajadores[0].count : 0
      }))

    } catch (error) {
      console.error('Error cargando cuadrillas del proyecto:', error)
      return []
    }
  },

  // 3. Asignar una nueva cuadrilla al proyecto
  async asignarCuadrilla(proyectoId, proveedorId, alias) {
    const { data, error } = await supabase
      .from('prod_cuadrillas_proyecto') // <--- CORREGIDO .from()
      .insert({
        proyecto_id: proyectoId,
        proveedor_id: proveedorId,
        alias: alias || null,
        activo: true
      })
      .select()

    if (error) throw error
    return data[0]
  },

  // 4. Eliminar (desvincular) una cuadrilla del proyecto
  async eliminarCuadrilla(id) {
    const { error } = await supabase
      .from('prod_cuadrillas_proyecto') // <--- CORREGIDO .from()
      .delete()
      .eq('id', id)
    
    if (error) throw error
    return true
  },

  // --- GESTIÓN DE TRABAJADORES ---

  // 5. Obtener trabajadores de una cuadrilla específica
  async getTrabajadores(cuadrillaProyectoId) {
    try {
      const { data, error } = await supabase
        .from('prod_trabajadores') // <--- CORREGIDO .from()
        .select('*')
        .eq('cuadrilla_proyecto_id', cuadrillaProyectoId)
        .order('nombre_completo')

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error cargando trabajadores:', error)
      return []
    }
  },

  // 6. Guardar Trabajador (Crear o Editar)
  async guardarTrabajador(trabajador) {
    if (trabajador.id) {
      // UPDATE
      const { data, error } = await supabase
        .from('prod_trabajadores') // <--- CORREGIDO .from()
        .update({
            nombre_completo: trabajador.nombre_completo,
            rut: trabajador.rut,
            cargo: trabajador.cargo,
            activo: trabajador.activo
        })
        .eq('id', trabajador.id)
        .select()
      
      if (error) throw error
      return data[0]

    } else {
      // INSERT
      const { data, error } = await supabase
        .from('prod_trabajadores') // <--- CORREGIDO .from()
        .insert({
            cuadrilla_proyecto_id: trabajador.cuadrilla_proyecto_id,
            nombre_completo: trabajador.nombre_completo,
            rut: trabajador.rut,
            cargo: trabajador.cargo,
            activo: true
        })
        .select()

      if (error) throw error
      return data[0]
    }
  },

  // 7. Eliminar Trabajador
  async eliminarTrabajador(id) {
    const { error } = await supabase
      .from('prod_trabajadores') // <--- CORREGIDO .from()
      .delete()
      .eq('id', id)
      
    if (error) throw error
    return true
  }
}