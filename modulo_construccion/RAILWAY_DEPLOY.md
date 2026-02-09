# Deploy en Railway - Módulo Construcción

## Configuración del Servicio en Railway

### 1. Source
- **Repository**: `CarlosATO/produccion_somyl_2026`
- **Branch**: `main`
- **Root Directory**: `/modulo_construccion` (si está en subdirectorio, de lo contrario déjalo vacío)

### 2. Build Settings
- **Builder**: Railpack (por defecto)
- **Build Command**: `npm install --include=dev && npm run build`

### 3. Deploy Settings
- **Start Command**: `npm start`
- **Port**: `8080` (Railway asignará automáticamente el puerto correcto vía variable `$PORT`)

### 4. Variables de Entorno Requeridas

```env
# Supabase - Proyectos
VITE_SUPABASE_URL=https://reubvhoexrkagmtxklek.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJldWJ2aG9leHJrYWdtdHhrbGVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3Nzc5MDUsImV4cCI6MjA2MzM1MzkwNX0.imEGNuzGcgrpyo0-Wc_1teZKft0t7RNwSJ7apoy-_sM

# Supabase - Logística (para obtener datos de stock)
VITE_LOGISTICA_URL=https://meskxoyxhbvnataavkkh.supabase.co
VITE_LOGISTICA_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lc2t4b3l4aGJ2bmF0YWF2a2toIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzQxNjczNywiZXhwIjoyMDYyOTkyNzM3fQ.xHmOZ82XNi4vlmOagp3DtnKyoqofmnOTuGH8EEHoP-w
VITE_SUPABASE_LOGISTICA_URL=https://meskxoyxhbvnataavkkh.supabase.co
VITE_SUPABASE_LOGISTICA_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lc2t4b3l4aGJ2bmF0YWF2a2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MTY3MzcsImV4cCI6MjA2Mjk5MjczN30.515W1Jy3BMTXwl5bcDFivVdNhGKsdv-v-FFDrD_MjO4

# Backend API (Portal SSO - IMPORTANTE!)
VITE_BACKEND_URL=https://[TU-PORTAL-SSO-BACKEND].up.railway.app

# Portal SSO (URL del portal para regresar si no hay token)
VITE_PORTAL_URL=https://[TU-PORTAL-SSO].up.railway.app
```

**NOTA IMPORTANTE**: La variable `VITE_BACKEND_URL` debe apuntar al servicio backend del portal_sso donde están los endpoints `/api/proyectos`, `/api/mis-accesos`, etc.

### 5. Networking
- **Public Networking**: Habilitado
- **Port**: `8080`
- **Domain**: `produccionsomyl2026-production.up.railway.app`

### 6. Configuración del Portal SSO

**IMPORTANTE**: En el servicio del **portal_sso** (no en este), debes agregar la siguiente variable de entorno:

```env
URL_CONSTRUCCION=https://produccionsomyl2026-production.up.railway.app
```

Esto asegura que cuando los usuarios hagan clic en "Construcción" desde el portal, sean redirigidos a esta URL con el token SSO.

## Troubleshooting

### Problema: Pantalla en blanco o error de rutas
- **Causa**: El servidor no está configurado para SPAs con React Router
- **Solución**: Asegúrate de que el comando de start sea `npm start` (que usa `serve` con la opción `-s` para SPAs)

### Problema: Token no se recibe
- **Causa**: La variable `URL_CONSTRUCCION` no está configurada en el portal_sso
- **Solución**: Agrega la variable en el servicio portal_sso en Railway

### Problema: Error de CORS
- **Causa**: El módulo intenta hacer requests al backend local
- **Solución**: El módulo NO debe hacer llamadas al backend `/api` en producción (solo en desarrollo via proxy)
