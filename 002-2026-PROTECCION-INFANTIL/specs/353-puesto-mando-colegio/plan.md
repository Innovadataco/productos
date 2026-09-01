# Implementation Plan: Puesto de mando del rector (SPEC-353 · A-69 · C6)

**Branch**: `work/pi-SPEC-353-puesto-mando-colegio` | **Date**: 01-09-2026 | **Spec**: [spec.md](spec.md)

## Summary

Dos frentes chicos sobre infraestructura existente. (1) La home del rector
gana una tarjeta "qué hacer hoy": el DTO `homeRector` se extiende con 3
derivados (casos comité, última alerta sin abrir, identificador cruzado — un
`groupBy` nuevo), y un módulo puro `calcularQueHacerHoy` (espejo de
`calcularSugerenciaHome` del padre) elige UNA frase priorizada por gravedad.
(2) La pantalla de Configuración del colegio se rediseña in-place con la
experiencia A-62 del padre: frases + `Switch` + guardado inmediato + cabecera
de correo; el contrato GET/PATCH del backend no cambia.

## Technical Context

**Language/Version**: TypeScript 5 estricto · Next.js 16 App Router · React 19.
**Primary Dependencies**: solo existentes (Prisma para el agregado; `Switch` UI).
**Storage**: cero migraciones; un `groupBy` de lectura sobre `AlertaColegio`.
**Testing**: Vitest — unit para `calcularQueHacerHoy` (una prueba por regla de
prioridad) y para la tarjeta; integración para el agregado y el DTO extendido;
los tests existentes de `/api/colegio/preferencias-avisos` pasan sin cambios
(SC-004). **Target**: web, móvil 390 px. **Scale**: ~8 archivos tocados, 2
componentes nuevos, 0 endpoints nuevos.

## Constitution Check

| Principio | Cumplimiento |
|---|---|
| §1.3 Presunción de inocencia | ✅ La frase solo trae conteos; JAMÁS el valor de un identificador ni nombres (FR-004/SC-005). |
| §1.2 Solo texto / §4.5 aditivo | ✅ Sin multimedia; cero migraciones. |
| §3.1/3.2 TS estricto | ✅ módulo puro tipado; agregado con tipos Prisma. |
| §7.3 Estilos | ✅ Tailwind; ámbar único color de alerta; usted formal. |
| Reglas de oro | ✅ Sin cambios de schema/proxy/navegación → arch:check debería seguir verde; se corre igual. |

**Veredicto**: PASA (pre y post diseño).

## Project Structure

```text
specs/353-puesto-mando-colegio/   # spec, plan, tasks, cierre
src/lib/colegio/que-hacer-hoy.ts             # NUEVO · módulo puro (espejo home-sugerencia.ts del padre)
src/lib/colegio/que-hacer-hoy.test.ts        # NUEVO · unit por regla
src/lib/dal/repositories/alerta-colegio.ts   # MOD · +identificadorCruzado7d() (groupBy)
src/lib/dal/repositories/colegio-resumen.ts  # MOD · homeRector +3 campos (comité vía repo existente)
src/components/modules/colegio/home/QueHacerHoyCard.tsx   # NUEVO · tarjeta mockup 2.1
src/components/modules/colegio/home/QueHacerHoyCard.test.tsx # NUEVO
src/components/modules/colegio/home/HomeRectorPage.tsx    # MOD · inserta la tarjeta entre Hero y Embudo
src/app/dashboard/colegio/configuracion/ConfiguracionPageClient.tsx # MOD · rediseño A-62 in-place
src/app/dashboard/colegio/configuracion/ConfiguracionPageClient.test.tsx # MOD/NUEVO
vitest.unit.includes.ts                      # MOD · tests unit nuevos
```

**Decisiones (research inline — spec chica, sin research.md aparte):**

- **R1 · Prioridad**: cruzado > sin-abrir > comité > calma; lista ordenada en
  el módulo puro, reordenable por el CEO en una línea.
- **R2 · Agregado cruzado**: `AlertaColegio.groupBy(['identificadorAlumnoId'])`
  con filtro visible + `creadoEn >= hoy-7d`, y en memoria contar
  `alumnoId` distintos por identificador (o SQL crudo con
  `COUNT(DISTINCT "alumnoId") > 1` si el groupBy de Prisma no alcanza —
  decidir en implementación; ambos leen índices existentes).
- **R3 · Comité**: reusar `ComiteConvivenciaSolicitudesRepository` (bloque
  `casosAbiertos` existente) — no duplicar queries.
- **R4 · Preferencias**: rediseño IN-PLACE en la misma ruta (vía barata del
  mapa: cero cambios de nav/permisos). Estructura del componente copiada del
  patrón del padre (`PreferenciasNotificaciones.tsx`): catálogo de frases,
  switch por fila con spinner, PATCH inmediato, reversión si falla; umbrales
  como frase con inputs embebidos y persistencia en blur.
- **R5 · Textos de las 4 frases** (usted formal):
  `REPORTE_NUEVO` → "Cuando alguien reporte una cuenta de su comunidad" /
  `UMBRAL_CURSO` → "Cuando un curso acumule varios reportes en pocos días" /
  `ESTUDIANTE_REPETIDO` → "Cuando un mismo estudiante vuelva a aparecer" /
  `RESUMEN_SEMANAL` → "Un resumen de su colegio cada semana".

## Complexity Tracking

Sin violaciones. Superficie mínima: 1 agregado de lectura + 1 módulo puro +
1 tarjeta + 1 rediseño de pantalla existente.
