# SPEC-325 · tasks.md · protejo/vigilo núcleo

> Diseño aprobado por Fábrica PI-1 (5 decisiones en plan §G). Orden por capas, dependencias explícitas.
> schema-to-schema (NO `migrate dev` sobre DB compartida) · `specs-discipline.test.ts` local antes de REALIZADO · avisar turno de build.

## T1 · Mecanismo compartido: normalización (US3 · el fix, aislado y primero)
- [ ] `src/lib/dal/identificadores/normalizar.ts` — `normalizarIdentificador(valor) = valor.trim().toLowerCase()`.
- [ ] `src/lib/dal/identificadores/normalizar.test.ts` — casos: `"TioJuan1"`→`"tiojuan1"`, espacios, ya-normalizado idempotente, vacío.
- [ ] Aplicar en el embudo de contacto: `contactos-mutaciones.ts` — persistir `normalizarIdentificador(valor)` (hoy `:41` persiste crudo; el `:36` dedup-key se mantiene).
- [ ] Aplicar en la ingesta de reporte: `identificador-reportado.ts:77` `upsertIncrementoReporte` — normalizar `identificador` antes de `where`/`create` (candado 22 v2).
- [ ] Verificar+aplicar en la creación de `Reporte.identificador` (localizar el service en T1.5).
- [ ] **Test de defensa en profundidad:** afirmar que todo valor guardado (contacto/hijo/reporte) está normalizado (caza embudo escapado).
- [ ] **Test del defecto silencioso (candado 24 v2):** guardar `TioJuan1` + reportar `tiojuan1` → el cruce lo detecta.

## T2 · Migración Prisma aditiva + backfill (schema-to-schema)
- [ ] `Hijo` + `HijoPadre` + `IdentificadorHijo` + `IdentificadorHijoDesvinculado` (decisión 1).
- [ ] `ContactoConfianza`: `+ nombre String?`, `+ parentesco String?` (decisión 3, aditivo · `etiqueta` deprecada, no borrar).
- [ ] Backfill en la migración:
  - [ ] `IdentificadorContacto.valor` → `lower(trim(valor))`.
  - [ ] `Reporte.identificador` → `lower(trim(...))` por-fila (no colisiona).
  - [ ] `IdentificadorReportado` → **merge** por valor normalizado (sumar totales, `ultimoReporteEn` máx, dejar una) (decisión 4). Conteo prod previo = lo corre Fábrica.
  - [ ] `ContactoConfianza.nombre` ← `etiqueta` (placeholder si vacía) antes de exponer NOT NULL en Zod.
- [ ] `prisma migrate diff` schema-to-schema · cliente propio · NO migrate dev.

## T3 · DAL Hijo (patrón Estudiante · PII)
- [ ] repo/service `Hijo`: crear (detección dos-padres por `@@unique([documentoTipo,documentoNumero])` → si existe, crear `HijoPadre`, no duplicar), listar por padre (vía `HijoPadre`), editar, identificadores (agregar normalizado; quitar = fila en `IdentificadorHijoDesvinculado` para ese `usuarioId`, no borra).
- [ ] Acceso solo por padre dueño · nunca por id suelto en URL · sin logs con documento.
- [ ] Zod: `documentoTipo`/`sexo` set cerrado.
- [ ] Tests: alta, dos-padres-un-niño (mismo doc → compartido, reportes privados, alerta a los dos), desvincular identificador (no afecta al otro padre), PII acceso-solo-dueño.

## T4 · DAL ContactoConfianza (vigilo · §3.3)
- [ ] `nombre`+`parentesco` en alta/edición · `nota` visible+editable · `tipo` (reusar plataformaId / quitar decorativo).
- [ ] DELETE contacto (hoy cero) — baja lógica.
- [ ] activar/inactivar identificador suelto — exponer lo que `:167-172` ya soporta.
- [ ] Unicidad por padre: validación en service **warn+override** (dice a quién pertenece · decisión 2) · índice no-único.
- [ ] Tests: nombre/parentesco, nota round-trip, DELETE, activar/inactivar identificador, warn+override.

## T5 · API routes
- [ ] `/api/padre/hijos/**` (list/create/update/identificadores).
- [ ] ampliar `/api/circulo-confianza/**`: DELETE, activar identificador, editar nombre/parentesco.
- [ ] Tests de ruta con payload real del componente (candado: payload real).

## T6 · UI padre
- [ ] Sección "A quién protejo" (registrar hijo/familiar, identificadores).
- [ ] Arreglo "A quién vigilo" (nombre/parentesco, editar, DELETE, activar identificador).
- [ ] Copy A-62 (§3.4).

## T7 · Componentes muertos (§3.5)
- [ ] Decidir `SemaforoCirculo`/APIs semaforo(305)/timeline(306): conectar si sirven a las vistas nuevas, borrar si no.

## T8 · Cierre
- [ ] `/speckit-analyze` (candado 21 v3) tras completar tasks, antes de implement final.
- [ ] Gate local: typecheck+lint+tests+`specs-discipline.test.ts`.
- [ ] Fila `specs/README.md` + Status catálogo + Impacto en arquitectura.
- [ ] Evidencia §6 (8 ejercicios) publicada en PR.
- [ ] Señal REALIZADO a Fábrica PI-1.
