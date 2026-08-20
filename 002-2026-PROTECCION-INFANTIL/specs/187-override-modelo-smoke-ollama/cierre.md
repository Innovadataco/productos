# Cierre: SPEC-187 — Override de modelo para smoke Ollama (002-PI-082)

**Feature**: 002-PI-082  
**Branch**: `work/002-pi-082`  
**Fecha de cierre**: 2026-08-20  
**Estado**: IMPLEMENTADO — PR a `feature/001-scaffolding` pendiente de merge

---

## Resumen ejecutivo

Se añadió un parámetro opcional `monitoreo.ollama.smoke.modelo` que permite usar un modelo distinto al vigente del motor (`ia.rubrica.modelos[0]`) en el smoke real de Ollama. Si el parámetro está vacío o no existe, se conserva el comportamiento actual.

Además, se corrigió el bug I-69: los parámetros "viejos" del seed (incluyendo el nuevo override) ahora usan `update: {}`, por lo que re-correr el seed no pisa ajustes custom del CEO. Se añadió un test funcional de idempotencia.

## Artefactos entregados

- `spec.md` — requisitos, escenarios, Bloque F y Bloque G.
- `plan.md` — diseño técnico.
- `tasks.md` — tareas completadas.
- `data-model.md`, `research.md`, `checklists/requirements.md`.
- `cierre.md` — este archivo.

## Cambios principales (commits en `work/002-pi-082`)

1. `4f5bfe31` docs(SPEC-187): spec+plan override de modelo para smoke Ollama (002-PI-082)
2. (este push) feat(SPEC-187): override de modelo + seed no pisador + test idempotencia

## Gate local

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | ✅ |
| `npm run lint -- --no-cache` | ✅ (41 warnings preexistentes + complexity de `probeOllamaSmoke`, 0 errores) |
| `npm run arch:check` | ✅ |
| Tests SPEC-187 | ✅ 24 tests (21 probes + 3 seed idempotencia) |
| `npm run build` | ✅ |

## Tests nuevos / actualizados

- `src/lib/monitoreo/probes.test.ts` — override usa modelo configurado; override vacío/espacios hace fallback; detalle incluye `(modelo ..., <override|motor>)`.
- `src/lib/seed-idempotencia.test.ts` — re-seed no pisa `monitoreo.enabled=false`; respeta `monitoreo.ollama.smoke.modelo`; sigue aplicando defaults de `monitoreoNuevos`.

## Decisiones y candados

- Override en `monitoreo.ollama.smoke.modelo`; fallback a `ia.rubrica.modelos[0]`.
- Detalle del probe: `(modelo <nombre>, <override|motor>)`.
- `monitoreoViejos` usa `update: {}` (DO NOTHING); `monitoreoNuevos` de SPEC-186 conserva `update: { valor, descripcion }`.
- No se tocó `src/lib/ai/**` ni la rúbrica.
- Sin migraciones; cambio 100% aditivo.

## Backfill del daño ya hecho (I-69)

El seed pisador dejó `monitoreo.enabled=true` en producción. Tras el deploy de SPEC-187:

1. Verificar `SELECT valor FROM "ParametroSistema" WHERE clave='monitoreo.enabled'`. Si es `true` y el CEO quiere el vigilante apagado, ejecutar:
   ```sql
   UPDATE "ParametroSistema" SET valor='false', "actualizadoEn"=NOW() WHERE clave='monitoreo.enabled';
   ```
2. Si se desea override de modelo para smoke, setear:
   ```sql
   UPDATE "ParametroSistema" SET valor='llama-guard3:8b', "actualizadoEn"=NOW() WHERE clave='monitoreo.ollama.smoke.modelo';
   ```
   Si se prefiere el modelo vigente del motor, dejar vacío.

Nota estructural: I-67 (no correr `prisma db seed` en cada deploy) queda como deuda aparte.

## Señal a ZEUS

`002-PI-082 · REALIZADO · <hash> · PR`
