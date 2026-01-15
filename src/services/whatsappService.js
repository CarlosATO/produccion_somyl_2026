/**
 * Servicio para generar enlaces y mensajes de WhatsApp automatizados
 */
export const whatsappService = {

  /**
   * Limpia el número de teléfono para el formato internacional de WhatsApp
   * Elimina espacios, guiones y asegura el +569 (u otro código)
   */
  formatearNumero(numero) {
    if (!numero) return null;
    // Quitamos todo lo que no sea número
    let limpio = numero.replace(/\D/g, '');
    
    // Si no tiene código de país (ej: empieza con 9), asumimos Chile (56)
    if (limpio.length === 9 && (limpio.startsWith('9') || limpio.startsWith('2'))) {
        limpio = '56' + limpio;
    }
    // Si tiene 8 dígitos (fijos antiguos), agregamos 56
    if (limpio.length === 8) {
        limpio = '56' + limpio;
    }
    return limpio;
  },

  /**
   * Construye el mensaje estructurado con toda la info de la OT
   */
  generarMensajeOT(tarea, items, proyectoInfo) {
    const salto = '\n';
    const negrita = '*';

    // 1. Encabezado
    let msg = `👷‍♂️ ${negrita}NUEVA ASIGNACIÓN - ${proyectoInfo?.nombre || 'SOMYL'}${negrita}${salto}`;
    msg += `📅 Fecha: ${tarea.fecha_asignacion ? new Date(tarea.fecha_asignacion).toLocaleDateString() : 'Por definir'}${salto}`;
    
    // 2. Ubicación
    msg += `${salto}📍 ${negrita}Ubicación:${negrita}${salto}`;
    msg += `Zona: ${tarea.zona?.nombre || 'General'}${salto}`;
    if (tarea.tramo) msg += `Tramo: ${tarea.tramo.nombre}${salto}`;
    if (tarea.punta_inicio) msg += `Inicio: ${tarea.punta_inicio} ➡️ Fin: ${tarea.punta_final || '?'}${salto}`;

    // 3. Link Google Maps (Si hay coordenadas)
    if (tarea.geo_lat && tarea.geo_lon) {
        msg += `🗺️ Ver en Mapa: https://maps.google.com/?q=${tarea.geo_lat},${tarea.geo_lon}${salto}`;
    }

    // 4. Detalle de Actividades
    msg += `${salto}📋 ${negrita}Actividades a realizar:${negrita}${salto}`;
    if (items && items.length > 0) {
        items.forEach(item => {
            const nombre = item.label || item.actividad?.nombre || item.sub_actividad?.nombre || 'Actividad';
            const cant = item.cantidad_asignada || 0;
            msg += `🔹 ${nombre} (${cant})${salto}`;
        });
    } else {
        msg += `🔹 Ver detalle en sistema${salto}`;
    }

    // 5. Materiales (Si hay consumos declarados o requeridos)
    // (Opcional: podrías agregar aquí si requiere materiales)

    // 6. Archivos Adjuntos
    if (tarea.archivo_plano_url) {
        msg += `${salto}📎 ${negrita}Plano/Doc:${negrita} ${tarea.archivo_plano_url}${salto}`;
    }

    msg += `${salto}⚠️ Por favor confirmar recepción.`;

    return msg;
  },

  /**
   * Abre la ventana de WhatsApp con el mensaje
   */
  enviarOT(numero, tarea, items, proyectoInfo) {
    const fono = this.formatearNumero(numero);
    if (!fono) {
        alert("El proveedor no tiene un número de teléfono válido registrado.");
        return;
    }

    const texto = this.generarMensajeOT(tarea, items, proyectoInfo);
    // Codificamos el mensaje para la URL
    const encoded = encodeURIComponent(texto);
    // Usamos window.open para abrir WhatsApp Web o App
    window.open(`https://wa.me/${fono}?text=${encoded}`, '_blank');
  }
};