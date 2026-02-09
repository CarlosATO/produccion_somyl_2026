import { supabase } from './supabaseClient'
import { logisticaService } from './logisticaClient'

export const stockService = {

    // CALCULAR SALDO DISPONIBLE
    async getMaterialesDisponibles(proveedorId, proyectoId) {
        
        // 1. ENTRADAS (Desde Logística)
        // Ya viene filtrado por proyecto gracias al cambio en el paso 1
        const entregas = await logisticaService.getEntregasProveedor(proveedorId, proyectoId)
        
        // 2. SALIDAS (Consumos locales en Supabase)
        // Buscamos lo que se ha gastado en tareas de ESTE proyecto
        const { data: consumos } = await supabase
            .from('prod_tarea_consumos')
            .select(`
                producto_codigo, 
                cantidad, 
                tarea:prod_tareas!inner(proveedor_id, proyecto_id)
            `)
            .eq('tarea.proveedor_id', proveedorId)
            .eq('tarea.proyecto_id', proyectoId) // <--- Filtro local también

        // 3. CÁLCULO FINAL (Entradas - Salidas)
        const inventario = {}

        // A) Sumamos Entradas
        entregas.forEach(item => {
            if (!inventario[item.codigo]) {
                inventario[item.codigo] = { ...item, entregado: 0, consumido: 0, saldo: 0 }
            }
            inventario[item.codigo].entregado += Number(item.cantidad)
        })

        // B) Restamos Salidas
        if (consumos) {
            consumos.forEach(c => {
                if (inventario[c.producto_codigo]) {
                    inventario[c.producto_codigo].consumido += Number(c.cantidad)
                }
            })
        }

        // C) Retornamos solo lo que tiene saldo positivo
        return Object.values(inventario)
            .map(item => ({
                ...item,
                saldo: item.entregado - item.consumido
            }))
            .filter(item => item.saldo > 0)
    },

    // --- MÉTODOS ESTÁNDAR (Sin cambios) ---
    async registrarConsumo(payload) {
        const { error } = await supabase.from('prod_tarea_consumos').insert(payload)
        if (error) throw error
    },
    
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