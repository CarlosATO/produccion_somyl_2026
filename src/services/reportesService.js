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
  ,
  // NUEVA FUNCIÓN: Obtener Gastos Operativos (Materiales + Gastos Directos)
  async getGastosOperativos(proyectoId) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID inválido");

    const { data, error } = await supabase
      .rpc('get_gastos_operativos_proyecto', { 
          p_proyecto_id: idNumerico 
      })
    
    if (error) {
      console.error("Error calculando gastos operativos:", error)
      return 0; // Retornar 0 si falla para no romper el reporte
    }

    return data || 0;
  }
  ,
  // Obtener Gastos Agrupados por Ítem (Para el primer nivel del modal)
  async getDesgloseGastos(proyectoId) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID inválido");

    const { data, error } = await supabase.rpc('get_detalle_gastos_operativos', { 
        p_proyecto_id: idNumerico
    });

    if (error) {
      console.error('Error obteniendo desglose gastos:', error);
      throw error;
    }

    return data || [];
  },


  // Obtener Filas Específicas de un Ítem (Para el segundo nivel)
  async getDetalleGastosPorItem(proyectoId, itemNombre) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID inválido");

    const { data, error } = await supabase
      .from('orden_de_pago')
      .select('*')
      .eq('proyecto', idNumerico)
      .eq('item', itemNombre)
      .neq('estado_documento', 'anulado');

    if (error) {
      console.error('Error obteniendo detalle de gastos por item:', error);
      throw error;
    }

    return data || [];
  }

  ,

  // NUEVA FUNCIÓN: Obtener todos los ítems de un mismo documento (Factura u Orden) o línea única
  async getFichaGastoCompleta(proyectoId, proveedorId, factura, ordenCompra, idOriginal) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID de proyecto inválido");

    let query = supabase
      .from('orden_de_pago')
      .select('*')
      .eq('proyecto', idNumerico)
      .neq('estado_documento', 'anulado');

    // Agrupar por factura si existe y no es 'S/N'
    if (proveedorId && factura && factura.toString().trim() !== '' && factura.toString().toLowerCase() !== 's/n') {
      query = query.eq('proveedor', proveedorId).eq('factura', factura);
    } else if (ordenCompra) {
      // Agrupar por orden de compra si no hay factura
      query = query.eq('orden_compra', ordenCompra);
    } else {
      // Caso fallback: devolver solo la fila original
      if (!idOriginal) throw new Error('Se requiere idOriginal para devolver línea única');
      query = query.eq('id', idOriginal);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error obteniendo ficha gasto completa:', error);
      throw error;
    }

    return data || [];
  }
}