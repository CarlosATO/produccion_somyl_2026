import { supabase } from './supabaseClient'

export const descuentosService = {
  
  // Obtener todos los descuentos de un proyecto (Opcional: filtrar por proveedor)
  async getDescuentos(proyectoId, proveedorId = null) {
    let query = supabase
      .from('prod_descuentos')
      .select(`
        *,
        proveedor:proveedores(id, nombre),
        estado_pago:prod_estados_pago(id, codigo)
      `)
      .eq('proyecto_id', proyectoId)
      .order('fecha', { ascending: false })

    if (proveedorId) {
      query = query.eq('proveedor_id', proveedorId)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  // Crear un nuevo cargo
  async crearDescuento(descuento) {
    const { data, error } = await supabase
      .from('prod_descuentos')
      .insert(descuento)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // Traer descuentos pendientes (sin estado_pago_id)
  async getPendientes(proyectoId, proveedorId) {
    const { data, error } = await supabase
        .from('prod_descuentos')
        .select('*')
        .eq('proyecto_id', proyectoId)
        .eq('proveedor_id', proveedorId)
        .is('estado_pago_id', null) // <--- CLAVE: Solo los que no se han cobrado
    
    if (error) {
      console.error('Error getPendientes:', error);
      return [];
    }
    return data;
  },

  // Eliminar (Solo si no está asociado a un EP cerrado, validaremos en front)
  async eliminarDescuento(id) {
    const { error } = await supabase
      .from('prod_descuentos')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  }

  ,

  // Actualizar un descuento existente
  async actualizarDescuento(id, datos) {
    const { data, error } = await supabase
      .from('prod_descuentos')
      .update(datos)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
}