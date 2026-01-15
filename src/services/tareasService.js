import { supabase } from './supabaseClient'

export const tareasService = {

  // Obtener tareas con sus relaciones
  async getTareas(proyectoId) {
    // Query simplificada y robusta
    const { data, error } = await supabase
      .from('prod_tareas')
      .select(`
        *, 
        proveedor:proveedores(id, nombre), 
        zona:prod_zonas(id, nombre), 
        tramo:prod_tramos(id, nombre),
        estado_pago:prod_estados_pago(id, codigo, estado),
        actividad:prod_actividades(id, nombre, unidad, clasificacion, requiere_material, valor_venta),
        sub_actividad:prod_sub_actividades(id, nombre, unidad, clasificacion, requiere_material, valor_venta)
      `)
      .eq('proyecto_id', proyectoId)
      .order('position', { ascending: true })
    
    if (error) {
      console.error('Error en getTareas:', error)
      throw error
    }
    
    return data || []
  },

  // Crear Tarea (Cabecera) + Ítems (Detalle)
  async crearTarea(tareaPayload, itemsPayload) {
    // 1. Crear Cabecera
    const tareaConPos = { ...tareaPayload, position: Date.now() }
    const { data: tareaData, error: tareaError } = await supabase
      .from('prod_tareas')
      .insert(tareaConPos)
      .select()
      .single()
    
    if (tareaError) throw tareaError

    // 2. Crear Ítems
    if (itemsPayload && itemsPayload.length > 0) {
        const itemsToInsert = itemsPayload.map(item => ({
            tarea_id: tareaData.id,
            actividad_id: item.actividad_id || null,
            sub_actividad_id: item.sub_actividad_id || null,
            cantidad_asignada: item.cantidad_asignada,
            cantidad_real: 0, // Al crear parte en 0
            precio_costo_unitario: item.precio_costo,
            precio_venta_unitario: item.precio_venta
        }))
        const { error: itemsError } = await supabase.from('prod_tarea_items').insert(itemsToInsert)
        if (itemsError) throw itemsError // Ojo: Si falla aquí, quedaría la cabecera sola (podrías borrarla)
    }

    return tareaData
  },

  // Actualizar Tarea y sus Ítems (Estrategia: Borrar ítems viejos e insertar nuevos para simplificar)
  async actualizarTareaCompleta(id, tareaPayload, itemsPayload) {
    // 1. Actualizar Cabecera
    const { data, error } = await supabase
      .from('prod_tareas')
      .update(tareaPayload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    // 2. Actualizar Ítems (Solo si viene payload de items, si es null no tocamos)
    if (itemsPayload) {
        // A. Borrar anteriores
        await supabase.from('prod_tarea_items').delete().eq('tarea_id', id)
        
        // B. Insertar nuevos
        if (itemsPayload.length > 0) {
            const itemsToInsert = itemsPayload.map(item => ({
                tarea_id: id,
                actividad_id: item.actividad_id || null,
                sub_actividad_id: item.sub_actividad_id || null,
                cantidad_asignada: item.cantidad_asignada,
                cantidad_real: item.cantidad_real || 0,
                precio_costo_unitario: item.precio_costo,
                precio_venta_unitario: item.precio_venta
            }))
            await supabase.from('prod_tarea_items').insert(itemsToInsert)
        }
    }
    return data
  },

  async actualizarEstado(id, nuevoEstado, datosAdicionales = {}) {
    const { data, error } = await supabase
      .from('prod_tareas')
      .update({ estado: nuevoEstado, ...datosAdicionales })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async eliminarTarea(id) {
    const { error } = await supabase.from('prod_tareas').delete().eq('id', id)
    if (error) throw error
    return true
  }
}