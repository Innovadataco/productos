# SPEC-857 · Menú del administrador en módulos de 2 niveles

**Status**: IMPLEMENTADO

- **Rama:** `work/pi-SPEC-857-menu-admin-modulos`
- **Fuente de verdad (FORMA):** Diseño `FORMA-SPEC857-MENU-ADMIN-MODULOS-COLAPSABLES` — commit **ec4910a (v2.2)** en `Gestion-de-proyectos` (Pagos 9 · Estadísticas 4 · 3 drops; sucede a fbdba61/v2.1).
- **Impacto en arquitectura:** SÍ. Cambia la NAVEGACIÓN (capa 1, `docs/architecture`): `ADMIN_NAV_ITEMS` pasa de 23 hojas planas a un árbol de 2 niveles (9 MÓDULOS colapsables con `href:"#"` + 2 ENCABEZADOS de sección no navegables + hojas sueltas). Toca el resolver único `navParaRol`/`porModuloYProxy` (compuerta de grupo por HIJOS, no por el módulo del grupo; paso de encabezados con supresión de huérfanos), la barra lateral `NavLateral` (encabezados no clicables, módulos admin colapsados-por-defecto con abrir-en-activo, ámbar de Pagos movido al grupo+hijos), el registro de íconos `IconoNav` (claves semánticas de grupo; hojas sin ícono) y las fuentes del arch (`arraysNav` aplana ADMIN a hojas). No toca schema, endpoints ni proxy. `npm run arch:check` queda VERDE en el mismo PR (aserción B evaluó las hojas aplanadas).

## Contexto

El menú del administrador había crecido a 23 entradas planas (operación + directorio + pagos + motor IA, todo al mismo nivel), difícil de barrer de un vistazo. Diseño lo reorganiza en **módulos de 2 niveles**: grupos colapsables por dominio y dos encabezados de sección («Citas y profesionales», «Directorio») como separadores visuales.

Regla rectora (CEO): **el menú lista PANTALLAS REALES — una vista = una entrada.** No se inventan pantallas (candado I-299: las 48 rutas existen) ni se mapean labels a destinos que mienten.

## User Stories

### US-1 (P1) · El admin ve su menú agrupado por dominio
Como administrador, veo el menú lateral organizado en módulos colapsables (Reportes, Comité de Convivencia, Operadores, Verificación, Motor IA, Pagos, Usuarios, Estadísticas, Configuración) y dos encabezados de sección, para ubicar cada pantalla por su dominio.

**Acceptance**
- Cada MÓDULO pinta su ícono semántico; sus hojas van sin ícono (texto), como el patrón «Usuarios» del colegio.
- Los encabezados de sección NO son clicables (no enlace, no botón).
- En la familia admin, los módulos NACEN COLAPSADOS; si la ruta activa cae dentro de un módulo, ese módulo nace ABIERTO (abrir-en-activo).

### US-2 (P1) · El menú sigue siendo honesto (SPEC-086)
Como administrador con un subconjunto de módulos, solo veo los grupos/hojas a cuyas pantallas puedo entrar.

**Acceptance**
- Un MÓDULO pinta solo si tengo permiso en ≥1 de sus hijos (la compuerta es por HIJOS; el `modulo` del grupo es representativo).
- Cada HOJA cuelga de SU módulo real (el que la página gatea en servidor): Operadores→Auditoría = `audit_logs`, Estadísticas→Dinero vs valor = `pagos_admin`, Estadísticas→Salud del motor = `estadisticas_salud_motor`, Configuración→Guías de acción = `guias_accion_admin`.
- Un ENCABEZADO de sección se oculta si su sección queda sin hojas visibles (no hay encabezado huérfano).

### US-3 (P2) · La barra móvil de los roles internos no repite íconos
Como operador/verificador/comité de validación en móvil, veo pestañas con íconos distinguibles.

**Acceptance**
- El default móvil (roles sin curaduría) toma la PRIMERA hoja de cada ícono distinto (una pestaña por sección), ≤4, sin íconos duplicados (candado nav-iconos cláusula 1).

## Decisiones del CEO (3 choques resueltos)

1. **Pagos «Resumen»: DROP.** No se mapea a `/pendientes` (label que miente).
2. **Pagos «Analítica»: DROP de Pagos.** Es la misma vista que Estadísticas «Dinero vs valor»; no se crea href propio `/pagos/analitica`.
3. **Estadísticas «Clasificación»: DROP del menú.** Es un tab-query de «Operación».

**Conteos finales:** Pagos = 9 (Pendientes · Mora · Reembolsos · Bonos · Planes · Vencimientos · Sin suscripción · Citas por aprobar · Citas vencidas). Estadísticas = 4 (Dinero vs valor · Motor · Operación · Salud del motor).

## Functional Requirements

- **FR-001:** El sistema DEBE pintar el menú admin como árbol de 2 niveles desde la fuente única `navParaRol` (cero listas a mano; candado `nav-superficie-unica`).
- **FR-002:** El sistema DEBE mostrar un MÓDULO cuando el rol tenga ≥1 hijo visible, y ocultarlo cuando no le quede ninguno.
- **FR-003:** El sistema DEBE mostrar/ocultar cada ENCABEZADO de sección según su sección tenga o no ≥1 hoja visible.
- **FR-004:** Cada HOJA DEBE declarar el módulo que su página gatea en servidor (menú honesto, SPEC-086 / I-299).
- **FR-005:** El sistema NO DEBE introducir íconos nuevos: la clave semántica sube al grupo; las hojas admin van sin ícono.
- **FR-006:** El aterrizaje `/dashboard/admin` DEBE redirigir a una HOJA real accesible (nunca a un contenedor `"#"`).
- **FR-007:** `npm run arch:check` DEBE quedar VERDE en el mismo PR.

## Success Criteria

- Los candados nav (`nav-items`, `nav/para-rol`, `nav-iconos`, `nav-lateral`, `nav-movil`, `nav-superficie-unica`) quedan VERDES con el árbol nuevo.
- `tsc`, `lint`, `test:unit` y `build` verdes; `arch:check` verde.
- El recorrido real del admin muestra el menú agrupado, colapsable, con Pagos en ámbar y los dos encabezados.

## Assumptions

- `audit_logs`, `guias_accion_admin` y `estadisticas_salud_motor` dejan `SIN_PANTALLA_PROPIA` porque ahora son hojas de menú (consecuencia directa del DATO aprobado por CEO).
- El principal móvil «Estadísticas» del admin apunta a `/dashboard/admin/estadisticas/operacion` (la raíz `/estadisticas` dejó de ser destino del menú). Default CONFESADO al CEO; alternativas: bajar a 3 principales, o apuntar a otra hoja.
- El índice `specs/README.md` lo mantiene el barrido post-merge (SPEC-487); no se edita en el PR.

## Implementación

- `src/lib/nav-items.ts`: `NavItem.modulo` opcional + `encabezado?`; `aplanarNavItems`; nuevo `ADMIN_NAV_ITEMS` (9 módulos + 2 encabezados + hojas); `PRINCIPALES_MOVIL.ADMIN` con `/estadisticas/operacion`.
- `src/lib/nav/para-rol.ts`: grupo gateado por HIJOS; paso de encabezados con supresión de huérfanos; `aplanar`/`navMovilParaRol` omiten encabezados; default móvil dedupe por ícono.
- `src/components/modules/nav/NavLateral.tsx`: `EncabezadoLateral`; colapso-por-familia (admin colapsado + abrir-en-activo); ámbar de Pagos en grupo+hijos; activo por prefijo-más-largo (hojas anidadas).
- `src/components/modules/nav/IconoNav.tsx`: 8 claves de grupo (reusan componentes); se retiran entradas de ex-raíces/hijos y 5 componentes que quedaron sin uso.
- `src/app/dashboard/admin/page.tsx`: redirect usa `aplanarNavItems`.
- `scripts/arch/lib/nav-fuentes.ts`: `arraysNav` aplana ADMIN a hojas.
- Candados nav actualizados al árbol de 2 niveles (Comité subruta, Pagos ámbar, headers excluidos de hojas/íconos, default móvil dedupe).
