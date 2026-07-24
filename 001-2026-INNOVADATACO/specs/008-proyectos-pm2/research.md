# Research: Proyectos PM2

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Fecha**: 2026-07-24

Decisiones que el plan da por tomadas, con lo descartado y por qué. Redactado **a posteriori**
(D-066), como el de SPEC-007 y por el mismo motivo.

---

## D1 · Las fases PM2 viven en código, no en una tabla

Los estados de oportunidad son un **catálogo configurable en BD** (§0.7). Las fases PM2 —Inicio
· Planeación · Ejecución · Cierre— **no**: son metodología de IDC, no configuración del cliente.
Viven en `src/lib/fasesPm2.ts`.

| Alternativa | Por qué se descartó |
|---|---|
| Catálogo en BD, como los estados | Sugiere que se pueden añadir fases desde la UI. No se puede: cambiar las fases es cambiar la metodología, y eso no lo hace un administrador un martes. Además exigiría migración y seed para un dato que no varía. |
| Enum de Prisma | Cambiar un enum en Postgres es una migración incómoda, y no aporta nada: la validación ya está en la ruta. |
| **Constante en código con validación** | La ruta rechaza con **400** una fase inventada; la UI lee la misma lista. Una sola fuente. |

**Consecuencia**: `POST /api/projects` aceptaba cualquier cadena como `currentPhase`. Ahora
`PATCH` valida; el `POST` heredado queda anotado en la auditoría de deuda.

## D2 · Las claves conservan el dato vivo

`currentPhase` ya tenía `initiation` por defecto y el formulario escribía `planning` y
`execution`. Las claves de `FASES_PM2` son **esas mismas**: ningún proyecto existente necesita
migración ni backfill.

El hallazgo por el camino: la UI ofrecía **tres** fases. `closing` era inalcanzable desde el
formulario — un proyecto no podía llegar a Cierre. No era una decisión, era un olvido.

## D3 · `nombreDeFase` degrada, no falla

Ante una clave desconocida devuelve **la clave**, no vacío. Un proyecto con una fase heredada
rara sigue siendo visible y legible. Mismo criterio que las tarjetas huérfanas de SPEC-007: un
dato inconsistente **no puede** hacer desaparecer una fila de la vista.

## D4 · US1 y US2 sin migración: el orden no es casual

El mínimo de la noche (editar + fases) **no toca el esquema**. Se eligió deliberadamente ese
corte para que el trabajo de un turno desatendido no arrancara con una migración sobre la BD
del CEO. La primera migración aparece en US3 (entregables), ya con el resto verde detrás.

## D5 · RZ-2 se acredita por sustracción

El tablero de fases **no aporta ni una línea de tablero**: reutiliza `KanbanBoard` y solo añade
su adaptador. La comprobación es negativa y por eso es fuerte:

```bash
git log --oneline -- src/components/kanban/KanbanBoard.tsx   # sin commits de la 008
```

Si el componente hubiera necesitado un solo `if` para las fases, SPEC-007 habría fallado en su
condición de diseño.

## D6 · Entregables colgados de la ruta del proyecto (US3)

`/api/projects/[id]/entregables` y no `/api/entregables?proyectoId=`. Un entregable **no existe**
sin su proyecto, y la ruta lo dice.

**Consecuencia de seguridad, que hubo que escribir a mano**: la ruta padre no es decorativa. El
manejador comprueba que el entregable **pertenece** al proyecto de la URL; sin esa comprobación,
`/api/projects/<otro>/entregables/<id>` habría permitido editar el entregable de un proyecto
ajeno entrando por la puerta de otro.

## D7 · El `PATCH` valida el resultado, no la entrada

Un `PATCH` parcial se fusiona con lo existente y **se valida el resultado**. Validar solo lo que
llega dejaría pasar un `{"nombre": ""}` sobre un entregable válido y lo dejaría inválido en BD.

## D8 · Migración de entregables: aditiva, y aun así ensayada

`CREATE TABLE` y nada más: no altera `proyectos`, no relaja restricciones, no toca datos. Es la
clase de menor riesgo posible.

**Se ensayó igual** en BD desechable (D-039), con conteo antes/después y prueba del CASCADE
borrando un proyecto con dos entregables. El criterio no depende de lo fácil que parezca la
migración; si dependiera, no sería un criterio.

---

## Lo que sigue abierto

- **US4 (cronograma), US5 (presupuesto y recursos), US6 (lecciones)**: ver el estado en
  [tasks.md](./tasks.md).
- **`POST /api/projects` sin validar la fase**: hereda el hueco que D1 cerró en `PATCH`.
- **`GET /api/projects` sin paginar**: §3.3 no lo listaba porque el módulo era mínimo; con
  gestión PM2 la lista crece. Reportado en la auditoría de deuda de SPEC-009.
