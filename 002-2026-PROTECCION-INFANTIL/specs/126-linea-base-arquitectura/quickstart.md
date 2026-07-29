# Quickstart: SPEC-126 — validación end-to-end de la línea base

Los 5 criterios de aceptación del instructivo 002-PI-042, ejecutables. Prerequisito:
`export PATH="$HOME/.local/bin:$PATH"` (Node >= 22) y deps instaladas (`npm install` ya hecho).

## AC-1 · arch:check regenera los 5 y quedan idénticos (VERDE)

```bash
npm run arch:check
```
**Esperado**: exit 0. Los 5 artefactos en `docs/architecture/` se regeneran en memoria/tmp y
son idénticos a lo commiteado; huérfanos solo los de `scripts/arch/excepciones.json`;
aserciones A y B en verde o con listas vacías.

## AC-2 · Alterar un modelo pone arch:check ROJO (detecta drift)

```bash
# Añadir un modelo ficticio al final de prisma/schema.prisma (NO commitear):
printf '\nmodel DriftPrueba {\n  id String @id @default(cuid())\n}\n' >> prisma/schema.prisma
npm run arch:check   # DEBE fallar: artefacto 01 distinto + huérfano DriftPrueba no declarado
# Revertir:
git checkout -- prisma/schema.prisma
npm run arch:check   # VERDE de nuevo
```
**Esperado**: ROJO con el modelo modificado (diff del artefacto) y con el huérfano no
declarado listado por nombre; VERDE tras revertir.

## AC-3 · Aserción A corre sobre el inventario real y pasa, o lista desalineos

```bash
npx tsx scripts/arch/asercion-puerta-predicado.ts
```
**Esperado**: informe (rol × ruta) con veredicto de `proxy()` y de `esDestinoPermitidoPorRol`;
exit 0 si todos coinciden. Si hay desalineos: lista `rol · ruta · proxyCore=X · predicado=Y`
y exit != 0. **Si sale ROJA sobre el código actual: NO tocar las fuentes — reportar a ZEUS y parar.**

## AC-4 · Aserción B corre sobre header/menú y pasa, o lista href muertos

```bash
npx tsx scripts/arch/asercion-menu-no-miente.ts
```
**Esperado**: por rol, cada href pintado por `NavHeader`/`nav-items` evaluado contra el proxy;
exit 0 si todos son alcanzables. Si hay muertos: lista `rol · href · veredicto del proxy` y
exit != 0. Misma regla: ROJA = fallo real escondido, se reporta, no se silencia.

## AC-5 · Disciplina de impacto y regla de lectura

```bash
grep -n "Impacto en arquitectura" specs/126-linea-base-arquitectura/spec.md   # existe
grep -n "docs/architecture" AGENTS.md                                        # regla presente
npx vitest run src/lib/specs-discipline.test.ts                              # verde
```
**Esperado**: la spec 126 contiene la línea de impacto; `AGENTS.md` incluye "antes de tocar
`src/`, leer `docs/architecture/`"; el test de disciplina exige la línea en specs nuevas.

## Verificación en CI

Tras push, `gh run list --branch feature/001-scaffolding --limit 1`: el job del producto
incluye el paso `arch:check` y termina `success`.

## Qué NO valida este quickstart

- La fidelidad visual de los diagramas Mermaid (se revisa renderizando `01-modelo-datos.md`
  y `03-pantallas.md` una vez a mano tras la primera generación).
- La reconciliación de los ejes de permisos (módulos vs rutas): fuera de alcance, decisión de ZEUS.
