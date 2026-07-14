# Research: Panel de Administración

## Decisiones técnicas

### Visualizaciones de dashboard sin librerías externas

**Decisión**: Usar SVG nativo y CSS Tailwind para todas las visualizaciones. Barras horizontales/verticales con `<div>` y porcentajes de ancho; donuts con SVG `stroke-dasharray`; líneas de tendencia con SVG `<polyline>`.

**Rationale**: La constitución prohíbe agregar dependencias nuevas. Tailwind + SVG nativo cubre barras, donuts, sparklines y métricas en tarjetas sin peso extra.

**Alternativas descartadas**:
- Recharts / Chart.js / D3: Añadirían 50-300 KB de bundle, violan regla de dependencias
- Canvas API: Más verboso que SVG para gráficos simples, sin beneficio claro

### Patrón de protección de rutas admin

**Decisión**: Layout anidado `src/app/dashboard/admin/layout.tsx` que verifica rol ADMIN vía `GET /api/me` en server component (con cookie). Si no es ADMIN, redirige a `/`.

**Rationale**: Next.js App Router permite layouts server-side que ejecutan antes de renderizar páginas hijas. `verifyAuth` ya existe en `src/lib/auth.ts`.

### Endpoints de agregación para estadísticas

**Decisión**: Crear `GET /api/admin/estadisticas` que ejecuta múltiples queries agregadas con Prisma (`count`, `groupBy`) y devuelve un objeto consolidado.

**Rationale**: Un solo endpoint evita múltiples round-trips desde el frontend. Las queries usan índices existentes (estado, creadoEn, plataformaId, categoria). Nunca selecciona `texto` ni `textoOriginal`.

### Tabla de datos del admin

**Decisión**: Tabla HTML nativa con Tailwind (no DataGrid ni TanStack Table). Paginación server-side, ordenación por columnas clicables con `orderBy` en Prisma.

**Rationale**: Sin dependencias nuevas. El patrón de paginación ya está en la constitución (§4.3). Para el admin, densidad de información es prioridad sobre interactividad de celdas.

## Dependencias verificadas

| Dependencia | Estado | Notas |
|-------------|--------|-------|
| Next.js App Router | ✅ Existe | Layouts anidados para protección |
| Prisma 5.22 | ✅ Existe | `groupBy` disponible para agregaciones |
| `verifyAuth` + roles | ✅ Existe | `src/lib/auth.ts` |
| Cookie httpOnly | ✅ Existe | Sin cambios |
| Tailwind CSS | ✅ Existe | Sin librería de charts |
| `pg-boss` | ✅ Existe | Worker de clasificación operativo |