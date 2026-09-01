# Data Model · SPEC-340 · el hilo

**Fase 1** · 01-09-2026 · tres migraciones, todas aditivas.

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
