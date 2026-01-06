import { supabase } from './supabaseClient'

export const storageService = {
  
  // Sube un archivo al bucket 'proyectos-files'
  // Retorna la URL pública
  async subirArchivo(file, carpeta = 'planos') {
    if (!file) return null
    // 1. LIMPIEZA DE NOMBRE:
    // Reemplazamos espacios y caracteres raros por guiones bajos.
    // Solo dejamos letras, números y puntos.
    const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
    
    // 2. CREAR NOMBRE ÚNICO
    const fileName = `${Date.now()}_${cleanName}`
    const filePath = `${carpeta}/${fileName}`

    // 3. SUBIR
    const { data, error } = await supabase.storage
      .from('proyectos-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error("Error subiendo archivo:", error)
      throw error
    }

    // 4. OBTENER URL
    const { data: urlData } = supabase.storage
      .from('proyectos-files')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  }
}