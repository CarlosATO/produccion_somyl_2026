import { supabase } from './supabaseClient'

export const reportesService = {
  
  // REPORTE 1: Financiero por Subcontrato
  async getResumenSubcontrato(proyectoId) {
    // 1. VALIDACIÓN
    const idNumerico = Number(proyectoId);
    
    if (!idNumerico || isNaN(idNumerico)) {
        console.error("❌ Error: El ID del proyecto no es válido:", proyectoId);
        throw new Error("ID de proyecto inválido");
    }

    // 2. LLAMADA RPC
    const { data, error } = await supabase
      .rpc('get_reporte_financiero_subcontrato', { 
          p_proyecto_id: idNumerico 
      })
    
    if (error) {
      console.error("❌ Error al cargar reporte financiero:", error)
      throw error
    }

    return data
  },

  // REPORTE 2: Producción por Actividad (NUEVO)
  async getProduccionActividad(proyectoId) {
    const idNumerico = Number(proyectoId);
    
    if (!idNumerico || isNaN(idNumerico)) {
        throw new Error("ID de proyecto inválido");
    }

    const { data, error } = await supabase
      .rpc('get_reporte_produccion_actividad', { p_proyecto_id: idNumerico })
    
    if (error) {
      console.error("❌ Error al cargar producción por actividad:", error)
      throw error
    }
    return data
  }
}