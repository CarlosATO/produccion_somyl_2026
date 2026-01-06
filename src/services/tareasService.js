import { supabase } from './supabaseClient'

export const tareasService = {

  // Obtener todas las tareas del proyecto con sus relaciones
  async getTareas(proyectoId) {
    const { data, error } = await supabase
      .from('prod_tareas')
      .select(`
        *, 
        proveedor:proveedores(id, nombre), 
        actividad:prod_actividades(id, nombre, unidad), 
        sub_actividad:prod_sub_actividades(id, nombre, unidad), 
        zona:prod_zonas(id, nombre), 
        tramo:prod_tramos(id, nombre),
        estado_pago:prod_estados_pago(id, codigo, estado) 
      `)
      .eq('proyecto_id', proyectoId)
      .order('position', { ascending: true })
    if (error) throw error
    return data
  },

  // Crear nueva tarea (Solo si pasamos la validación de tarifa en el frontend)
  async crearTarea(tarea) {
    // Al crear, asignamos una posición alta para que aparezca al final
    const tareaConPos = { ...tarea, position: Date.now() }
    const { data, error } = await supabase
      .from('prod_tareas')
      .insert(tareaConPos)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Función crítica para el Drag & Drop: actualizar solo el estado (y campos adicionales opcionales)
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

  // Mover de columna o editar (Ej: Pasar a "REALIZADA")
  async actualizarTarea(id, cambios) {
    const { data, error } = await supabase
      .from('prod_tareas')
      .update(cambios)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  // Eliminar tarea (Solo si está en estado ASIGNADA, por seguridad)
  async eliminarTarea(id) {
    const { error } = await supabase
      .from('prod_tareas')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  }

  ,

  // Traer tareas asociadas a un Estado de Pago específico
  async getTareasPorEP(epId) {
    // CORRECCIÓN: Usamos los nombres reales de las tablas (prod_...)
    // Si tu tabla de proveedores se llama solo 'proveedores', déjala así.
    // Si se llama 'prod_proveedores', agrégale el prefijo también.
    const { data, error } = await supabase
      .from('prod_tareas')
      .select(`
        *,
        actividad:prod_actividades(nombre, unidad),
        sub_actividad:prod_sub_actividades(nombre, unidad),
        zona:prod_zonas(nombre),
        tramo:prod_tramos(nombre),
        proveedor:proveedores(nombre)
      `)
      .eq('estado_pago_id', epId);

    // NOTA: En la línea de 'proveedor', asumí que la tabla se llama 'proveedores'
    // (porque así aparecía en tu SQL anterior). Si también lleva prod_, cámbialo a prod_proveedores.

    if (error) {
      console.error('Error getTareasPorEP:', error);
      return [];
    }
    return data;
  }
}