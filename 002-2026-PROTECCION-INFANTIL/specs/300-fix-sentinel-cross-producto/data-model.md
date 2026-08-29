# Data Model — SPEC-300 · Fix sentinel CI cross-producto

**Fecha**: 2026-08-29 · **Autor**: Dev PI-1 (`idc-be`)

## Aplicabilidad

**N/A** — este fix no toca base de datos, esquemas Prisma, migraciones ni entidades de dominio. Es cambio de configuración de GitHub Actions (`ci.yml` + `bi.yml`).

## Único "modelo" relevante — el contrato de veredicto del gate

Para trazabilidad conceptual documentamos aquí el shape del veredicto que el ruleset "Gate CI - main" espera de cada sentinel (no es un modelo de datos, sino un contrato de check).

### Check output esperado por el ruleset

| Atributo | Valor esperado | Fuente |
|---|---|---|
| `check_run.name` | `pi-gate` o `bi-gate` (literal, case-sensitive) | Job `name` en YAML — GitHub deriva `check_run.name` del job name |
| `check_run.conclusion` | `success` o `failure` | Determinado por `exit 0` vs `exit 1` del step "Evaluar veredicto agregado" |
| `check_run.status` | `completed` | GitHub lo pone automáticamente cuando el job termina |
| Aparición en el PR | Siempre presente, sea `success` o `failure` | Requiere que el workflow arranque siempre → FR-001 + FR-002 |

### Estados del sentinel según context

| Contexto | `should-skip.skip` | jobs pesados | `contains(needs.*.result, 'failure')` | Veredicto del gate |
|---|---|---|---|---|
| PR toca ambos productos, sin fallos | false | success | false | success |
| PR toca solo el producto propio, sin fallos | false | success | false | success |
| PR toca solo el producto contrario (o README) | true | skipped | false | success trivial |
| PR toca el producto propio, un job pesado falla | false | failure | true | failure |
| Workflow cancelado por push más nuevo | irrelevante | cancelled | contains cancelled = true | failure (por `contains(needs.*.result, 'cancelled')`) |

Todas las transiciones son idempotentes: rerun del workflow produce el mismo veredicto para el mismo sha.

## No hay entidades de negocio nuevas

- Sin modelos Prisma nuevos.
- Sin tablas nuevas.
- Sin migraciones.
- Sin cambios en `schema.prisma`.

`arch:check` no se activa (no hay cambios en schema/DAL/proxy/nav). `docs/architecture/**` no necesita regeneración.
