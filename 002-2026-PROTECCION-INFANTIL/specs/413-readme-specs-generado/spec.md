# SPEC-413 · Índice de specs generado, no escrito a mano

**Status**: DESARROLLO
**Fecha**: 2026-09-03 · **Dev**: Infra (idc-c0) · **Origen**: veredicto CEO 22:5x (traspaso desde Dev 01, sin rama previa)

## Para qué

`specs/README.md` era el archivo del repo con **más conflictos de rebase**. Cada spec nueva añadía a mano una fila a la misma tabla y tres PRs abiertos a la vez chocaban ahí sin excepción. Hoy 03-09-2026 lo hicieron: #324, #327/#329 y #308 tuvieron conflicto en `specs/README.md`, ninguno por código real. El costo escaló porque cada re-rebase gastaba minutos, y hubo que renombrar ramas (regla `^work/pi-SPEC-[0-9]+-<slug>`) que trajeron su propia ronda de re-abrir PR.

Este PR elimina la edición manual: la tabla se **genera** desde cada `spec.md`. Dos PRs pueden tocar la misma pieza sin chocar, porque nadie escribe la tabla — sale del script.

## Qué trae

### 1) `scripts/specs/generar-readme.ts` (nuevo)

Mismo patrón que `scripts/arch/generar-roles-capacidades.ts`. Lee `specs/NNN-*/spec.md` de cada carpeta, extrae:

- **Número** del prefijo (`006`, `407`, `413`, …).
- **Título** del primer `#` del `spec.md`.
- **Status crudo** con el mismo regex que `specs-discipline.test.ts` (`(?:Status|Estado):`).
- **Status canónico** por catálogo `STATUS_CANONICOS` (`PLANEADO / DESARROLLO / IMPLEMENTADO / PENDIENTE DE PRUEBA / FINALIZADO / CERRADA`) + mapa de sinónimos comunes (`Finalizada` → `FINALIZADO`, `Implementada` → `IMPLEMENTADO`, etc.). Un status fuera de catálogo se lista con `⚠️` sin romper el generador (para no bloquear especs históricas).

Emite dos bloques entre marcadores HTML `<!-- SPEC-413:BEGIN resumen -->` … `END` y `<!-- SPEC-413:BEGIN tabla -->` … `END`:

- **Resumen**: total + conteo por status canónico + conteo de "fuera de catálogo" y "sin Status" — así el humano ve inmediatamente qué specs le deben limpieza.
- **Tabla**: `| Nº | Nombre | Estado |` ordenada por número ascendente, con emoji por status.

**Modos**:

- Sin flag: reescribe `specs/README.md`.
- `--check`: exit 1 si el archivo commiteado difiere del generado; imprime el comando exacto para arreglarlo.

### 2) `specs/README.md` — plantilla con marcadores

El prólogo, la sección "Incidencias de calidad de datos" y "Convención de archivos por spec" quedan **intactos**. Solo las secciones "Resumen" y "Backlog activo (no cerradas)" viven entre marcadores. El generador **no toca nada fuera de los marcadores** — es una plantilla, no un archivo pisado.

### 3) `.github/workflows/ci.yml` — check en `verificaciones`

Nuevo step al final del job `verificaciones`:

```yaml
- run: npx tsx scripts/specs/generar-readme.ts --check
```

Si un PR modifica un `spec.md` (título, Status, alta/baja de carpeta) sin regenerar, el CI falla en `verificaciones` con el mensaje que dice el comando exacto a correr. Es un job existente, no uno nuevo — el CEO pidió que fuera dentro de `verificaciones`, no una máquina más.

## Candados

- **Plantilla + marcadores**, no pisado completo. Cualquier texto fuera de los marcadores (prólogo, incidencias, convención) sobrevive intacto entre regeneraciones.
- **Modo `--check` con mensaje accionable**: quien vea el rojo en CI ve al lado el comando exacto para arreglar.
- **Sin fallo por Status no canónico**: se lista con `⚠️` y sigue. El objetivo es cortar la fricción de merge, no bloquear a alguien por una spec vieja mal declarada. La disciplina la sigue empujando `specs-discipline.test.ts` (test unit aparte).
- **Determinístico**: orden numérico ascendente, empate por carpeta alfabético. Dos regeneraciones seguidas del mismo commit producen el mismo output byte-a-byte.
- **Zero deps nuevas**: solo `node:fs` y `node:path`.

## Impacto en arquitectura: no

Un script nuevo bajo `scripts/`, un archivo autogenerado, un step de CI dentro de un job existente. Sin schema, sin API, sin runtime.

## Cómo se probó

- Ejecutado local: `npx tsx scripts/specs/generar-readme.ts` reescribió el README de 540 → 385 líneas con 342 specs en la tabla y contadores en el resumen.
- Ejecutado local: `--check` verde tras la primera generación; forzado un drift dentro de la tabla → falla con mensaje `[SPEC-413] specs/README.md está desactualizado`; restaurado → verde otra vez.
- `specs-discipline.test.ts` sigue verde (el test "el índice cubre todas las carpetas reales" se satisface automáticamente ahora que el generador es el único que escribe).

## DoD

- [x] `scripts/specs/generar-readme.ts` con modos default/`--check`.
- [x] `specs/README.md` regenerado con marcadores + narrativa preservada.
- [x] Step nuevo en `verificaciones` que corre `--check`.
- [x] `specs-discipline.test.ts` sigue verde local.
- [ ] CI del PR verde.

## Nota para las próximas specs

**No editar `specs/README.md` a mano** — el CI lo va a rechazar. Al crear una carpeta `specs/NNN-<slug>/spec.md` nueva con su `Status: <canónico>`, correr una vez:

```bash
npx tsx scripts/specs/generar-readme.ts
```

Y commitear el `specs/README.md` junto con la spec. Es un comando por spec, ejecutado por quien la escribe — no más edición manual de la tabla compartida.
