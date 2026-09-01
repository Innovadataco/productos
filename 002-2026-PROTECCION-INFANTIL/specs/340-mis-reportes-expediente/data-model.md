# Data Model · SPEC-340 · el hilo

**Fase 1** · 01-09-2026 · cuatro migraciones, todas aditivas. **v2**: se suma la self-FK de la cadena (hallazgo T002, aprobado por el CEO 01-09).

## 0. `Reporte.reportePrincipalId` — la cadena gana casa propia (self-FK)

**El hallazgo**: la cadena HOY solo existía como `EventoExpediente` (exige `expedienteId`) — derogar el expediente automático la dejaba sin rastro. El brief asume lo contrario («la cadena existe siempre; el expediente es la vista»): esta migración hace verdad esa frase.

| Campo | Tipo | Notas |
|---|---|---|
| `reportePrincipalId` | `String?` FK → `Reporte` (self) | `null` = principal o suelto; con valor = evento de esa cadena |

`onDelete: SetNull` (si el principal cae por disputa, los eventos quedan — «el expediente muestra lo que queda») · índice por `reportePrincipalId`.

**Backfill**: desde `EventoExpediente` (reporteId → principal de su expediente = el evento con `ordenSecuencial` 1). Producción: 1 expediente — trivial. Guarda que aborta si un reporte aparece en dos expedientes.

**Callsites que materializan vinculación (candado 22v5, censo completo — escritura):**

| Sitio | Qué hace hoy | Qué le pasa |
|---|---|---|
| `src/app/api/reportes/route.ts:144-169` | crea/reusa expediente + 2 `agregarEvento` en la transacción | SE DEROGA: en su lugar escribe `reportePrincipalId` (resolviendo al principal si el previo ya era evento) |
| `src/lib/dal/services/reporte-creation.ts:89-102` | advisory lock + detecta duplicado → devuelve `vinculacion` | SE CONSERVA íntegro (el lock y la no-duplicación de #202 viven acá) |
| `src/app/api/padre/expedientes/[id]/eventos/route.ts:44-51` | evento manual del padre al expediente existente | SE CONSERVA (es contenido del expediente, no vinculación de reportes) |
| `scripts/limpieza/borrar-reporte.ts` | borra eventos al borrar el reporte | GANA: poner en null los `reportePrincipalId` que apunten al borrado (coherente con SetNull) |

**Lectores NO tocados** (leen `EventoExpediente` DENTRO de un expediente ya creado): compilación (`senal-comunitaria`, reglas), motor (`tareas-motor`, `tareas-aclaracion`), `publicar-evento-expediente`, timeline del círculo, comité (`ConsolidacionTimeline`), fixtures. El botón «Crear expediente» arma los eventos DESDE la cadena, y de ahí en adelante todo ese mundo funciona igual.

## 1. `InformePadre` — el historial inmutable (nuevo)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | cuid | |
| `expedienteId` | FK → `Expediente` | |
| `numeroSecuencial` | `Int` | «Informe #1», «#2»… por expediente |
| `pdfHash` | `String @unique` | SHA-256 del PDF canónico — la llave de la verificación pública |
| `codigoVerificacion` | `String` | los 16 caracteres impresos en el PDF (derivado del hash) |
| `generadoEn` | `DateTime` | la fecha que también va impresa |
| `generadoPorId` | FK → `Usuario` | el padre |

`@@unique([expedienteId, numeroSecuencial])` · índice por `expedienteId, generadoEn desc`.

**Inmutabilidad**: el modelo no tiene campos de estado ni de edición; el servicio expone SOLO crear y listar. No existe update ni delete en ninguna capa. **No** se reusa `InformeConsolidado` (research R-2: arrastra score y aprobación de comité, prohibidos para el padre).

## 2. `Expediente.origenCreacion` (nuevo campo)

`String @default("AUTOMATICO")` · valores: `AUTOMATICO` (los legados, hoy 1 en producción) · `PADRE` (los del botón). Las filas existentes conservan su historia; los nuevos nacen `PADRE`. Sin backfill: el default documenta el pasado.

## 3. Parámetros nuevos (siembra idempotente)

| Clave | Semilla | Uso |
|---|---|---|
| `padre.texto.retapado_minutos` | `10` | Reloj de re-tapado (cliente) |
| `padre.texto.stepup_minutos` | `30` | Edad de sesión que exige contraseña (SERVIDOR) |
| `padre.analisis.explicacion.<CATEGORIA>` | texto por categoría, voz del brief | «Ver análisis» en lenguaje de padre |
| `padre.expediente.auto_cierre_meses` | **`0` = apagado** (migración de UPDATE con guarda: solo si sigue en `6`) | D-1: nada se cierra nunca |

El motor trata `0` como «derogado» y no cierra (además del corte en código — doble valla).

## 4. Lo que NO cambia

- `Reporte.fechaIncidente` ya es `DateTime`: la hora siempre cupo (cero migración).
- El blindaje de «otros reportes» (FR-009 de SPEC-323): sin cambios de datos.
- `InformeConsolidado`, comité, transiciones: intactos como datos; el motor solo deja de INVOCAR el cierre.
- El texto del reporte: cifrado como está; el step-up es presentación + entrega condicionada, jamás reescritura.

## 5. Estado derivado, no almacenado

- «Crear/Ver expediente»: derivado de si la cadena tiene expediente — sin bandera.
- La capa 1: SIEMPRE calculada en vivo de la cadena (por eso «siempre al día, con o sin análisis»).
- El ámbar del escudo: derivado de `noLeidas > 0` — sin bandera nueva.
