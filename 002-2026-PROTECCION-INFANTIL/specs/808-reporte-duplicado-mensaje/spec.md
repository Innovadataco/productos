# SPEC-808 · Reporte duplicado: de «acusación + callejón» a «ya lo tienes» (string del API + comentario)

**Feature Branch**: `work/pi-SPEC-808-reporte-duplicado-mensaje`
**Created**: 2026-09-30
**Status**: DESARROLLO
**Base**: `main`

## Contexto

Dos defectos en `src/app/api/reportes/route.ts`, en el mismo lugar:
1. **:289** emitía el 429 `DUPLICATE_REPORT` con **«Ya reportaste este identificador recientemente»** —
   culpa al usuario de una decisión del SISTEMA (guardar un caso por cuenta cada 30 días) y no da salida.
2. **:281** tenía un comentario viejo: *«anónimo y otros usuarios siguen con 429 (candado 26)»*. **Falso:**
   el dedup es **autenticado-only** (`reporte-creation.ts`: el bloque está guardado por `if (usuarioId)`),
   así que el ANÓNIMO nunca llega a ese 429 — su caso lo maneja el rate-limit SOFT (POSIBLE_SPAM → 201).
   Y la referencia a «candado 26» estaba vencida (ese candado es del comité, no de este 429).

## Alcance · LAS DOS superficies (el CEO expandió: «la pantalla es la primera condición, no el paso»)

- **Tarjeta `ReporteWizard` (la cara que ve el padre):** encabezado reencuadrado **«Ya tienes un reporte
  sobre esta cuenta»** (sin «ya reportaste… recientemente»); cuerpo que enuncia el estado («ya está en el
  sistema — no necesitas empezar de nuevo»); y **TRES salidas verificadas** en vez del callejón
  {agregar · Cancelar}:
  1. **Sumar algo nuevo a este reporte** → la vinculación que YA existe (`setReportePrevioId` → paso de
     plataforma). *(Reetiqueta el «Sí, agregar otro evento».)*
  2. **Ver mi reporte** → `/dashboard/mis-reportes/{reporteExistenteId}` (renderiza `MisReporteDetalle`
     de ESE reporte; owner-gated; el reporte es suyo — dedup por-usuario). **Verificado contra el código.**
  3. **Listo** → `/mis-reportes` (su lista; página legítima del PARENT), NO de vuelta al wizard con la
     misma cuenta (eso re-disparaba el bloqueo).
- **String :289 del API** → alineado al mismo encuadre («Ya tienes un reporte sobre esta cuenta»).
- **Comentario :281** → reescrito a la conducta real (dedup autenticado-only, con el porqué: presupone
  identidad; un «duplicado» anónimo es indistinguible de dos personas reportando la misma cuenta, la
  señal que el producto recoge) + quitada la referencia vencida a «candado 26».
- **NO se toca la conducta** (dedup, ventana de 30 días, normalización del identificador — sin defecto,
  SPEC-806 retirada).

## PARÁ (verificado contra el código — gate del CEO) → NO PARÁ

Las TRES salidas de la forma EXISTEN y llevan a pantalla real (medido, no supuesto):
- **Sumar** = la vinculación de SPEC-323 (ya en `ReporteWizard`).
- **Ver mi reporte** → `/dashboard/mis-reportes/[id]/page.tsx` existe y renderiza `MisReporteDetalle
  reporteId={id}` (owner-gated; el reporte es del propio padre). **No lleva a un callejón ni miente.**
- **Listo** → `/mis-reportes/page.tsx` es la lista del PARENT (page legítima). No re-dispara el bloqueo.
→ Ninguna afirma una conducta que el producto no haga. **No PARÁ.**

**Nota de audiencia (el diff no la muestra):** el string :289 del API lo recibe un AUTENTICADO
**no-PARENT** (el PARENT recibe la oferta 200 — la tarjeta; el anónimo nunca llega). La forma es
padre-facing (tú/«cuenta»); apliqué su encuadre al string de respaldo. Si Diseño prefiere voz
«usted»/«identificador» para ese respaldo interno, es un ajuste de una línea (decisión del CEO→Diseño,
no bloquea).

## Candado

`reporte-duplicado-mensaje.candado.test.ts` (barrido de las fuentes reales, las DOS superficies):
- `route.ts`: NO contiene el string acusatorio viejo, ni «siguen con 429», ni «candado 26»; SÍ el
  encuadre nuevo y «autenticado-only».
- `ReporteWizard.tsx`: NO acusa (ni «Ya reportaste… recientemente» ni «agregar otro evento»); SÍ el
  encabezado nuevo y las TRES salidas con sus destinos (`/dashboard/mis-reportes/` y `/mis-reportes`).

## Impacto en arquitectura:

- **Esquema / proxy / datos:** SIN cambios.
- **Navegación:** la tarjeta agrega dos enlaces a páginas EXISTENTES (`/dashboard/mis-reportes/{id}`,
  `/mis-reportes`); no agrega pantalla ni ítem de menú. arch:check VERDE (menú honesto).
- **Tests:** candado en el carril `test:unit` (corre y bloquea vía `pi-gate`). route tests (39) +
  ReporteWizard.test (21) siguen verdes — la conducta no cambia.
