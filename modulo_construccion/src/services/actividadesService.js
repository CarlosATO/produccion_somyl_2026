import { supabase } from './supabaseClient'

export const actividadesService = {
  
  // --- ACTIVIDADES (PADRES) ---

  async getActividades(proyectoId) {
    const { data, error } = await supabase
      .from('prod_actividades')
      .select(`
        *,
        sub_actividades:prod_sub_actividades (
          *
        )
      `)
      .eq('proyecto_id', proyectoId)
      .eq('activo', true)
      .order('id', { ascending: true })

    // Nota: El select de sub_actividades (*) traerá automáticamente clasificacion y requiere_material
    if (error) throw error
    return data
  },

  async crearActividad(actividad) {
    const { data, error } = await supabase
      .from('prod_actividades')
      .insert(actividad)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async actualizarActividad(id, cambios) {
    const { data, error } = await supabase
      .from('prod_actividades')
      .update(cambios)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async eliminarActividad(id) {
    const { error } = await supabase
      .from('prod_actividades')
      .delete()
      .eq('id', id)
    
    if (error) {
      if (error.code === '23503') throw new Error("No se puede eliminar: Tiene registros asociados.")
      throw error
    }
    return true
  },

  // --- SUB-ACTIVIDADES (HIJOS) ---

  async crearSubActividad(subActividad) {
    const { data, error } = await supabase
      .from('prod_sub_actividades')
      .insert(subActividad)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async actualizarSubActividad(id, cambios) {
    const { data, error } = await supabase
      .from('prod_sub_actividades')
      .update(cambios)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async eliminarSubActividad(id) {
    const { error } = await supabase
      .from('prod_sub_actividades')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  },

  // --- TARIFAS ---

  async getTarifas(proyectoId, itemId, type) {
    let query = supabase
      .from('prod_tarifas')
      .select(`
        id,
        valor_costo,
        proveedor:proveedores (id, nombre, rut)
      `)
      .eq('proyecto_id', proyectoId)

    if (type === 'ACT') {
      query = query.eq('actividad_id', itemId)
    } else {
      query = query.eq('sub_actividad_id', itemId)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  },

  async guardarTarifa(payload) {
    if (payload.actividad_id) delete payload.sub_actividad_id 
    else delete payload.actividad_id

    const { data, error } = await supabase
      .from('prod_tarifas')
      .insert(payload) 
      .select()
    
    if (error) throw error
    return data
  },
  
  async setTarifaSegura(payload) {
     const match = { 
        proyecto_id: payload.proyecto_id, 
        proveedor_id: payload.proveedor_id 
     }
     if(payload.actividad_id) match.actividad_id = payload.actividad_id
     else match.sub_actividad_id = payload.sub_actividad_id

     // 1. Borrar anterior (si existe)
     await supabase.from('prod_tarifas').delete().match(match)
     
     // 2. Insertar nueva
     return await this.guardarTarifa(payload)
  }
}