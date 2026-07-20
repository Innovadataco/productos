# Research — Spec 043: UX del comité y navegación del padre

## Hallazgos verificados

### 1. Navegación del padre autenticado a `/dashboard` (consulta enriquecida)

- **Archivo**: `src/components/modules/NavHeader.tsx`.
- **Estado actual**: el botón "Dashboard" del header siempre apunta a `/dashboard-publico` (línea 78). El menú desplegable del usuario `PARENT` no incluye un enlace a `/dashboard`; solo muestra "Círculo de Confianza" y "Mis reportes" (líneas 132-141).
- **Página existente**: `/dashboard/page.tsx` renderiza `DashboardUsuarioClient`, que muestra "Mis reportes" y "Consulta enriquecida". Esta vista está implementada pero es inalcanzable desde la navegación para un padre autenticado.
- **Impacto**: el usuario autenticado no descubre la consulta enriquecida ni su propio panel de reportes desde el header; debe saber la URL o navegar desde otro punto.

### 2. Bandeja del comité con pestañas y paso "Asignarme"

- **Archivo**: `src/components/modules/ComiteBandeja.tsx`.
- **Estado actual**: tiene dos pestañas (Pendientes/Mías) y un botón "Asignarme" por fila en la pestaña Pendientes. La lista "Mías" consume `/api/admin/comite/mias`.
- **Problema**: el comité debe hacer clic explícito en "Asignarme" antes de poder ver el detalle y resolver. Esto añade un paso innecesario y no coincide con el patrón de la bandeja de operadores, donde al abrir un caso se trabaja directamente.
- **Impacto**: fricción en el flujo de resolución del comité; riesgo de que dos miembros intenten asignarse el mismo caso.

### 3. Resolver del comité con opciones "Clasificar/Corregir"

- **Archivo**: `src/components/modules/ComiteSolicitudDetalle.tsx` y `src/app/api/admin/comite/[id]/resolver/route.ts`.
- **Estado actual**: el detalle muestra dos radio buttons, "Clasificar" y "Corregir". El endpoint acepta `accion: "CLASIFICAR" | "CORREGIR"` y deja el reporte en `CLASIFICADO` o `CORREGIDO` respectivamente.
- **Problema**: la distinción entre "Clasificar" y "Corregir" es confusa para el usuario. Ambas son acciones humanas de resolución del comité; la acción de la IA ya ocurrió previamente. El resultado final siempre debe ser una decisión humana del comité, no replicar el estado de la IA.
- **Impacto**: el comité no sabe cuál botón elegir; el estado `CLASIFICADO` puede parecer que el comité confirma la IA, mientras que `CORREGIDO` es más claro como decisión humana.

### 4. Copy del Círculo de Confianza

- **Archivo**: `src/app/dashboard/circulo-confianza/page.tsx`, línea 364.
- **Estado actual**: el texto dice "Recibir emails ciegos cuando haya novedades en mi Círculo de Confianza".
- **Problema**: la frase "emails ciegos" es técnica/jerga y no queda clara para el usuario final. La funcionalidad real es recibir un aviso por email cuando un contacto del círculo aparece en un reporte.
- **Impacto**: confusión sobre qué se está activando.

## Recomendaciones de UI/UX Pro Max

Se consultó `/skill:ui-ux-pro-max` para el rediseño de UI. Principales recomendaciones aplicables:

- **Patrón**: Community/Forum Landing, adaptado a dashboards internos.
- **Estilo**: Glassmorphism (ya usado en el proyecto).
- **Colores**: rojo de alerta (#DC2626) + azul de seguridad (#2563EB) — consistentes con la paleta existente.
- **Tipografía**: Fira Sans / Fira Code para dashboards técnicos.
- **Efectos**: backdrop blur, bordes sutiles, z-depth.
- **Pre-delivery checklist**: sin emojis, focus states visibles, hover 150-300ms, responsive, reduced motion.
- **Navegación**: evitar navegación sobrecargada; usar jerarquía clara y deep linking.
- **Listas unificadas**: preferir una sola lista con estados visibles en lugar de pestañas que ocultan contexto.

## Referencias

- `src/components/modules/NavHeader.tsx`
- `src/components/modules/DashboardUsuarioClient.tsx`
- `src/components/modules/ComiteBandeja.tsx`
- `src/components/modules/ComiteSolicitudDetalle.tsx`
- `src/app/api/admin/comite/[id]/resolver/route.ts`
- `src/app/dashboard/circulo-confianza/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/modules/AdminReportesTable.tsx` (patrón de bandeja de operadores)
