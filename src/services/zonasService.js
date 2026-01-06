import { supabase } from './supabaseClient'

export const zonasService = {

  // --- ZONAS ---

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

  // --- TRAMOS ---

  async getTramos(zonaId) {
    console.log("Intentando cargar tramos para Zona ID:", zonaId); // LOG 1
    
    const { data, error } = await supabase
      .from('prod_tramos')
      .select('*')
      .eq('zona_id', zonaId)
      .order('id', { ascending: true })
    
    if (error) {
      console.error("🔥 ERROR REAL DE SUPABASE (GET):", error.message, error.details, error.hint); // LOG DETALLADO
      throw error
    }
    return data
  },

  async crearTramo(tramo) {
    console.log("Enviando tramo a crear:", tramo); // LOG 2
    
    const { data, error } = await supabase
      .from('prod_tramos')
      .insert(tramo)
      .select()
      .single()
      
    if (error) {
       console.error("🔥 ERROR REAL DE SUPABASE (POST):", error.message, error.details, error.hint); // LOG DETALLADO
       throw error
    }
    return data
  },

  async eliminarTramo(id) {
    const { error } = await supabase.from('prod_tramos').delete().eq('id', id)
    if (error) throw error
    return true
  }
}