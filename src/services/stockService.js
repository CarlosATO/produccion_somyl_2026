import { supabase } from './supabaseClient' // DB Construcción
import { logisticaService } from './logisticaClient' // DB Logística

export const stockService = {

    // CALCULAR SALDO DISPONIBLE (La lógica que pediste)
    async getMaterialesDisponibles(proveedorId) {
        
        // 1. ¿Qué le entregamos? (Desde Logística)
        const entregas = await logisticaService.getEntregasProveedor(proveedorId)
        
        // 2. ¿Qué ha gastado ya? (Desde Producción - Histórico)
        // Buscamos consumos en tareas de ESTE proveedor
        const { data: consumos } = await supabase
            .from('prod_tarea_consumos')
            .select('producto_codigo, cantidad, tarea:prod_tareas!inner(proveedor_id)')
            .eq('tarea.proveedor_id', proveedorId)

        // 3. Hacemos la resta (Agrupando por código)
        const inventario = {}

        // Sumar Entradas
        entregas.forEach(item => {
            if (!inventario[item.codigo]) {
                inventario[item.codigo] = { ...item, entregado: 0, consumido: 0, saldo: 0 }
            }
            inventario[item.codigo].entregado += item.cantidad
        })

        // Restar Salidas
        if (consumos) {
            consumos.forEach(c => {
                if (inventario[c.producto_codigo]) {
                    inventario[c.producto_codigo].consumido += Number(c.cantidad)
                }
            })
        }

        // Calcular saldo final y convertir a array
        return Object.values(inventario)
            .map(item => ({
                ...item,
                saldo: item.entregado - item.consumido
            }))
            .filter(item => item.saldo > 0) // Solo devolvemos lo que tenga saldo positivo
    },

    // Guardar consumo nuevo
    async registrarConsumo(payload) {
        const { error } = await supabase.from('prod_tarea_consumos').insert(payload)
        if (error) throw error
    },
    
    // Obtener consumos de UNA tarea específica (para mostrar en el modal)
    async getConsumosTarea(tareaId) {
        const { data } = await supabase
            .from('prod_tarea_consumos')
            .select('*')
            .eq('tarea_id', tareaId)
        return data || []
    },

    async eliminarConsumo(id) {
        await supabase.from('prod_tarea_consumos').delete().eq('id', id)
    }
}
