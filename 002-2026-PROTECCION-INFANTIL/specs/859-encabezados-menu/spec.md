# SPEC-859 · Esquema completo de encabezados del menú admin

**Status**: IMPLEMENTADO

- **Rama:** `work/pi-SPEC-859-encabezados-menu` (PR nuevo desde `main`; 857+858 ya integrados = `6e187e8de`).
- **Fuente de FORMA:** Diseño `FORMA-SPEC859-ESQUEMA-ENCABEZADOS-MENU-ADMIN` — commit **f616d03 (v1.1)** en `Gestion-de-proyectos` (Soporte en «Moderación»; sucede a 8739b09/v1.0, que lo dejaba en «Sistema» y lo marcaba 🚩 — el CEO resolvió el flag subiéndolo).
- **Impacto en arquitectura:** Mínimo. Agrega **3 encabezados** `encabezado:true` a `ADMIN_NAV_ITEMS` y **mueve el nodo Soporte** a «Moderación». NO cambia gates, labels de módulos, ni el orden interno de los módulos/hojas. `NavLateral` ya pinta `encabezado:true` (SPEC-857) y la barra móvil ya los omite (`aplanarNavItems`). `arch:check` VERDE.

## Problema

En el menú de 2 niveles (857) solo había **2 encabezados** («Citas y profesionales», «Directorio»). Como el rótulo de una sección **sangra hasta el próximo corte**, Motor IA/Pagos quedaban bajo «Citas y profesionales» y Estadísticas/Soporte/Configuración bajo «Directorio» (lo cazó el recorrido pintado de 857). Faltan encabezados para que cada módulo quede bajo su rótulo correcto.

## Esquema final (5 encabezados no-navegables · orden de módulos INTACTO)

- **Inicio** — sin encabezado (tope)
- **═ Moderación ═** *(nuevo)* — Reportes · Comité de Convivencia · **Soporte** (bandejas de revisión; Soporte SUBE desde la cola por decisión del CEO)
- **═ Citas y profesionales ═** *(ya existía)* — Sesiones · Operadores · Reubicaciones · Profesionales · Verificadores · Verificación
- **═ Motor y pagos ═** *(nuevo)* — Motor IA · Pagos
- **═ Directorio ═** *(ya existía)* — Usuarios · Padres · Colegios
- **═ Sistema ═** *(nuevo)* — Estadísticas · Configuración

## Functional Requirements

- **FR-001:** `ADMIN_NAV_ITEMS` DEBE tener 5 encabezados `encabezado:true` (href `#`, sin módulo, no colapsables): Moderación, Citas y profesionales, Motor y pagos, Directorio, Sistema.
- **FR-002:** Cada módulo/hoja DEBE quedar bajo el encabezado correcto (membresía del esquema).
- **FR-003:** «Soporte» DEBE estar en «Moderación» (una sola vez), no en la cola.
- **FR-004:** NO DEBE cambiar gates, labels de módulos, ni el orden interno; la barra MÓVIL no cambia (Soporte no es principal móvil).
- **FR-005:** Un encabezado huérfano (sección sin hojas visibles para el rol) NO DEBE pintarse.

## Success Criteria

- Candado en `para-rol.test.ts`: membresía sección→ítems exacta del esquema + 5 encabezados no-navegables (muere por mutación si se reordena a otra sección o se renombra/quita un encabezado).
- `nav-items.test` + `para-rol` (paridad order-derived) + candados de render + `arch:check` verdes.
- La barra móvil no cambia (candados nav-movil/role-visibility intactos).

## Assumptions

- Diseño fijó los rótulos («Moderación», «Motor y pagos», «Sistema»); «Motor y pagos» y Soporte-en-Moderación fueron marcados imperfectos por Diseño y resueltos por el CEO.

## Implementación

- `src/lib/nav-items.ts`: 3 encabezados nuevos intercalados (Moderación antes de Reportes; Motor y pagos antes de Motor IA; Sistema antes de Estadísticas) + nodo Soporte movido a «Moderación» (tras Comité de Convivencia).
- `src/lib/nav/para-rol.test.ts`: candado de membresía del esquema + actualización del test de orphan-header (ahora «Moderación» aparece con `bandeja_reportes`).
