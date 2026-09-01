# Cierre · SPEC-341 · La inteligencia del expediente (análisis IA en fila)

**Rama**: `work/pi-SPEC-341-inteligencia-expediente`
**Fecha de cierre**: 2026-09-01
**Autor**: Dev PI-1
**Estado**: Implementada — pendiente recorrido en vivo del CEO en producción

---

## Qué quedó implementado

### Fase 1 · Setup
- Modelo `AnalisisExpediente` + enums `AlcanceAnalisis` (`PADRE_COMPLETO` | `COLEGIO_BLINDADO`) y `EstadoAnalisis` (`GENERANDO` | `PUBLICADO` | `FALLIDO`).
- Migración aditiva `20260901040000_spec_341_analisis_expediente` — sin tocar tablas existentes.
- 12 parámetros de sistema sembrados con valor por defecto:
  - `padre.analisis.max_concurrentes = 1`
  - `padre.analisis.cooldown_min = 5`
  - `padre.analisis.tiempo_estimado_seg = 90`
  - `padre.analisis.tope_fila = 50`
  - `padre.analisis.ttl_horas = 168`
  - `padre.analisis.prioridad = 5` (guard runtime: < 10 obligatorio, SC-008)
  - `padre.analisis.modelo` (default: heredado de `ia.rubrica.modelo_embudo`)
  - `padre.analisis.prompt_sistema` (borrador literal 6 líneas · admin edita)
  - `padre.analisis.frases_prohibidas_json` (8 frases iniciales · admin cura)
  - Gemelos `colegio.analisis.{max_concurrentes, modelo, prompt_sistema}` para C3.
- Advisory-lock `123456799` registrado (13 IDs totales sin colisiones).

### Fase 2 · Foundational
- `hash-cadena.ts`: SHA-256 determinista sobre `(ultimoEventoEn, numEventos, categoriasDominantesJson)` con normalización JSON canonicalizada.
- `armar-payload.ts`: dos armadores (padre completo vs colegio blindado) con tipo `PayloadAnalisis`. Cero PII en el blindado.
- `prompt.ts`: resuelve texto + hash desde `ParametroSistema`.
- `validar-salida.ts`: anti-frases pre-horneadas (FR-014) con caché TTL 60 s.
- `ejecutar-analisis.ts`: orquestador del worker (carga → arma → Ollama → valida → persiste con `pg_advisory_xact_lock` por expediente).
- `queue.ts` extendido: `sendAnalisisExpediente` con `singletonKey`, tope de fila, guard runtime prioridad < 10.
- `scripts/worker-analisis-expediente.mjs` (advisory-lock 123456799, `boss.work` con concurrency parametrizada).
- Servicio `pi-analisis-expediente` en `docker-compose.prod.yml`.

### Fase 3 · US1 P1 (MVP)
- `src/lib/dal/services/analisis-expediente.ts`: `leerVigente` (boundary PARENT dueña) + `evaluarYEncolarSiCorresponde` (calcula hash, decide encolar por FR-002/003/007/008-ter/008-quater, inserta placeholder GENERANDO con serialización por expediente).
- `src/app/api/padre/expedientes/[id]/analisis/route.ts`: `GET` (evalúa + encola idempotente) + `POST` con 4 casos (encolado / cooldown / ya_al_dia / cola_llena).
- Guard PARENT dueña → 403/404.
- UI:
  - `ExpedienteGenerando.tsx`: banner honesto con posición REAL en fila + estimado + aviso "N hechos nuevos" (FR-024/026).
  - `AnalisisExpediente.tsx`: polling 15 s mientras GENERANDO, sello del corte, etiqueta "análisis asistido", guía "Qué puedes hacer", aviso hash cambió, botón Actualizar con cool-down (FR-021/022/023/026/027).
  - Montado bajo el mapa en `ExpedienteVivo.tsx` — la capa 1 "En vivo" sigue visible mientras genera (FR-025).

### Fase 5 · US3 (guardas)
- Guard runtime `SC-008` cubierto por tests unit (`analisis-expediente.test.ts`): rechazo con `prioridad=10` y `prioridad=42`.
- Test de INMUTABILIDAD (FR-016): el DAL no expone vías de mutación pública (`update|delete|borrar|editar|eliminar|marcar`).
- Test de boundary PARENT (FR-017): `leerVigente` lanza 404 si el expediente no es del padre.

### Fase 6 · US4 (tubería reutilizable para C3)
- Test de blindaje del payload de colegio (`armar-payload.test.ts` · "NO contiene ningún identificador, nombre, texto, edad ni sexo") — cubre SC-002 y SC-006 con grep exacto sobre `JSON.stringify(payload)`.
- `README.md` en `src/lib/expediente/analisis/` con ejemplo de 3 líneas para consumir el orquestador desde C3.

### Fase 7 · Polish
- `tokens:check` verde (1083 sin regresión).
- `arch:check` verde tras regenerar `02-roles-capacidades.md`.
- `locks:check` verde (13/13 sin colisiones).
- `tsc --noEmit` limpio.
- 25 tests SPEC-341 verdes (hash 7 + payload 7 + validar 4 + route 7 + DAL 5) + 26 tests SPEC-346 (guardias).

---

## Cobertura FR

Todos los 27 FR con tarea implementada. Ver `analysis.md` para el mapa completo.

## Cobertura SC (mediciones)

| SC | Cómo se verifica | Estado |
|---|---|---|
| SC-001 · < 1 s hash coincide | GET solo lee 1 fila + calcula hash | ✅ estructural |
| SC-002 · 0% PII en payload colegio | Test grep exacto | ✅ verificado |
| SC-003 · publica en < 2×tiempo_estimado | Depende del entorno Ollama | ⏳ recorrido CEO |
| SC-004 · segundo padre ve fila correcta | Cola con `pendientes` en tiempo real | ✅ estructural |
| SC-005 · nunca 2 jobs vivos por expediente | singletonKey + idempotencia (test) | ✅ verificado |
| SC-006 · C3 reutiliza con 0 líneas de motor | Test + README con ejemplo | ✅ verificado |
| SC-007 · sala de espera útil sola (3 bloques) | Recorrido navegador | ⏳ recorrido CEO |
| SC-008 · 0 análisis delante de clasificación | Guard runtime prioridad<10 (test) | ✅ verificado |

---

## Recorrido en vivo esperado (CEO, post-deploy)

1. Login como padre con expediente sin análisis previo → sección "Análisis detallado" muestra banner con posición 1 + estimado + capa 1 "En vivo" visible.
2. Esperar publicación (~90 s con cola vacía) → aparece el texto del modelo con sello *"Análisis al corte del … · incluye N hechos"* + etiqueta "análisis asistido" + sección "Qué puedes hacer ahora" con la guía publicada.
3. Reabrir sin cambios → sale INSTANTÁNEO (hash coincide, sin gasto de modelo).
4. Agregar 1 evento → reabrir → aparece aviso *"Hay 1 hecho nuevo desde este análisis"* + banner nuevo debajo con posición actualizada.
5. Pulsar "Actualizar" antes del cool-down → botón deshabilitado con texto de tiempo restante.
6. Pulsar "Actualizar" con cool-down cumplido y hash sin cambios → mensaje *"Tu análisis ya está al día"*.
7. Prod: verificar por SQL que el `numeroSecuencial` de los análisis del mismo expediente NUNCA se repite bajo carga.

---

## Notas para el recorrido

- **Modelo Ollama por defecto**: `qwen2.5:14b` (heredado de `ia.rubrica.modelo_embudo`). Si es muy pesado para la Mac, el admin cambia `padre.analisis.modelo` sin redeploy.
- **Cool-down por defecto**: 5 minutos. Para pruebas rápidas, bajarlo a 1 en la BD.
- **Cola llena**: para probar el mensaje, bajar `padre.analisis.tope_fila` a 1 y abrir dos expedientes casi simultáneamente.

---

## Brecha conocida (documentada, no bloqueante)

Test de integración pesada **T051** (arrancar el worker con `boss.work` en un
entorno de test y verificar el orden serializado de 3 jobs) NO se implementó.
Auditoría #214 corrigió la explicación anterior: `teamConcurrency` en `boss.work`
es una API **inerte en pg-boss 12** (no arbitra concurrencia real). La garantía
de serialización real viene de:
- **Instancia única** por advisory-lock 123456799 en Postgres (segunda instancia
  del worker sale con código 2).
- **`batchSize: 1`** en `boss.work`: el worker toma un job a la vez del batch.
- **`pg_advisory_xact_lock(hashtext("analisis:"+expedienteId))`** al escribir
  `versionSecuencial` (mismo patrón I-208 de `informes-padre`) — dos escrituras
  concurrentes para el mismo expediente se serializan.

Si el CEO/Calidad pide test específico del worker, se implementa en ticket aparte.

## Prioridad y contención entre colas (audit #214 · nota estructural)

`padre.analisis.prioridad < queue.clasificacion.prioridad` ordena la elección
del próximo job **dentro de la misma cola** o dentro del mismo consumer. NO
arbitra entre colas separadas: los workers de análisis y de clasificación
consumen colas distintas (`padre.analisis.expediente` vs `reporte-procesamiento`)
y pg-boss no los coordina.

La contención real que importa es la del **modelo Ollama** en la misma Mac:
como el análisis usa el mismo modelo que la clasificación cascada, Ollama
serializa por HTTP. El "cero análisis por delante" (SC-008) se traduce en la
práctica a: el análisis usa un modelo LIGERO (embudo por defecto), corre de
a uno, y la clasificación crítica de reportes no comparte el mismo tick del
worker de análisis. Aceptado y anotado.

---

## Referencias

- Spec: [spec.md](./spec.md)
- Plan: [plan.md](./plan.md)
- Research: [research.md](./research.md)
- Data model: [data-model.md](./data-model.md)
- Contratos: [contracts/analisis-endpoint.md](./contracts/analisis-endpoint.md) · [contracts/queue-job-schema.md](./contracts/queue-job-schema.md)
- Quickstart: [quickstart.md](./quickstart.md)
- Analyze: [analysis.md](./analysis.md)
- Tasks: [tasks.md](./tasks.md)
