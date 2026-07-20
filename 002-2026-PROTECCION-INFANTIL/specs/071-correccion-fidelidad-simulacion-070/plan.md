# Plan: Corrección de fidelidad de la simulación (Spec 071)

**Branch**: `[feature/001-scaffolding]` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/071-correccion-fidelidad-simulacion-070/spec.md`. Corrección al Spec 070 cerrado; no se implementa código hasta aprobación humana.

---

## Summary

Alinear el set de entrada y la ejecución de la simulación con el formulario anónimo real. El parser y el executor del 070 omiten `fechaIncidente`, `ciudad`, `pais` y `edadVictima`, y rellenan los primeros tres con valores fijos. Esta corrección amplía `CasoSimulacion` para que acepte exactamente los campos de `crearReporteSchema`, valida por línea, y pasa esos valores al pipeline real sin inventar nada. Se mantiene `categoriaEsperada` solo en `SimulacionReporte` para medir aciertos. No se modifica el modelo `Reporte`; el override de modelo sigue por job de pg-boss (Opción A). Se añade una verificación de fidelidad en el `quickstart.md`.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.x / Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 App Router, Prisma 5.22.0, zod, pg-boss |
| **Storage** | PostgreSQL 16+ (Docker Compose) |
| **Testing** | Vitest + jsdom |
| **Target Platform** | Docker Compose en Mac Studio / VPS |
| **Project Type** | Web application (full-stack Next.js) |
| **Performance Goals** | Validación de 200 casos en < 5 segundos; ejecución igual al pipeline real |
| **Constraints** | Sin cambios al modelo `Reporte`; sin parámetro temporal de modelo; migración aditiva si aplica |
| **Scale/Scope** | Corrección del parser y executor de simulación; tests; quickstart |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| §1.2 Solo texto — sin multimedia | ✅ Pass | La corrección solo manipula texto y datos estructurados |
| §1.3 Presunción de inocencia | ✅ Pass | No afecta la consulta pública ni el etiquetado de personas |
| §1.4 Umbral parametrizable en BD | ✅ Pass | No se modifica el umbral ni los parámetros de visibilidad |
| §2.1 Stack heredado (Next.js, Prisma, JWT manual, no NextAuth) | ✅ Pass | No se introducen nuevas dependencias |
| §2.2 Roles | ✅ Pass | Solo accede ADMIN; no cambios de permisos |
| §2.3 Multi-tenant | ✅ Pass | No se toca el aislamiento |
| §2.4 Modelo SaaS | ✅ Pass | No se toca el modelo de facturación |
| §3.1 TypeScript strict (no `any`) | ✅ Pass | El cambio es tipado con zod |
| §3.4 Códigos HTTP correctos | ✅ Pass | No se cambian endpoints ni códigos |
| §3.5 Logs y auditoría | ✅ Pass | Se mantiene el logger existente |
| §3.6 Límites de tamaño | ✅ Pass | Se respetan los mismos límites de `crearReporteSchema` |
| §4.1 Singletons | ✅ Pass | Prisma singleton se mantiene |
| §4.2 Rutas API individuales | ✅ Pass | No se fusionan endpoints |
| §4.3 Paginación estándar | ✅ Pass | No aplica a esta corrección |
| §6.1 JWT en cookie httpOnly | ✅ Pass | No se toca autenticación |
| §6.2 Validación manual explícita | ✅ Pass | Se usa zod como en el resto del proyecto (es explícita por esquema) |
| §6.3 Datos sensibles encriptados | ✅ Pass | Se mantiene el cifrado de `textoOriginal` |

**Re-check post-design**: All gates still pass. No violations.

---

## Project Structure

### Documentation (this feature)

```text
specs/071-correccion-fidelidad-simulacion-070/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── simulacion.md    # Cambios en el schema de entrada
├── checklists/
│   └── requirements.md  # Specification quality checklist
└── tasks.md             # Phase 2 output
```

### Source Code (repository root) — archivos a modificar

```text
002-2026-PROTECCION-INFANTIL/
├── src/
│   ├── lib/
│   │   ├── schemas/
│   │   │   └── simulacion.ts        # Ampliar casoSimulacionSchema
│   │   ├── simulacion/
│   │   │   ├── parser.ts            # Aceptar nuevos campos; validar por línea
│   │   │   └── executor.ts          # Pasar campos reales al crear Reporte
│   │   └── queue.ts                 # Verificar que sendReporte acepta modelo override (ya implementado)
│   └── app/
│       └── api/
│           └── admin/
│               └── ia/
│                   └── simulaciones/
│                       └── route.ts # No cambia; ya valida con crearSimulacionSchema
└── tests/
    └── src/lib/simulacion/          # Nuevos o actualizados: parser.test.ts, executor.test.ts
```

**Structure Decision**: No se crean nuevos archivos de estructura; se modifican los existentes del 070. El cambio es autocontenido en el módulo de simulación.

---

## Complexity Tracking

| Área | Complejidad | Riesgo | Notas |
|---|---|---|---|
| Ampliación del schema de entrada | Baja | Bajo | Reutilizar `crearReporteSchema` para no duplicar reglas |
| Parser CSV/JSON con nuevos campos | Media | Bajo | Mantener compatibilidad de nombres de columna; manejar opcionales |
| Executor con campos reales | Baja | Bajo | Solo cambiar qué valores se pasan a `prisma.reporte.create` |
| Continuidad de corrida ante fallos | Media | Medio | Registrar error, no detenerse; reflejar en métricas finales |
| Verificación de fidelidad en quickstart | Baja | Bajo | Documentar queries de BD para comparar reportes |
| Tests de parser y executor | Media | Bajo | Cubrir campos nuevos, errores por línea, fallos |
| Migración | Ninguna | Bajo | `SimulacionReporte` ya tiene `categoriaEsperada`; no se toca `Reporte` |

---

## Decisiones de diseño propuestas

1. **Schema de entrada = `crearReporteSchema` + `categoriaEsperada` opcional**:
   - `casoSimulacionSchema` se redefine como `crearReporteSchema.extend({ categoriaEsperada: z.string().max(100).optional() })`.
   - Esto garantiza que las reglas de validación sean idénticas a las del formulario anónimo y se mantengan sincronizadas automáticamente si cambia `crearReporteSchema`.
   - `categoriaEsperada` se quita antes de crear el reporte; solo se usa en `SimulacionReporte`.

2. **Campos de ubicación como texto libre**:
   - El formulario anónimo permite `ciudad` y `pais` como texto libre y opcionalmente `ciudadId`/`paisId`. Para la simulación se usan solo `ciudad` y `pais` como texto; no se requiere que el parser resuelva IDs geográficos.
   - Esto simplifica la entrada y sigue siendo fiel al caso en que el usuario escribe manualmente la ciudad/país sin seleccionar del dropdown.

3. **No se soporta formato legacy del 070**:
   - Los archivos CSV/JSON del 070 que solo tengan `texto,plataforma,identificador` se rechazarán con mensaje claro indicando que faltan `fechaIncidente`, `ciudad` y `pais`.
   - Justificación: el 071 es una corrección de fidelidad, no una nueva feature paralela; mantener legacy duplicaría la lógica y permitiría seguir probando con datos incompletos.

4. **Continuidad ante fallos de un caso**:
   - El executor actualiza el estado de la corrida a `FALLIDA` y detiene la creación de reportes ante el primer error. La corrección propone registrar el error por caso, continuar con los demás y al final marcar la corrida como `COMPLETADA` con un conteo de fallos, o `FALLIDA` solo si todos los casos fallaron.
   - El estado `FALLIDA` se reserva para errores irreversibles de la corrida (por ejemplo, no se puede leer `SimulacionRun`); un caso individual fallido no detiene a los demás.

5. **Override de modelo por job (Opción A confirmada)**:
   - Se mantiene el mecanismo aprobado: `sendReporte(reporteId, { modeloClasificacion })`.
   - No se usa parámetro temporal ni se toca `ParametroSistema`.
   - Se verifica en `research.md` que el worker y `cargarParametrosClasificacion` soportan el override.

6. **Verificación de fidelidad en quickstart**:
   - Paso a paso: crear un reporte real por `POST /api/reportes` con datos X; crear una corrida con un único caso con los mismos datos X (salvo `identificador`); comparar ambos registros en BD por `texto`, `fechaIncidente`, `ciudad`, `pais`, `edadVictima`, `esAnonimo`, y transiciones.
   - Se documenta la query SQL o Prisma para hacer la comparación.

---

## Riesgos y mitigaciones

- **Riesgo**: Al ampliar el schema, archivos de simulación existentes dejan de funcionar. **Mitigación**: mensaje de error claro y documentación en quickstart; el 071 es una corrección intencional, no un breaking change accidental.
- **Riesgo**: El pipeline real falla más a menudo con datos reales (ciudad/país desconocidos, fechas variadas). **Mitigación**: continuidad ante fallos; los casos fallidos se registran pero no detienen la corrida.
- **Riesgo**: Duplicar la lógica de validación entre `crearReporteSchema` y `casoSimulacionSchema`. **Mitigación**: `casoSimulacionSchema` extiende `crearReporteSchema`; una sola fuente de verdad.
- **Riesgo**: `fechaIncidente` como string ISO vs. Date en el parser. **Mitigación**: `crearReporteSchema` ya espera string ISO; el executor convierte a `Date` solo al crear el reporte, igual que `src/app/api/reportes/route.ts`.
- **Riesgo**: Tests existentes del 070 asumen el formato antiguo. **Mitigación**: se actualizan los tests del parser y executor; se verifica que los tests de integración de endpoints sigan pasando (no deberían romperse porque la API de creación de simulación no cambia).

---

## Approach

1. **Research**: verificar `crearReporteSchema`, el pipeline de `POST /api/reportes`, el override de modelo por job, y el schema de `SimulacionRun`/`SimulacionReporte`.
2. **Diseño**: ampliar `casoSimulacionSchema`, actualizar parser y executor, decidir la estrategia de continuidad ante fallos.
3. **Planificación**: crear `tasks.md` con fases y dependencias.
4. **Revisión humana**: entregar el plan y detenerse hasta aprobación.
5. **Implementación (tras aprobación)**: modificar schema, parser, executor, tests y quickstart; validar con tsc/lint/test/build/deploy.

---

## Notes

- No se crean nuevos endpoints; los endpoints existentes del 070 (`/api/admin/ia/simulaciones`) no cambian de interfaz. El cambio es interno en el parser y executor.
- `categoriaEsperada` sigue siendo opcional y solo afecta las métricas de acierto; no se pasa al modelo.
- El campo `casosJson` de `SimulacionRun` ya almacena el set completo; solo cambia su estructura (nuevos campos por caso).
- La migración, si se requiere, es aditiva: no se modifica `Reporte`; si se decide añadir un campo `errores` a `SimulacionRun` para contar fallos, es una columna opcional nueva. En este plan se propone evitar incluso eso: contar fallos en el cálculo de métricas sobre `Reporte.estado` y `SimulacionReporte`.
