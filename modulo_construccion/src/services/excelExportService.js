import * as XLSX from 'xlsx';
import { format, parseISO, isValid } from 'date-fns';

export const generarExcelPlanificacion = (tareas, epsRawData, proyectoInfo) => {
    try {
        // Formateo de fechas seguro
        const formatearFecha = (fechaStr) => {
            if (!fechaStr) return '-';
            const fecha = parseISO(fechaStr);
            return isValid(fecha) ? format(fecha, 'dd/MM/yyyy') : '-';
        };

        // 1. Mapeamos la data - AHORA CON SOPORTE PARA ITEMS
        const dataParaExcel = [];
        
        tareas.forEach(t => {
            // Buscamos info extra del EP si existe
            const epPadre = t.estado_pago_id ? epsRawData.find(e => e.id === t.estado_pago_id) : null;
            
            // Datos comunes de la tarea (cabecera)
            const datosComunes = {
                'ID Tarea': t.id,
                'Estado Kanban': t.estado,
                'Proveedor': t.proveedor?.nombre || 'Sin Asignar',
                'Trabajador': t.trabajador?.nombre_completo || '-',
                'Zona': t.zona?.nombre || '-',
                'Tramo': t.tramo?.nombre || '-',
                'Fecha Asignación': formatearFecha(t.fecha_asignacion),
                'Fecha Término Real': formatearFecha(t.fecha_termino_real),
                'ID EP': epPadre ? epPadre.id : '',
                'Código EP': epPadre ? epPadre.codigo : 'Pendiente',
                'Estado del EP': epPadre ? epPadre.estado : 'No Asignado',
                'Nombre EP': epPadre ? epPadre.nombre : '-'
            };

            // Si tiene items, creamos una fila por cada item
            if (t.items && t.items.length > 0) {
                t.items.forEach(item => {
                    const actividad = item.actividad || item.sub_actividad;
                    const cantPlan = Number(item.cantidad_asignada) || 0;
                    const cantReal = Number(item.cantidad_real) || 0;
                    const precioVenta = Number(item.precio_venta_unitario) || 0;
                    const precioCosto = Number(item.precio_costo_unitario) || 0;

                    dataParaExcel.push({
                        ...datosComunes,
                        'Ítem / Actividad': actividad?.nombre || 'Sin Nombre',
                        'Unidad': actividad?.unidad || '-',
                        'Cant. Planificada': cantPlan,
                        'Cant. Ejecutada': cantReal,
                        'Precio Costo': precioCosto,
                        'Precio Venta': precioVenta,
                        'Total Costo ($)': cantReal * precioCosto,
                        'Total Venta ($)': cantReal * precioVenta
                    });
                });
            } else {
                // Fallback: Datos legacy de cabecera (tareas antiguas sin items)
                const cantPlan = Number(t.cantidad_asignada) || 0;
                const cantReal = Number(t.cantidad_real) || 0;
                const precioCosto = Number(t.precio_costo_unitario) || 0;
                const precioVenta = Number(t.precio_venta_unitario) || 0;

                dataParaExcel.push({
                    ...datosComunes,
                    'Ítem / Actividad': t.actividad?.nombre || t.sub_actividad?.nombre || 'Sin Actividad',
                    'Unidad': t.actividad?.unidad || t.sub_actividad?.unidad || '-',
                    'Cant. Planificada': cantPlan,
                    'Cant. Ejecutada': cantReal,
                    'Precio Costo': precioCosto,
                    'Precio Venta': precioVenta,
                    'Total Costo ($)': cantReal * precioCosto,
                    'Total Venta ($)': cantReal * precioVenta
                });
            }
        });

        // 2. Crear hoja de trabajo (Worksheet)
        const worksheet = XLSX.utils.json_to_sheet(dataParaExcel);

        // 3. Ajustar anchos de columna automáticamente (Estética)
        const columnWidths = [
            { wch: 8 },  // ID
            { wch: 12 }, // Estado
            { wch: 22 }, // Proveedor
            { wch: 20 }, // Trabajador
            { wch: 12 }, // Zona
            { wch: 10 }, // Tramo
            { wch: 12 }, // Fecha
            { wch: 12 }, // Fecha
            { wch: 6 },  // ID EP
            { wch: 22 }, // Codigo EP
            { wch: 12 }, // Estado EP
            { wch: 15 }, // Nombre EP
            { wch: 35 }, // Actividad
            { wch: 8 },  // Unidad
            { wch: 10 }, // Cant Plan
            { wch: 10 }, // Cant Real
            { wch: 12 }, // Precio Costo
            { wch: 12 }, // Precio Venta
            { wch: 14 }, // Total Costo
            { wch: 14 }, // Total Venta
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