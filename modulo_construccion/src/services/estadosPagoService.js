import { supabase } from './supabaseClient'

export const estadosPagoService = {
    // Traer TODOS (Borradores y Emitidos) con el nombre del proveedor
    async getAll(proyectoId) {
        const { data, error } = await supabase
            .from('prod_estados_pago')
            .select(`
                *,
                proveedor:proveedores(nombre) 
            `)
            .eq('proyecto_id', proyectoId)
            .order('id', { ascending: false });

        if (error) {
            console.error("Error getAll EPs:", error);
            return [];
        }
        return data;
    },

    // Traer solo BORRADORES (para la lógica interna)
    async getBorradores(proyectoId) {
        const { data, error } = await supabase
            .from('prod_estados_pago')
            .select(`
                *,
                proveedor:proveedores(nombre)
            `)
            .eq('proyecto_id', proyectoId)
            .eq('estado', 'BORRADOR')
            .order('id', { ascending: false });

        if (error) return [];
        return data;
    },

    // Crear siguiente EP (usando tu función RPC)
    async crearSiguiente(projectId, codigoBase, proveedorId) {
        const { data, error } = await supabase
            .rpc('crear_ep_con_correlativo', {
                p_proyecto_id: projectId,
                p_codigo_base: codigoBase,
                p_proveedor_id: proveedorId
            })
        if (error) throw error
        return data
    },

    // Asignar o reutilizar un BORRADOR automático (RPC en servidor)
    async asignarBorradorAutomatico(projectId, codigoBase, proveedorId) {
        // CORRECCIÓN: llamamos al RPC con el nombre exacto definido en SQL
        const { data, error } = await supabase.rpc('asignar_o_crear_ep_borrador', {
            p_proyecto_id: projectId,
            p_codigo_base: codigoBase,
            p_proveedor_id: proveedorId
        })

        if (error) {
            console.error("Error asignando EP:", error);
            throw error;
        }
        return data
    },

    // Procesar la Emisión (Llamada al Cerebro SQL)
    async procesarEmision({ epId, taskIds, discountIds, tasksTotal, montoFinal }) {
        const { data, error } = await supabase.rpc('procesar_emision_ep', {
            p_ep_id: epId,
            p_tareas_ids: taskIds,       // Array de IDs de tareas
            p_descuentos_ids: discountIds, // Array de IDs de descuentos
            p_monto_final: montoFinal,
            p_total_tareas_origen: tasksTotal
        })
        return { data, error };
    },

    // ... tus otras funciones (asignarDueño, actualizarCodigo, etc) ...
    async asignarDueño(epId, proveedorId) {
        return await supabase.from('prod_estados_pago').update({ proveedor_id: proveedorId }).eq('id', epId)
    },
    async actualizarCodigo(epId, nuevoCodigo) {
        return await supabase.from('prod_estados_pago').update({ codigo: nuevoCodigo }).eq('id', epId)
    },

    // Eliminar EP (Solo Admin)
    async delete(epId) {
        // 1. Desvincular tareas y RESETEAR ESTADO a 'APROBADA' para que vuelvan al tablero
        const { error: errorUpdate } = await supabase
            .from('prod_tareas')
            .update({
                estado_pago_id: null,
                estado: 'APROBADA'
            })
            .eq('estado_pago_id', epId);

        if (errorUpdate) {
            console.error("Error desvinculando tareas del EP:", errorUpdate);
            throw new Error("Error al desvincular tareas.");
        }

        // 2. Eliminar el registro del EP
        const { error: errorDelete } = await supabase
            .from('prod_estados_pago')
            .delete()
            .eq('id', epId);

        if (errorDelete) {
            console.error("Error eliminando EP:", errorDelete);
            throw new Error("Error al eliminar el Estado de Pago.");
        }

        return true;
    }
}