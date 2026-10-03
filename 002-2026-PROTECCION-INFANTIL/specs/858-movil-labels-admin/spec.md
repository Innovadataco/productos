# SPEC-858 · Etiquetas de la barra móvil del admin (follow-up de 857)

**Status**: IMPLEMENTADO

- **Rama:** `work/pi-SPEC-858-movil-labels-admin` (PR nuevo; 857 ya está en `main`).
- **Impacto en arquitectura:** Mínimo. Agrega `labelCorto` (presentación de la barra móvil) a 2 hojas de `ADMIN_NAV_ITEMS`. NO cambia hrefs, módulos ni la estructura del menú; el render de escritorio no cambia (usa `label`). `arch:check` sin cambios (02/03 no se tocan).

## Problema (lo caminó Calidad en móvil)

Tras SPEC-857, la barra inferior del ADMIN leía **«Inicio · Bandeja · Bandeja · Operación · Más»**. `PRINCIPALES_MOVIL.ADMIN` apunta a hrefs que ahora son HIJOS de grupo; al promoverlos, `aplanar` hereda el ÍCONO del grupo (correcto) pero conserva el LABEL del hijo:

- pos.3 `/dashboard/admin/comite` (hijo «Bandeja» del grupo «Comité de Convivencia») mostraba «Bandeja» → colisión con pos.2 (Reportes→«Bandeja»).
- pos.4 `/dashboard/admin/estadisticas/operacion` (hijo «Operación») mostraba «Operación» → debía ser «Cifras» (el rótulo corto histórico de Estadísticas en la barra móvil).

## Fix

`labelCorto` (solo afecta la barra móvil; el escritorio sigue mostrando `label` dentro del grupo):

- `/dashboard/admin/comite` → `labelCorto: "Comité"`.
- `/dashboard/admin/estadisticas/operacion` → `labelCorto: "Cifras"`.

Resultado: **«Inicio · Bandeja · Comité · Cifras · Más»** (intención de Diseño).

## Functional Requirements

- **FR-001:** La barra inferior del ADMIN NO DEBE mostrar dos principales con la misma etiqueta.
- **FR-002:** El render de ESCRITORIO de esos dos ítems NO DEBE cambiar (sigue «Bandeja» bajo «Comité de Convivencia» y «Operación» bajo «Estadísticas»).

## Success Criteria

- Candado en `para-rol.test.ts`: los principales móviles de cada rol tienen etiqueta mostrada (`labelCorto ?? label`) distinta; control positivo ADMIN = «Inicio · Bandeja · Comité · Cifras»; muere por mutación si se quita el `labelCorto`.
- Candados de render (nav-lateral/nav-movil/role-visibility) verdes (escritorio intacto).
- Gate completo + `arch:check` verde.

## Assumptions

- Diseño puede ajustar «Cifras»↔«Estadísticas» (es forma); re-certifica el móvil.

## Reorden de sección (Diseño, decisión CEO)

En la sección «Citas y profesionales», el MÓDULO «Verificación» pasa a ÚLTIMO, pegado a «Verificadores». Orden final: **Sesiones · Operadores · Reubicaciones · Profesionales · Verificadores · Verificación** (antes Verificación iba tras Reubicaciones). Solo reordena nodos de `ADMIN_NAV_ITEMS`; no toca gates ni labels.

## Implementación

- `src/lib/nav-items.ts`: `labelCorto` en los 2 hijos + reorden del módulo «Verificación» al final de su sección.
- `src/lib/nav/para-rol.test.ts`: candado de etiquetas distinguibles + actualización de la aserción de labelCorto del principal de Estadísticas (antes undefined, ahora «Cifras»).
