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
      .select('*')
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

    // Usamos UPSERT (Insertar o Actualizar si ya existe la combinación)
    // Para que funcione el upsert, necesitamos definir el "onConflict" explícito o confiar en el índice UNIQUE
    const { data, error } = await supabase
      .from('prod_cubicaciones')
      .upsert(payload, { onConflict: 'zona_id, actividad_id, sub_actividad_id' }) 
      .select()
      
    // Nota: Como la constraint unique incluye 3 columnas y una será NULL, Postgres a veces es mañoso.
    // Si falla el upsert simple, usaremos la estrategia "Borrar previo e insertar" que usamos en tarifas.
    if (error) {
        // Fallback strategy: Delete then Insert
        console.warn("Upsert falló, intentando delete+insert...", error)
        
        const match = { zona_id: payload.zona_id }
        if(payload.actividad_id) match.actividad_id = payload.actividad_id
        if(payload.sub_actividad_id) match.sub_actividad_id = payload.sub_actividad_id
        
        await supabase.from('prod_cubicaciones').delete().match(match)
        const { data: data2, error: error2 } = await supabase.from('prod_cubicaciones').insert(payload).select()
        if (error2) throw error2
        return data2
    }
    
    return data
  }
}