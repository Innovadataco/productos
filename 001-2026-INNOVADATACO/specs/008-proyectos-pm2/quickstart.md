# Quickstart: Proyectos PM2 — cómo verificarlo

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-24

> **Regla de Oro 4.** Todo lo de §2 se verifica contra la app **desplegada**
> (`http://localhost:5001`), no contra el árbol. Comprobar antes que la imagen es posterior a
> los commits:
> ```bash
> docker images --format '{{.Repository}}  {{.CreatedAt}}' | grep innovadataco-app
> ```

---

## §0 · Gates automáticos

```bash
npx vitest run · npx tsc --noEmit · npm run build · npx eslint src/lib src/app/api
```

## §1 · US1 · Editar un proyecto (el gap base)

Hasta esta spec **no se podía editar** un proyecto. Es lo primero que hay que ver funcionando.

| # | Qué hacer | Qué debe pasar | Requisito |
|---|---|---|---|
| 1 | Proyectos › Listado, pulsar **la flecha** de una tarjeta | Abre la edición | **I-011** |
| 2 | Pulsar en **cualquier parte** de la tarjeta | Abre la edición | **I-011** |
| 3 | Escribir en el buscador | Filtra por código, nombre y cliente | **I-011** |
| 4 | Buscar el botón de filtro que no hacía nada | **Ya no está** | **I-011** |
| 5 | Cambiar nombre y cliente, guardar, recargar | Los cambios persisten | SC-001 |
| 6 | Poner el `codigo` de otro proyecto | **409** con mensaje legible | SC-002 |
| 7 | Desplegar el selector de fase | **Las 4** fases, con **Cierre** | D2 del research |

> El criterio de I-011 en una frase: **ningún elemento debe señalar interactividad que no
> tiene**. Al revisar el módulo aparecieron 4 casos, no 1.

## §2 · US2 · Tablero de fases

| # | Qué hacer | Qué debe pasar | Requisito |
|---|---|---|---|
| 1 | Proyectos › **Fases PM²** | 4 columnas: Inicio · Planeación · Ejecución · Cierre | SC-003 |
| 2 | Contarlas | Las 4 **enteras, sin barra horizontal** | SC-012 de la 007 (**I-014**) |
| 3 | Arrastrar un proyecto a otra fase, recargar | Sigue en la fase nueva | SC-004 |
| 4 | Configuración › Auditoría | `proyecto.fase.cambio` con origen y destino | SC-004 |
| 5 | Soltar en **la misma** fase | Ni llamada ni registro | FR-007 |
| 6 | Parar el contenedor `db` y mover | La tarjeta **vuelve** y avisa con texto legible | FR-007 |

**RZ-2 / SC-005** — que el tablero sea *el mismo* de SPEC-007:

```bash
git log --oneline -- src/components/kanban/KanbanBoard.tsx   # sin commits de la 008
```

## §3 · US3 · Entregables

| # | Qué hacer | Qué debe pasar | Requisito |
|---|---|---|---|
| 1 | Abrir la edición de un proyecto | Panel **Entregables** al pie | FR-009 |
| 2 | Añadir uno con nombre, responsable, fecha y estado | Aparece listado | SC-006 |
| 3 | Cambiar el avance (0-100) | Se guarda; recargar lo confirma | US3-2 |
| 4 | Dejar el nombre vacío | El botón **Añadir** está deshabilitado | FR-010 |
| 5 | Enviar sin nombre por API | **400** con mensaje legible | FR-010 |
| 6 | Poner avance 500 por API | **400** | FR-010 |

**CASCADE (SC-011)** — sin huérfanos al borrar el proyecto:

```sql
-- contra la BD del proyecto (puerto 5435)
SELECT count(*) FROM entregables
WHERE NOT EXISTS (SELECT 1 FROM proyectos p WHERE p.id = entregables."proyectoId");
-- esperado: 0
```

**Aislamiento entre proyectos** (D6 del research) — que la ruta padre no sea decorativa:

```bash
# el entregable <E> es del proyecto <A>; se pide por la ruta del proyecto <B>
curl -X PATCH http://localhost:5001/api/projects/<B>/entregables/<E> \
  -H "Content-Type: application/json" -d '{"avance":99}'
# esperado: 404, no 200
```

## §4 · Sesión

Sin sesión, **toda** ruta de esta spec responde **401**:

```bash
curl -o /dev/null -w "%{http_code}\n" -X PATCH http://localhost:5001/api/projects/x
curl -o /dev/null -w "%{http_code}\n" http://localhost:5001/api/projects/x/entregables
```

La suite lo verifica sola: `src/app/api/superficie.test.ts` recorre el árbol de rutas e invoca
cada manejador sin sesión. Una ruta nueva sin `verifyAuth` pone la suite en rojo.

## §5 · Lo que esta spec **no** hace todavía

US4 (cronograma), US5 (presupuesto y recursos) y US6 (lecciones aprendidas): ver
[tasks.md](./tasks.md) para su estado exacto.
