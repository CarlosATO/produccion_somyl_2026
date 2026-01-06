import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnv(envPath) {
  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split(/\r?\n/)
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    const value = trimmed.slice(idx + 1)
    env[key] = value
  }
  return env
}

async function main() {
  try {
    const envPath = path.resolve(new URL(import.meta.url).pathname, '..', '.env')
    // Try modulo_construccion/.env first
    const candidate = path.resolve(process.cwd(), 'modulo_construccion', '.env')
    const envFile = fs.existsSync(candidate) ? candidate : envPath
    const env = loadEnv(envFile)

    const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const key = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

    console.log('Using Supabase URL:', url ? '(provided)' : '(missing)')
    console.log('Using Supabase Key:', key ? '(provided)' : '(missing)')

    if (!url || !key) {
      console.error('Supabase credentials not found. Aborting test.')
      process.exit(1)
    }

    const supabase = createClient(url, key)

    console.log('Querying proyectos: activo=true, cliente!=SOMYL, order by proyecto')
    const { data, error } = await supabase
      .from('proyectos')
      .select('*')
      .eq('activo', true)
      .neq('cliente', 'SOMYL')
      .order('proyecto', { ascending: true })
      .limit(50)

    if (error) {
      console.error('Supabase error:', error)
      process.exit(2)
    }

    console.log('Rows returned:', Array.isArray(data) ? data.length : 0)
    console.log(JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Unexpected error:', err)
    process.exit(3)
  }
}

main()
