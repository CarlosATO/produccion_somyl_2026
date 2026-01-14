import { supabase } from './supabaseClient'

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
    const { data, error } = await supabase
      .from('prod_zonas')
      .insert(zona)
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
    console.log("Intentando cargar tramos para Zona ID:", zonaId);
    
    const { data, error } = await supabase
      .from('prod_tramos')
      .select('*')
      .eq('zona_id', zonaId)
      .order('id', { ascending: true })
    
    if (error) {
      console.error("🔥 ERROR REAL DE SUPABASE (GET):", error.message, error.details, error.hint);
      throw error
    }
    return data
  },

  async crearTramo(tramo) {
    console.log("Enviando tramo a crear:", tramo);
    
    const { data, error } = await supabase
      .from('prod_tramos')
      .insert(tramo)
      .select()
      .single()
      
    if (error) {
       console.error("🔥 ERROR REAL DE SUPABASE (POST):", error.message, error.details, error.hint);
       throw error
    }
    return data
  },

  async eliminarTramo(id) {
    const { error } = await supabase.from('prod_tramos').delete().eq('id', id)
    if (error) throw error
    return true
  },

  // --- IMPORTACIÓN MASIVA ---

  async importarZonasMasivas(proyectoId, zonasEstructuradas) {
    // Nueva estructura esperada de 'zonasEstructuradas': 
    // [ 
    //   { 
    //     nombre: "P-101023", 
    //     direccion: "Calle Falsa 123", 
    //     comuna: "Santiago", 
    //     hp: "HP123", 
    //     tramos: ["Tramo A", "Tramo B"] 
    //   }, 
    //   ... 
    // ]
    
    const errores = [];
    let procesados = 0;

    for (const item of zonasEstructuradas) {
      try {
        // 1. Crear la Zona con sus nuevos atributos
        // Convertimos cadenas vacías a null para mantener la BD limpia
        const zonePayload = {
            proyecto_id: proyectoId, 
            nombre: item.nombre,
            direccion: item.direccion || null,
            comuna: item.comuna || null,
            hp: item.hp || null
        };

        const { data: zonaData, error: zonaError } = await supabase
          .from('prod_zonas')
          .insert(zonePayload)
          .select()
          .single();

        if (zonaError) throw zonaError;

        const zonaId = zonaData.id;

        // 2. Crear los Tramos asociados (si tiene)
        // (Esta parte no cambia, los tramos siguen siendo solo nombres asociados a la zona ID)
        if (item.tramos && item.tramos.length > 0) {
          // Filtramos tramos vacíos por seguridad
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
        // Agregamos detalles del error si es de Supabase
        const errorMsg = err.details || err.message || 'Error desconocido';
        errores.push({ zona: item.nombre, error: errorMsg });
      }
    }

    return { procesados, errores };
  }
}