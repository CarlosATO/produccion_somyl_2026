import { supabase } from './supabaseClient'
import COMUNAS_CHILE from '../data/comunasChile'

export const zonasService = {

  // --- ZONAS ---

  async getZonas(proyectoId) {
    const { data, error } = await supabase
      .from('prod_zonas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('id', { ascending: true })
    if (error) throw error
    return data
  },

  async crearZona(zona) {
    // Normalizar comuna si viene en zona
    const payload = { ...zona }
    if (payload.comuna) {
      const match = COMUNAS_CHILE.find(c => c.toLowerCase() === String(payload.comuna).trim().toLowerCase())
      if (match) payload.comuna = match
      else payload.comuna = String(payload.comuna).trim()
    }

    const { data, error } = await supabase
      .from('prod_zonas')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async eliminarZona(id) {
    const { error } = await supabase.from('prod_zonas').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // --- TRAMOS ---

  async getTramos(zonaId) {
    const { data, error } = await supabase
      .from('prod_tramos')
      .select('*')
      .eq('zona_id', zonaId)
      .order('id', { ascending: true })
    if (error) throw error
    return data
  },

  async crearTramo(tramo) {
    const { data, error } = await supabase
      .from('prod_tramos')
      .insert(tramo)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async eliminarTramo(id) {
    const { error } = await supabase.from('prod_tramos').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // --- IMPORTACIÓN MASIVA (CON GEO) ---

  async importarZonasMasivas(proyectoId, zonasEstructuradas) {
    // Estructura: { nombre, direccion, comuna, hp, geo_lat, geo_lon, tramos: [] }
    
    const errores = [];
    let procesados = 0;

    for (const item of zonasEstructuradas) {
      try {
        // 1. Crear la Zona con sus nuevos atributos GEO
        const zonePayload = {
            proyecto_id: proyectoId, 
            nombre: item.nombre,
            direccion: item.direccion || null,
            comuna: item.comuna || null,
            hp: item.hp || null,
            // NUEVOS CAMPOS
            geo_lat: item.geo_lat || null,
            geo_lon: item.geo_lon || null
        };

        const { data: zonaData, error: zonaError } = await supabase
          .from('prod_zonas')
          .insert(zonePayload)
          .select()
          .single();

        if (zonaError) throw zonaError;

        const zonaId = zonaData.id;

        // 2. Crear los Tramos asociados
        if (item.tramos && item.tramos.length > 0) {
          const validTramos = item.tramos.filter(t => t && t.trim().length > 0);
          
          if(validTramos.length > 0) {
              const tramosToInsert = validTramos.map(nombreTramo => ({
                proyecto_id: proyectoId,
                zona_id: zonaId,
                nombre: nombreTramo
              }));

              const { error: tramosError } = await supabase
                .from('prod_tramos')
                .insert(tramosToInsert);
              
              if (tramosError) throw tramosError;
          }
        }
        procesados++;

      } catch (err) {
        console.error(`Error importando zona ${item.nombre}:`, err);
        const errorMsg = err.details || err.message || 'Error desconocido';
        errores.push({ zona: item.nombre, error: errorMsg });
      }
    }

    return { procesados, errores };
  }
}