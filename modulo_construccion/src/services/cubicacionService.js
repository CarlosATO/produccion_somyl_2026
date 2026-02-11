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
    // payload: { proyecto_id, zona_id, cantidad, actividad_id?, sub_actividad_id? }

    // Limpieza de IDs para evitar ambigüedad en la BD
    if (payload.actividad_id) delete payload.sub_actividad_id
    else delete payload.actividad_id

    // 1. INTENTO CON UPSERT (Ahora sí funcionará gracias a los índices SQL)
    const { data, error } = await supabase
      .from('prod_cubicaciones')
      .upsert(payload, {
        ignoreDuplicates: false,
        onConflict: payload.actividad_id ? 'zona_id, actividad_id' : 'zona_id, sub_actividad_id'
      })
      .select()

    if (error) {
      console.warn("Upsert falló, intentando delete+insert manual...", error)

      // 2. FALLBACK (Plan B): Borrar y reinsertar
      const match = { zona_id: payload.zona_id }
      if (payload.actividad_id) match.actividad_id = payload.actividad_id
      if (payload.sub_actividad_id) match.sub_actividad_id = payload.sub_actividad_id

      // Borramos lo que haya en esa coordenada
      await supabase.from('prod_cubicaciones').delete().match(match)

      // Insertamos el nuevo valor
      const { data: data2, error: error2 } = await supabase.from('prod_cubicaciones').insert(payload).select()
      if (error2) throw error2
      return data2
    }

    return data
  }
}