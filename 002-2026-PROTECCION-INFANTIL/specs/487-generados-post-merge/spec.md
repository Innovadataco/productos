# SPEC-487 · Los generados dejan de tocarse en el PR: barrido post-merge (kill de la clase union)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: D-109 (decisión) + approach en fuente aprobado por el CEO. Elimina (no mitiga) la clase de conflicto union que serializó toda la Ola 2. Patrón bot-PR flujo (B) ya validado en vivo (D-110, #406).

## El problema

3 generados append-por-spec —`specs/README.md`, `docs/architecture/02-roles-capacidades.md`, `03-pantallas.md`— reciben una fila por cada spec/ruta nueva. El gate exigía `committed==regeneración` → **cada PR los editaba** → CONFLICTING en cadena: `merge=union` baja el dolor del rebase local pero **GitHub no aplica el driver server-side**, así que cada PR que los tocaba quedaba en conflicto contra el siguiente (medido en toda la Ola 2: #399, #402, #404 rebasaron por esto).

## El arreglo (approach D-109)

1. **Cambio de invariante en el PR: de `committed==regen` a REPRESENTABILIDAD.** El PR ya NO toca los 3 generados; solo se verifica que la FUENTE produzca el índice sin romper. Acoplado en el mismo PR:
   - `generar-readme.ts --check-representable` (nuevo modo; el gate de CI lo usa en vez de `--check`): toda carpeta `specs/NNN` tiene spec.md + el generador corre limpio. NO compara con lo commiteado.
   - `arch:check (a)`: las tablas `toleraOrdenDeFilas` (02-roles, 03-pantallas) pasan a representabilidad (el generador corre limpio); los 3 byte-exactos (00/01/06) **siguen** byte a byte.
   - `specs-discipline.test.ts`: la aserción «el índice cubre las carpetas» → representabilidad (ninguna carpeta a medio crear sin spec.md).
2. **Barrido post-merge (`.github/workflows/generados-post-merge.yml`, flujo B):** corre sobre `main` fresco tras cada merge (`push` a main + path-filter + `workflow_dispatch`, `concurrency cancel-in-progress:true`), regenera los 3; si driftearon, **el bot pushea la rama `work/pi-SPEC-487-generados` y el OPERADOR abre el PR** (nada de `gh pr create`; D-110). Idempotente y **auto-terminante** (regen==committed → no abre otro).
3. `merge=union` queda **inerte** (los PR ya no tocan esos archivos) — retirarlo es follow-up opcional. `vitest.unit.includes.ts` **se queda en union** (D-109: no glob, riesgo de misclasificación silenciosa).

## Candado — `scripts/specs/generados-post-merge.candado.test.ts` (estilo 432, 5 tests)

- **A · merge real:** dos ramas que agregan una spec cada una **sin tocar el índice** → merge limpio, ambas specs sobreviven. **Contraprueba:** el modelo viejo (cada rama edita el índice) SÍ choca sin union.
- **B · representabilidad:** la fuente real es representable; una carpeta a medio crear (sin spec.md) NO lo es → la caza el gate sin comparar con lo commiteado.
- **C · determinismo:** el generador es idempotente → el barrido auto-termina.

## Impacto en arquitectura:

- Saca los 3 generados append-por-spec de la cadena de conflictos: dos PR que agregan rutas/specs ya **no chocan** en esos archivos (no los tocan). El índice/tablas los mantiene un barrido post-merge serializado (flujo B).
- Ventana de lag aceptable: el índice committeado trasciende la fuente por unas filas entre merge y merge-del-barrido; el gate del PR ya no exige igualdad → nadie se pone rojo y la fuente siempre es correcta (documentación, consistencia eventual).

## Lo que NO cambia

- Los 3 artefactos byte-exactos (00-INDICE, 01-modelo-datos, 06-stack) → siguen `committed==regen`.
- `vitest.unit.includes.ts` → queda en union (no glob).
- `merge=union` en `.gitattributes` → queda inerte (follow-up opcional retirarlo).

## Referencias

- **SPEC-413/432/432b** (generador + union) — esta spec elimina la clase que 432 mitigó.
- **SPEC-466/485** (flujo B del bot-PR, D-110) — mismo patrón, validado en #406.
- Rama `work/pi-SPEC-487-generados-post-merge` desde `origin/main 2decbac7c`.
