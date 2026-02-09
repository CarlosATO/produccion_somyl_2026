export const whatsappService = {

  formatearNumero(numero) {
    if (!numero) return null;
    let limpio = String(numero).replace(/\D/g, '');
    if (limpio.length === 9 && (limpio.startsWith('9') || limpio.startsWith('2'))) {
        limpio = '56' + limpio;
    }
    if (limpio.length === 8) {
        limpio = '56' + limpio;
    }
    return limpio;
  },

  generarMensajeOT(tarea, items, proyectoInfo) {
    const s = '\n'; // Salto de línea
    const b = '*';  // Negrita

    // 1. Encabezado
    let msg = `👷‍♂️ ${b}NUEVA ASIGNACIÓN - ${proyectoInfo?.nombre || proyectoInfo?.proyecto || 'SOMYL'}${b}${s}`;
    msg += `📅 Fecha: ${tarea.fecha_asignacion ? new Date(tarea.fecha_asignacion).toLocaleDateString('es-CL') : 'Por definir'}${s}`;
    
    // 2. Ubicación (Validación estricta para evitar "[object Object]")
    let zonaNombre = 'General';
    if (typeof tarea.zona === 'string') {
        zonaNombre = tarea.zona;
    } else if (tarea.zona?.nombre) {
        zonaNombre = tarea.zona.nombre;
    }
    
    let tramoNombre = null;
    if (typeof tarea.tramo === 'string') {
        tramoNombre = tarea.tramo;
    } else if (tarea.tramo?.nombre) {
        tramoNombre = tarea.tramo.nombre;
    }
    
    msg += `${s}📍 ${b}Ubicación:${b}${s}`;
    msg += `Zona: ${zonaNombre}${s}`;
    if (tramoNombre) msg += `Tramo: ${tramoNombre}${s}`;
    
    // Puntas (Solo si existen)
    if (tarea.punta_inicio) {
        msg += `Desde: ${tarea.punta_inicio}`;
        if (tarea.punta_final) msg += ` ➡️ Hasta: ${tarea.punta_final}`;
        msg += s;
    }

    // Link Mapa (Corto y limpio)
    if (tarea.geo_lat && tarea.geo_lon) {
        msg += `🗺️ Ver en Mapa: https://maps.google.com/?q=${tarea.geo_lat},${tarea.geo_lon}${s}`;
    }

    // 3. Actividades
    msg += `${s}📋 ${b}Actividades a realizar:${b}${s}`;
    if (items && items.length > 0) {
        items.forEach(item => {
            const nombre = item.label || item.actividad?.nombre || item.sub_actividad?.nombre || 'Item';
            const unidad = item.data?.unidad || 'UN';
            const cant = item.cantidad_asignada || 0;
            msg += `🔹 ${nombre} x${cant} ${unidad}${s}`;
        });
    } else {
        msg += `🔹 Ver detalle en sistema${s}`;
    }

    // 4. Adjuntos / Documentos
    if (tarea.archivo_plano_url) {
        msg += `${s}📎 ${b}Plano/Documento:${b}${s}`;
        msg += `${tarea.archivo_plano_url}${s}`;
    }

    // 5. Enlace PDF OT (si se genera)
    if (tarea.pdfUrl) {
        msg += `${s}📄 ${b}Orden de Trabajo (PDF):${b}${s}`;
        msg += `${tarea.pdfUrl}${s}`;
    }

    msg += `${s}⚠️ ${b}Por favor confirmar recepción.${b}`;

    return msg;
  },

  enviarOT(numero, tarea, items, proyectoInfo) {
    const fono = this.formatearNumero(numero);
    if (!fono) {
        alert("⚠️ El proveedor no tiene un número de teléfono válido registrado.\n\nPor favor agregue el teléfono en la ficha del proveedor.");
        return;
    }
    const texto = this.generarMensajeOT(tarea, items, proyectoInfo);
    const encoded = encodeURIComponent(texto);
    window.open(`https://wa.me/${fono}?text=${encoded}`, '_blank');
  }
};