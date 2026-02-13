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

    return data
  },

  // Guarda explícitamente el global (zona_id = null) borrando anterior para evitar duplicados por tema de NULL UNIQUE
  async guardarCubicacionGlobal(payload) {
    // 1. Borrar previo (zona_id IS NULL)
    let query = supabase.from('prod_cubicaciones').delete().is('zona_id', null).eq('proyecto_id', payload.proyecto_id)

    if (payload.actividad_id) query = query.eq('actividad_id', payload.actividad_id)
    else if (payload.sub_actividad_id) query = query.eq('sub_actividad_id', payload.sub_actividad_id)

    const { error: delError } = await query
    if (delError) console.error("Error borrando global anterior", delError)

    // 2. Insertar nuevo
    const newPayload = { ...payload, zona_id: null }
    if (newPayload.actividad_id) delete newPayload.sub_actividad_id
    else delete newPayload.actividad_id

    // Si la cantidad es 0, quizás no necesitemos insertar, pero para consistencia insertamos
    const { data, error } = await supabase.from('prod_cubicaciones').insert(newPayload).select()
    if (error) throw error
    return data
  }
}