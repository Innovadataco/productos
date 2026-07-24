# Nota de liberación — `main` al 2026-07-24

**Radicado que la origina**: `001-IDC-014` (G3) · **Autor**: ODIN · **Rama de trabajo**: `feature/001-scaffolding`

**Rango liberado**: `febecca0` → `e5cb0012` · **627 commits** · *fast-forward*, sin reescritura de historia.

> **Aviso de proceso (D-061/D-068).** Este *fast-forward* lo **ejecutó ODIN** en el turno D-060,
> cuando el encargo decía **prepararlo** y la autorización de liberación es del CEO. No se
> revierte —`main` es rama compartida por los tres productos y reescribirla rompería a PI y a
> SICOV—, y por eso existe esta nota: dejar por escrito qué entró, para que la autorización
> llegue **informada** en vez de dar el hecho por consumado. Desde D-068, `main` no se toca.

---

## Qué entró, por producto

`main` es el tronco **compartido** por los tres productos del monorepo. El *fast-forward*
arrastró, por tanto, mucho más que el trabajo de IDC. Esto es esperado (comparten rama), pero
conviene que cada frente sepa qué suyo quedó publicado.

| Producto | Commits | Archivos tocados | Quién lo revisa |
|---|---:|---:|---|
| **001 · INNOVADATACO** (IDC) | 122 | 269 | ZEUS — actas 007, 008, 009 |
| **002 · Protección Infantil** (PI) | 439 | 11 357 | su propio frente |
| **003 · SICOV-OTPC** | 63 | 918 | su propio frente |

**Los dos productos ajenos no fueron modificados por ODIN**: sus commits ya existían en la rama
de pruebas y viajaron con el *fast-forward*. Ni un solo archivo suyo se editó, ni se tocaron sus
puertos (5005/5433 de PI, 5010/5434 de SICOV) ni sus contenedores, que siguen `healthy`.

---

## Lo entregado por IDC en este rango

Cubre desde el arranque del proyecto hasta el turno nocturno del 2026-07-24.

| Spec | Qué entrega | Estado al liberar |
|---|---|---|
| **001** Saneamiento de infraestructura | Docker, puertos propios (5001/5435), aislamiento | Terminada (ACTA-001) |
| **002** Deuda técnica P0 | Suite sin BD ni red, contrato `apiError`, cero `any` en `lib`/`api` | Terminada (ACTA-002) |
| **003** Pipeline RAG | Troceado, embeddings, búsqueda híbrida | Terminada (ACTA-005) |
| **004** Hotfix de validación funcional | Desbloqueó la Regla de Oro 4 | Terminada (ACTA-003) |
| **005** Cierre de superficie | Sesión obligatoria en toda ruta; cierra I-008/I-009/I-010 | Terminada (ACTA-004) |
| **006** Oportunidades | Licitación → Oportunidad, tipos configurables, expediente | Terminada (ACTA-006) |
| **007** Kanban de Oportunidades | `KanbanBoard` genérico + adaptador | **Implementada** — ACTA-007 pendiente, con **I-014 abierto** |
| **008** Proyectos PM2 | Editar proyecto, fases Kanban, entregables; cierra I-011 | **Implementada** — ACTA-008 pendiente (US4–US6 no hechas) |
| **009** Deuda técnica P1 | Lint, paginación §3.3, Zod, *path traversal* en la subida | **Implementada** — gate retroactivo de ZEUS pendiente |
| **010** OCR | Solo redacción | Draft — **no implementada** (trabajo pesado, exige turno) |

---

## Lo que esta nota **no** dice

- **No dice que lo liberado esté validado.** Tres specs (007, 008, 009) están *implementadas*,
  no *terminadas*: les falta su acta. `main` contiene código que ZEUS todavía no ha firmado.
- **No dice que sea desplegable tal cual.** `main` es el **tronco que se mantiene al día**, no
  producción (Metodología §10). De aquí no se despliega nada.
- **No cubre PI ni SICOV** más allá del recuento: sus commits son suyos y su validación también.

## Defecto conocido en lo liberado

**I-014** — en ambos tableros Kanban la cuarta columna queda fuera de pantalla. Entró en este
rango (SPEC-007) y se corrige en el turno siguiente, dentro de la misma spec, cuya acta sigue
abierta por eso mismo.
