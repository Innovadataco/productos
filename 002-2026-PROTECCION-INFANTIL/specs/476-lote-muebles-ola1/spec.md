# SPEC-476 · Lote consolidado de la OLA 1 del rediseño — 12 muebles en un merge

**Status**: IMPLEMENTADO (cada mueble pendiente de certificación de Diseño)
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: orden del CEO de consolidar la Ola 1 para no serializar 12 merges por el `merge=union` de los generados. Autoridad de forma: **Diseño** (certifica cada mueble; post-merge).

## Para qué

La Ola 1 migró 12 muebles al Sistema de Diseño, cada uno en su propio PR. Los 12 tocan dos archivos **generados** (`vitest.unit.includes.ts`, `specs/README.md`) que GitHub no fusiona con `union` → cada merge dejaba a los otros 11 en CONFLICTING. Mergearlos sueltos = **12 vueltas de CI seriadas**. Este lote los entrega en **una sola rama y un solo merge**: los generados se regeneran **una vez**, sin duplicados.

## Qué entra (12 muebles + su candado + su spec)

**Cadena-piso (bajan crudos):**
- SPEC-457 Badge · SPEC-458 Alerta · SPEC-461 Cargando · SPEC-467 Input · SPEC-469 Tabla · SPEC-470 Select

**Floor-safe:**
- SPEC-464 Admin (8 pantallas: rojo→rubi) · SPEC-471 EmptyState · SPEC-472 ErrorState · SPEC-473 GlassCard (radio por token) · SPEC-474 Modal (radio por token) · SPEC-475 BotonActivarEmergencia (I-320)

Cada mueble conserva su carpeta `specs/<n>/` y su candado como archivo aparte. Este lote NO reescribe su conducta; solo los junta sobre `origin/main` fresco (`3cedab90b`, post-accent SPEC-460).

## El piso NO se toca (regla SPEC-466)

Ninguno de los 12 edita `scripts/tokens-check.ts`. Con el guard `<=`, bajar crudos hace caer el conteo **por debajo** del piso (1021) y pasa; el apriete lo hace el barrido `--tension`, no el PR. Conteo del lote: **~967 ≤ 1021, VERDE**. Así los 12 no serializan en la línea del PISO (que era la otra fuente de conflicto).

## Candado de SPEC-466 fortalecido (incluido en este lote)

`scripts/tokens-ratchet-sin-serializar.candado.test.ts`, test «el guard real», tenía una fragilidad: exigía **holgura CERO** (asumía conteo == piso, cierto en main por casualidad tras el último `--tension`). El PRIMER PR que baja crudos sin apretar el piso —lo que la propia regla de SPEC-466 ordena— abre holgura y un solo crudo nuevo ya no cruza el piso, dejando el guard verde y el test en rojo. **Contradice el diseño de SPEC-466.**

Arreglo (**fortalece, no debilita**): el test ahora **mide el estado** (conteo y piso de la salida del guard) y siembra los crudos que falten para **superar el piso**, sea cual sea la holgura. Prueba el contrato real (`total > PISO` ⇒ rojo) y sigue muriendo si el guard se rompe. Verificado por mutación (romper el `>` deja el test en rojo).

## Impacto en arquitectura: no

Solo piel (color/radio por token) de 12 muebles + un test de guard más robusto. Sin schema, sin API, sin runtime. Las pantallas que usan estos muebles no requieren cambios.

## Certificación (la da Diseño, por mueble, post-merge)

El merge es por verde en CI + auditoría del CEO. Diseño certifica **cada mueble** contra el código o tras desplegar; hasta su ✅ el mueble no se marca cerrado en el inventario. **Verde en CI no cierra un rediseño.**

## Cómo se probó

- Reconstruido sobre `origin/main 3cedab90b`: la fuente de los 12 estaba **quieta** en main (checkout directo); solo `globals.css` de Alerta se trajo por patch (main se había movido).
- Preflight: lint 0 · `tsc --noEmit` 0 · `arch:check` VERDE · `tokens:check` ~967 ≤ 1021 · `generar-readme --check` al día · suite unit completa (12 candados + conducta).
- Cierra los 12 PRs sueltos: #373 #374 #377 #378 #381 #384 #385 #386 #387 #388 #389 #390.

## Referencias

- **PLAN-MAESTRO-REDISENO.md** §4 (contrato de cada mueble) · Sistema de Diseño §3/§5/§7.1.
- **SPEC-454** (Button, OLA 1) fijó la reserva de rubí sólido y el patrón de piel.
- **SPEC-466** (ratchet `<=` + `--tension`) — el diseño que este lote honra y cuyo candado fortalece.
