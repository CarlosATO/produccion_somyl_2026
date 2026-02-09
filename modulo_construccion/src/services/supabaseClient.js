import { createClient } from '@supabase/supabase-js'

// 1. Cliente Principal (Construcción)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Verificación de seguridad
if (!supabaseUrl || !supabaseKey) {
  console.error('🚨 Faltan variables de entorno en .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// 2. Cliente Secundario (Logística)
const logisticaUrl = import.meta.env.VITE_SUPABASE_LOGISTICA_URL
const logisticaKey = import.meta.env.VITE_SUPABASE_LOGISTICA_KEY

export const supabaseLogistica = createClient(logisticaUrl, logisticaKey)