# Investigación — SPEC-231

## Fuentes revisadas

- `INSTRUCTIVO-002-PI-131-SIDEBAR-PADRE-RUTAS-BASE.md`
- `BRIEF-MODULO-PADRE-v2-EXPEDIENTE.md` §11.1 (vista padre) y §15 (coordinación con Pagos)
- `src/components/modules/colegio/ColegioSideNav.tsx` — patrón de sidebar con grupo expandible.
- `src/components/modules/AdminNav.tsx` — patrón de sidebar simple con íconos.
- `src/lib/nav-items.ts` — estructura de items y relación con módulos.
- `src/lib/proxy.ts` — rutas de usuario final: `/dashboard` cubre `/dashboard/padre` para PARENT.
- `src/app/dashboard/layout.tsx` — guarda de vigencia para PARENT.
- `src/app/dashboard/colegio/layout.tsx` — patrón de layout con sidebar.
- `tailwind.config.ts` — tokens `cielo` ya definidos.
- `src/app/globals.css` — clase `.theme-colegio` como referencia para `.theme-padre`.

## Decisiones técnicas

### 1. Patrón de sidebar
Se hereda el patrón de `ColegioSideNav`: componente `"use client"` con `usePathname`, íconos SVG inline, estado activo con fondo sólido y texto blanco. Se omite el grupo expandible porque los 7 items son planos.

### 2. Tema padre
No existe `.theme-padre` en `globals.css`. Se propone crear una clase análoga a `.theme-colegio` que re-mapee los tokens semánticos a la familia `cielo`. Esto permite que componentes genéricos como `accent-gradient` usen el color correcto dentro del área padre.

### 3. Permisos por módulo
El catálogo de módulos (`permisos-catalogo.ts`) no tiene claves para PARENT. En lugar de agregar módulos y forzar seed/migración, se decide mostrar todos los items del sidebar padre. El proxy ya protege las rutas por rol. Si en el futuro se requiere granularidad, se extiende el catálogo.

### 4. Coordinación con SPEC-211
El item "Suscripción" apunta a `/dashboard/padre/suscripcion` y renderiza placeholder. SPEC-211 solo reemplazará el contenido de esa página, sin tocar `PadreSideNav` ni `layout.tsx`.

### 5. Rutas antiguas
`/dashboard/mis-reportes`, `/dashboard/circulo-confianza`, `/dashboard/apelaciones` siguen vivas. No se redirigen ni se eliminan. La migración de contenido se evaluará en una fase posterior.

## Alternativas consideradas

| Alternativa | Descartada por |
|---|---|
| Crear módulos de permisos para padre | Añade complejidad de seed/migración sin beneficio inmediato. |
| Reutilizar `ColegioSideNav` con props | Acopla áreas distintas; mejor componente propio por área. |
| Redirigir `/dashboard/mis-reportes` a `/dashboard/padre/reportar` | Rompe flujos existentes y bookmarks; fuera de alcance. |
