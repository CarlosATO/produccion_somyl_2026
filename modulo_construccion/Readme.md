# módulo_construccion

Frontend del módulo de producción / planificación del proyecto SOMYL (2026).

## Descripción
Interfaz React + Vite para gestión Kanban y Cronograma (react-calendar-timeline) de actividades y proveedores.

## Requisitos
- Node.js (>= 18 recommended)
- npm o yarn

> Nota: Este submódulo es solo frontend; las dependencias Python del proyecto principal están en la raíz (`portal_sso/requirements.txt`).

## Instalación
Desde la carpeta `modulo_construccion`:

```bash
npm install
# o
# yarn
```

## Desarrollo
Levantar servidor de desarrollo:

```bash
npm run dev
# o
# yarn dev
```

Abrir http://localhost:5173 (o la URL que muestre Vite).

## Build
Generar versión de producción:

```bash
npm run build
```

## Subir a GitHub
Si no has inicializado git:

```bash
cd modulo_construccion
git init
git add .
git commit -m "Init: modulo_construccion"
git remote add origin https://github.com/CarlosATO/produccion_somyl_2026.git
git branch -M main
git push -u origin main
```

Si ya está inicializado, simplemente:

```bash
git add .
git commit -m "Update: front modulo_construccion"
git push
```

## Notas
- Las dependencias de Node están en `package.json`.
- `requirements.txt` en este directorio se incluye para uniformidad, pero no aplica dependencias Python para este módulo.

---
Si quieres, agrego un `CONTRIBUTING.md` o una plantilla de GitHub Actions para CI (build/test). ¿Quieres eso también?