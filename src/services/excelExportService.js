import * as XLSX from 'xlsx';
import { format, parseISO, isValid } from 'date-fns';

export const generarExcelPlanificacion = (tareas, epsRawData, proyectoInfo) => {
    try {
        // 1. Mapeamos la data para que quede "plana" (ideal para tablas dinámicas)
        const dataParaExcel = tareas.map(t => {
            // Buscamos info extra del EP si existe
            const epPadre = t.estado_pago_id ? epsRawData.find(e => e.id === t.estado_pago_id) : null;
            
            // Cálculos seguros
            const cantidadPlan = Number(t.cantidad_asignada) || 0;
            const cantidadReal = Number(t.cantidad_real) || 0;
            const precioUnitario = Number(t.precio_costo_unitario) || 0;
            const totalEstimado = cantidadPlan * precioUnitario;
            const totalReal = cantidadReal * precioUnitario;

            // Formateo de fechas seguro
            const formatearFecha = (fechaStr) => {
                if (!fechaStr) return '-';
                const fecha = parseISO(fechaStr);
                return isValid(fecha) ? format(fecha, 'dd/MM/yyyy') : '-';
            };

            return {
                'ID Tarea': t.id,
                'Estado Kanban': t.estado, // ASIGNADA, REALIZADA, APROBADA
                
                // Info Ubicación y Responsable
                'Proveedor': t.proveedor?.nombre || 'Sin Asignar',
                'Zona': t.zona?.nombre || '-',
                'Tramo': t.tramo?.nombre || '-',
                
                // Actividad
                'Ítem / Actividad': t.actividad?.nombre || t.sub_actividad?.nombre || 'Sin Nombre',
                'Unidad': t.actividad?.unidad || t.sub_actividad?.unidad || '-',
                
                // Fechas
                'Fecha Asignación': formatearFecha(t.fecha_asignacion),
                'Fecha Término Real': formatearFecha(t.fecha_termino_real),
                
                // Valores Numéricos (Para que Excel los sume bien)
                'Cant. Planificada': cantidadPlan,
                'Cant. Ejecutada': cantidadReal,
                'Precio Unitario': precioUnitario,
                'Total Estimado ($)': totalEstimado,
                'Total Ejecutado ($)': totalReal,

                // --- COLUMNAS DEL ESTADO DE PAGO (LO QUE PEDISTE) ---
                'ID EP': epPadre ? epPadre.id : '',
                'Código EP': epPadre ? epPadre.codigo : 'Pendiente',
                'Estado del EP': epPadre ? epPadre.estado : 'No Asignado', // EMITIDO, BORRADOR, ETC.
                'Nombre EP': epPadre ? epPadre.nombre : '-'
            };
        });

        // 2. Crear hoja de trabajo (Worksheet)
        const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);

        // 3. Ajustar anchos de columna automáticamente (Estética)
        const columnWidths = [
            { wch: 8 },  // ID
            { wch: 15 }, // Estado
            { wch: 25 }, // Proveedor
            { wch: 15 }, // Zona
            { wch: 10 }, // Tramo
            { wch: 40 }, // Actividad
            { wch: 10 }, // Unidad
            { wch: 15 }, // Fecha
            { wch: 15 }, // Fecha
            { wch: 12 }, // Cant
            { wch: 12 }, // Cant
            { wch: 12 }, // Precio
            { wch: 15 }, // Total
            { wch: 15 }, // Total
            { wch: 8 },  // ID EP
            { wch: 15 }, // Codigo EP
            { wch: 15 }, // Estado EP
            { wch: 20 }, // Nombre EP
        ];
        worksheet['!cols'] = columnWidths;

        // 4. Crear libro de trabajo (Workbook)
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Planificación");

        // 5. Generar nombre de archivo dinámico
        const nombreProyecto = proyectoInfo?.codigo || 'Proyecto';
        const fechaHoy = format(new Date(), 'yyyy-MM-dd');
        const fileName = `Reporte_Control_${nombreProyecto}_${fechaHoy}.xlsx`;

        // 6. Descargar
        XLSX.writeFile(workbook, fileName);

    } catch (error) {
        console.error("Error generando Excel:", error);
        alert("Hubo un error generando el reporte. Revisa la consola.");
    }
};