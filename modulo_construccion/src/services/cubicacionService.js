import { supabase } from './supabaseClient'

export const cubicacionService = {

  // --- GESTIÓN DE ZONAS (Columnas) ---

  async getZonas(proyectoId) {
    const { data, error } = await supabase
      .from('prod_zonas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('id', { ascending: true })
    if (error) throw error
    return data
  },

  async crearZona(zona) {
    const { data, error } = await supabase
      .from('prod_zonas')
      .insert(zona)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async eliminarZona(id) {
    const { error } = await supabase.from('prod_zonas').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // --- GESTIÓN DE CUBICACIONES (Celdas) ---

  // Obtiene todas las cantidades guardadas para pintar la matriz
  async getCubicaciones(proyectoId) {
    const { data, error } = await supabase
      .from('prod_cubicaciones')
      .select(`
        *,
        actividad:prod_actividades(id, nombre, unidad, valor_venta),
        sub_actividad:prod_sub_actividades(id, nombre, unidad, valor_venta)
      `)
      .eq('proyecto_id', proyectoId)
    if (error) throw error
    return data
  },

  // Guarda o actualiza una celda específica (Upsert)
  async guardarCubicacion(payload) {
    // Eliminar el otro campo de ID para evitar basura
    if (payload.actividad_id) delete payload.sub_actividad_id
    else delete payload.actividad_id

    try {
      const { data, error } = await supabase
        .from('prod_cubicaciones')
        .upsert(payload, {
          onConflict: payload.actividad_id ? 'zona_id, actividad_id' : 'zona_id, sub_actividad_id'
        })
        .select()

      if (error) throw error
      return data
    } catch (err) {
      console.warn("Upsert failed, trying manual delete+insert fallback", err)

      // Fallback: Borrar anterior (si existe) e insertar nuevo
      const match = {
        proyecto_id: payload.proyecto_id,
        zona_id: payload.zona_id
      }
      if (payload.actividad_id) match.actividad_id = payload.actividad_id
      else match.sub_actividad_id = payload.sub_actividad_id

      await supabase.from('prod_cubicaciones').delete().match(match)

      const { data, error } = await supabase
        .from('prod_cubicaciones')
        .insert(payload)
        .select()

      if (error) throw error
      return data
    }
  },

  // Borra todo lo de este proyecto
  async eliminarTodo(proyectoId) {
    const { error } = await supabase
      .from('prod_cubicaciones')
      .delete()
      .eq('proyecto_id', proyectoId)
    if (error) throw error
    return true
  },

  // Mantenemos esto por si acaso, aunque ya no se use en la UI actual
  async guardarCubicacionGlobal(payload) {
    const { error } = await supabase
      .from('prod_cubicaciones')
      .delete()
      .is('zona_id', null)
      .eq('proyecto_id', payload.proyecto_id)
      .match(payload.actividad_id ? { actividad_id: payload.actividad_id } : { sub_actividad_id: payload.sub_actividad_id })

    if (error) console.error("Error cleaning global", error)

    const { data, error: insError } = await supabase.from('prod_cubicaciones').insert({ ...payload, zona_id: null }).select()
    if (insError) throw insError
    return data
  }
}