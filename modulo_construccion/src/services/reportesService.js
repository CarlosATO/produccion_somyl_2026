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
  // Obtener Gastos Agrupados por Ítem (Manual JS para consistencia)
  async getDesgloseGastos(proyectoId) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID inválido");

    try {
      const { data, error } = await supabase
        .from('orden_de_pago')
        .select('item, neto_total_recibido')
        .eq('proyecto', idNumerico)
        .neq('estado_documento', 'anulado');

      if (error) throw error;

      // Agrupar por Ítem
      const grouped = {};

      data.forEach(op => {
        // Normalizar nombre del ítem
        const itemNombre = op.item ? op.item.trim() : 'Sin Categoría';
        const monto = Number(op.neto_total_recibido) || 0;

        if (!grouped[itemNombre]) {
          grouped[itemNombre] = 0;
        }
        grouped[itemNombre] += monto;
      });

      // Convertir a array formato { item, total_gasto }
      return Object.keys(grouped).map(key => ({
        item: key,
        total_gasto: grouped[key]
      })).sort((a, b) => b.total_gasto - a.total_gasto);

    } catch (error) {
      console.error('Error obteniendo desglose gastos (manual):', error);
      return [];
    }
  },


  // Obtener Gastos Raw para procesar en frontend (Dashboard)
  async getGastosRaw(proyectoId) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID inválido");

    try {
      const { data, error } = await supabase
        .from('orden_de_pago')
        .select('id, item, neto_total_recibido, proveedor, estado_documento')
        .eq('proyecto', idNumerico)
        .neq('estado_documento', 'anulado');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error obteniendo gastos raw:', error);
      return [];
    }
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
  },

  // NUEVA FUNCIÓN: Obtener Estado Financiero del Proyecto (Gasto Realizado y Deuda Pendiente)
  // Valores NETOS (sin IVA)
  async getEstadoFinancieroProyecto(proyectoId) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID de proyecto inválido");

    try {
      // 1. Obtener todas las órdenes de pago del proyecto
      const { data: ordenes, error } = await supabase
        .from('orden_de_pago')
        .select('orden_numero, costo_final_con_iva, neto_total_recibido, estado_pago')
        .eq('proyecto', idNumerico)
        .neq('estado_documento', 'anulado');

      if (error) throw error;
      if (!ordenes || ordenes.length === 0) return { total_gasto_neto: 0, saldo_pendiente_neto: 0 };

      // Extraer números de orden para buscar pagos y abonos
      const ordenNumeros = [...new Set(ordenes.map(o => o.orden_numero).filter(n => n))];

      // 2. Obtener fechas de pago (para saber si están pagadas totalmente)
      const { data: fechas, error: errFechas } = await supabase
        .from('fechas_de_pagos_op')
        .select('orden_numero, fecha_pago')
        .in('orden_numero', ordenNumeros);

      if (errFechas) console.error("Error fetching fechas pago:", errFechas);

      const fechaMap = {};
      if (fechas) {
        fechas.forEach(f => {
          fechaMap[f.orden_numero] = f.fecha_pago;
        });
      }

      // 3. Obtener abonos
      const { data: abonos, error: errAbonos } = await supabase
        .from('abonos_op')
        .select('orden_numero, monto_abono')
        .in('orden_numero', ordenNumeros);

      if (errAbonos) console.error("Error fetching abonos:", errAbonos);

      const abonosMap = {};
      if (abonos) {
        abonos.forEach(a => {
          const num = a.orden_numero;
          const monto = Number(a.monto_abono) || 0;
          abonosMap[num] = (abonosMap[num] || 0) + monto;
        });
      }

      // 4. Calcular Totales
      let total_gasto_neto = 0;
      let saldo_pendiente_neto = 0;

      // Agrupar por orden_numero para sumar líneas (una OP puede tener varias líneas)
      const ordenesAgrupadas = {};

      ordenes.forEach(op => {
        const num = op.orden_numero;
        if (!ordenesAgrupadas[num]) {
          ordenesAgrupadas[num] = {
            total_bruto: 0,
            total_neto: 0
          };
        }
        // Sumar montos de todas las líneas de la misma OP
        ordenesAgrupadas[num].total_bruto += Number(op.costo_final_con_iva) || 0;
        ordenesAgrupadas[num].total_neto += Number(op.neto_total_recibido) || 0;
      });

      // Procesar cada Orden única
      Object.keys(ordenesAgrupadas).forEach(numStr => {
        const num = Number(numStr);
        const { total_bruto, total_neto } = ordenesAgrupadas[num];

        // Gasto Total Neto (Siempre se suma todo lo emitido)
        total_gasto_neto += total_neto;

        // Saldo Pendiente Neto
        // Si tiene fecha de pago, el saldo es 0 (está pagada)
        if (!fechaMap[num]) {
          const abonado = abonosMap[num] || 0;
          const saldo_bruto = Math.max(0, total_bruto - abonado);

          if (saldo_bruto > 0) {
            if (total_bruto > 0) {
              // Calcular parte proporcional neta del saldo bruto
              // Ratio: Qué porcentaje del bruto está pendiente
              const ratio_pendiente = saldo_bruto / total_bruto;
              const saldo_neto_calculado = total_neto * ratio_pendiente;
              saldo_pendiente_neto += saldo_neto_calculado;
            } else {
              // Fallback raro si bruto es 0 pero hay neto
              saldo_pendiente_neto += total_neto;
            }
          }
        }
      });

      return {
        total_gasto_neto: Math.round(total_gasto_neto),
        saldo_pendiente_neto: Math.round(saldo_pendiente_neto)
      };

    } catch (error) {
      console.error("❌ Error en getEstadoFinancieroProyecto:", error);
      return { total_gasto_neto: 0, saldo_pendiente_neto: 0 };
    }
  },

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
  },

  // NUEVA FUNCIÓN: Obtener Detalle Financiero Completo (Listado de OPs para Modals)
  async getDetalleFinancieroProyecto(proyectoId) {
    const idNumerico = Number(proyectoId);
    if (!idNumerico || isNaN(idNumerico)) throw new Error("ID de proyecto inválido");

    try {
      // 1. Obtener todas las órdenes de pago y datos relacionados
      const { data: ordenes, error } = await supabase
        .from('orden_de_pago')
        .select('id, orden_numero, proveedor_nombre, fecha_factura, detalle_compra, costo_final_con_iva, neto_total_recibido, estado_pago, factura, orden_compra')
        .eq('proyecto', idNumerico)
        .neq('estado_documento', 'anulado')
        .order('orden_numero', { ascending: false });

      if (error) throw error;
      if (!ordenes || ordenes.length === 0) return { gastos_netos: [], deuda_neta: [] };

      // 2. Obtener pagos y abonos para calcular saldos
      const ordenNumeros = [...new Set(ordenes.map(o => o.orden_numero))];

      const { data: fechas } = await supabase
        .from('fechas_de_pagos_op')
        .select('orden_numero, fecha_pago')
        .in('orden_numero', ordenNumeros);

      const { data: abonos } = await supabase
        .from('abonos_op')
        .select('orden_numero, monto_abono')
        .in('orden_numero', ordenNumeros);

      // Mapear pagos y abonos
      const fechaMap = {};
      if (fechas) fechas.forEach(f => fechaMap[f.orden_numero] = f.fecha_pago);

      const abonosMap = {};
      if (abonos) abonos.forEach(a => {
        abonosMap[a.orden_numero] = (abonosMap[a.orden_numero] || 0) + (Number(a.monto_abono) || 0);
      });

      // 3. Procesar Listas
      // Agrupar primero por orden_numero para consolidar valores (por si hay múltiples líneas)
      const ordenesAgrupadas = {};

      ordenes.forEach(op => {
        const num = op.orden_numero;
        if (!ordenesAgrupadas[num]) {
          ordenesAgrupadas[num] = {
            ...op,
            total_bruto: 0,
            total_neto: 0
          };
        }
        ordenesAgrupadas[num].total_bruto += Number(op.costo_final_con_iva) || 0;
        ordenesAgrupadas[num].total_neto += Number(op.neto_total_recibido) || 0;
      });

      const listaGastos = [];
      const listaDeuda = [];

      Object.values(ordenesAgrupadas).forEach(op => {
        const num = op.orden_numero;
        const bruto = op.total_bruto;
        const neto = op.total_neto;

        // Estado Pago
        const fechaPago = fechaMap[num];
        const abonado = abonosMap[num] || 0;
        const saldoBruto = Math.max(0, bruto - abonado);

        // Determinar estado
        let estado = 'Pendiente';
        if (fechaPago) estado = 'Pagado';
        else if (abonado > 0 && saldoBruto > 0) estado = 'Abono Parcial';

        // Item común
        const item = {
          id: op.id,
          orden_numero: num,
          proveedor: op.proveedor_nombre,
          fecha: op.fecha_factura || 'S/F',
          detalle: op.detalle_compra,
          documento: op.factura || 'S/N',
          monto_neto: neto,
          monto_bruto: bruto,
          estado: estado,
          fecha_pago: fechaPago || '-'
        };

        // Lista 1: Todos los gastos (Siempre van)
        listaGastos.push(item);

        // Lista 2: Deuda Pendiente
        if (!fechaPago && saldoBruto > 0) {
          // Calcular deuda neta proporcional
          const ratio = saldoBruto / bruto;
          const deudaNeta = neto * ratio;

          listaDeuda.push({
            ...item,
            deuda_neta: Math.round(deudaNeta),
            saldo_bruto: Math.round(saldoBruto)
          });
        }
      });

      return {
        gastos_netos: listaGastos.sort((a, b) => b.orden_numero - a.orden_numero),
        deuda_neta: listaDeuda.sort((a, b) => b.orden_numero - a.orden_numero)
      };

    } catch (error) {
      console.error("Error obteniendo detalles financieros:", error);
      return { gastos_netos: [], deuda_neta: [] };
    }
  }
}