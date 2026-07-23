# Research — 086: mapeo navegación ↔ catálogo (PROPUESTA para visto bueno de ZEUS)

**Fecha**: 2026-07-23 · **Autor**: ODIN · **Estado**: 🛑 PENDIENTE DE VISTO BUENO antes de implementar

## 1. Inventario verificado de navegación

**AdminNav** (`src/components/modules/AdminNav.tsx:8-20`) — 11 ítems con `roles` quemado.
**ComiteSubNav** (`src/app/dashboard/admin/comite/components/ComiteSubNav.tsx`) — 3 tabs con lógica de rol quemada (`puedeVerTab`).
**ColegioNav** (`src/components/modules/colegio/ColegioNav.tsx`) — 6 ítems sin filtro (todo SCHOOL_ADMIN).
**NavHeader** usa `rol` solo para estilos (colores/badge) — no filtra: no se toca.

## 2. MAPEO PROPUESTO: ítem de menú → módulo

### AdminNav (panel interno)

| Ítem de menú (label) | href | Módulo (clave) | Notas |
|---|---|---|---|
| Bandeja de reportes | `/dashboard/admin` | `bandeja_reportes` | **D-4**: un solo módulo para lista + acciones (ver §3.2) |
| Revisión de spam | `/dashboard/admin/spam` | `revision_spam` | **Módulo NUEVO** (D-3): deja de depender de `anti_abuso` |
| Comité | `/dashboard/admin/comite` | `comite_bandeja` | Hijo de `comite` (AND jerárquico) |
| Dashboard | `/dashboard/admin/estadisticas` | `estadisticas` | |
| Centro de Control IA | `/dashboard/admin/ia` | `centro_control_ia` | Raíz; sus submódulos gobiernan las tabs internas |
| Operadores | `/dashboard/admin/operadores` | `operadores` | |
| Colegios | `/dashboard/admin/colegios` | `colegios_gestion` | Hijo de `colegios` |
| Anti-abuso | `/dashboard/admin/anti-abuso` | `anti_abuso` | |
| Apelaciones | `/dashboard/admin/apelaciones` | `apelaciones` | |
| Dataset | `/dashboard/admin/dataset-entrenamiento` | `dataset_entrenamiento` | |
| Configuración | `/dashboard/admin/configuracion` | `configuracion_sistema` | Raíz; tab permisos = `configuracion_permisos` |

### ComiteSubNav (tabs)

| Tab | href | Módulo | Notas |
|---|---|---|---|
| Bandeja | `/dashboard/admin/comite` | `comite_bandeja` | |
| Gestión | `/dashboard/admin/comite/gestion` | `comite` | Guarda `admin/comite/integrantes/**` (ya mapeado así) |
| Auditoría | `/dashboard/admin/comite/auditoria` | `comite_auditoria` | |

### ColegioNav (SCHOOL_ADMIN)

| Ítem | href | Módulo | Notas |
|---|---|---|---|
| Inicio | `/dashboard/colegio` | `colegios` | Raíz (home institucional) |
| Cursos | `/dashboard/colegio/cursos` | `colegios_gestion` | |
| Carga masiva | `/dashboard/colegio/cursos/carga` | `colegios_gestion` | |
| Alertas | `/dashboard/colegio/alertas` | `colegios_gestion` | |
| Estadísticas | `/dashboard/colegio/estadisticas` | `colegios_gestion` | |
| Auditoría | `/dashboard/colegio/auditoria` | `colegios_auditoria` | |

## 3. Cambios al catálogo

### 3.1 Módulo nuevo: `revision_spam`

- Categoría `operador`, orden 35, no crítico.
- Guards que cambian de clave: `/api/admin/spam/pendientes`, `/api/admin/spam/[id]/resolver` (hoy `anti_abuso`) → `revision_spam`.
- **Backfill**: copiar `activo` desde las filas de `anti_abuso` por rol, **más** `OPERADOR activo=true` (el menú siempre se lo ofreció — D-3: la intención histórica es que lo vea; nadie pierde nada, se corrige el defecto).

### 3.2 Fusión: `reportes_revision` → `bandeja_reportes`

- Guards que cambian de clave: `/api/admin/reportes-revision/**` (5 rutas) y `/api/admin/correcciones` → `bandeja_reportes`. Las rutas `reportes/[id]/*` ya están en `bandeja_reportes` → la lista Y las acciones quedan bajo el mismo módulo (D-4).
- **Migración de datos (aditiva, SQL)**: por cada rol, `bandeja_reportes.activo = bandeja_reportes.activo OR reportes_revision.activo` (semántica unión: nadie pierde acceso que tuviera por cualquiera de las dos claves). Después: borrar filas de `reportes_revision` y su fila de catálogo (borrado de DATOS de catálogo, no de schema; el historial AuditLog no se toca).
- Seed: `reportes_revision` sale del catálogo y del backfill; OPERADOR queda con `bandeja_reportes` + `revision_spam`.

### 3.3 Módulos sin pantalla propia (justificación, se conservan)

| Módulo | Justificación |
|---|---|
| `comite` (raíz) | Contenedor + guarda Gestión/integrantes del comité |
| `centro_control_ia` (raíz) | Contenedor; guarda la página del centro |
| `ia_playground`, `ia_eval`, `ia_simulaciones`, `ia_configuracion` | Tabs internas del centro IA — **se filtran por submódulo en esta spec (CORRECCIÓN 3)**, igual que ComiteSubNav |
| `colegios` (raíz) | Contenedor + home institucional |
| `configuracion_sistema` (raíz) | Contenedor + página de configuración |
| `configuracion_permisos` | Tab "Permisos por rol" dentro de configuración |
| `audit_logs` | Guarda `/api/admin/audit-logs` (vistas de auditoría de operadores/comité; sin ítem de menú propio, se accede por subnavegación) |

## 4. Guards de página (server) — mapeo de páginas

| Página | Módulo | Página | Módulo |
|---|---|---|---|
| `admin/page.tsx` | `bandeja_reportes` | `admin/ia/**` | `centro_control_ia` |
| `admin/spam` | `revision_spam` | `admin/operadores/**` | `operadores` |
| `admin/comite` | `comite_bandeja` | `admin/colegios/**` | `colegios_gestion` |
| `admin/comite/gestion` | `comite` | `admin/anti-abuso` | `anti_abuso` |
| `admin/comite/auditoria` | `comite_auditoria` | `admin/apelaciones/**` | `apelaciones` |
| `admin/estadisticas` | `estadisticas` | `admin/dataset-entrenamiento` | `dataset_entrenamiento` |
| `admin/configuracion` | `configuracion_sistema` | `colegio` (home) | `colegios` |
| `colegio/cursos`, `carga`, `alertas`, `estadisticas`, `alumnos` | `colegios_gestion` | `colegio/auditoria` | `colegios_auditoria` |

## 5. Guards API que cambian de clave (resumen)

| Ruta | Hoy | Propuesto |
|---|---|---|
| `/api/admin/spam/pendientes`, `/api/admin/spam/[id]/resolver` | `anti_abuso` | `revision_spam` |
| `/api/admin/reportes-revision/**` (5 rutas) | `reportes_revision` | `bandeja_reportes` |
| `/api/admin/correcciones` | `reportes_revision` | `bandeja_reportes` |

El resto de las 83 rutas con guard quedan igual. Total de archivos tocados por re-claveo: ~8.

## 6. Migración de datos (aditiva, una sola migración) — CORREGIDA por ZEUS

1. `INSERT` módulo `revision_spam` (catálogo).
2. Backfill `PermisoModulo` para `revision_spam`: **solo copia desde `anti_abuso` por rol** (CORRECCIÓN 2: denegado por defecto, sin inferencia desde el menú; OPERADOR queda denegado y el CEO lo activa con un clic si lo quiere).
3. `UPDATE PermisoModulo bandeja_reportes SET activo = bandeja_reportes.activo AND reportes_revision.activo` por rol (**CORRECCIÓN 1: semántica AND** — ante la duda se restringe, nunca se amplía; `bandeja_reportes` protege también baja/escalar/anonimizar/revelar-original, y OR escalaría privilegios silenciosamente). Las restricciones resultantes se listan (rol, módulo) en `cierre.md`.
4. `DELETE` filas de `reportes_revision` y su fila de `ModuloPermisible`.
5. Nada de esto toca schema (datos de catálogo); nada toca AuditLog histórico.

## 6B. Tabs del Centro de Control IA (CORRECCIÓN 3)

El array `TABS` de `src/app/dashboard/admin/ia/page.tsx` se filtra por submódulo en servidor:

| Tab | Submódulo requerido |
|---|---|
| Documentación | ninguno (visible con la raíz `centro_control_ia`) |
| Playground (incl. simulaciones UI) | `ia_playground` |
| Eval | `ia_eval` |
| Configuración | `ia_configuracion` |

Si el tab activo por querystring queda sin permiso, cae al primer tab permitido.

## 6C. Aterrizaje tras pérdida de permisos (VACÍO 4)

`/dashboard/admin` (la bandeja) es la ruta por defecto tras login. Si el rol la pierde:
- Al entrar, se redirige al primer ítem de menú permitido del rol (orden de la nav).
- Si no tiene ninguno: pantalla "Sin módulos asignados, contacta al administrador" (nunca blanco ni error de carga).
- Escenario incluido en `quickstart.md`.

## 7. Resolución server-side de la navegación

`dashboard/admin/layout.tsx` ya resuelve el rol del token: se añade una consulta
(`PermisoModulo activo del rol` + claves de `ModuloPermisible`) y se pasa
`modulosPermitidos: string[]` a `AdminNav`. `ColegioNav` lo mismo desde
`dashboard/colegio/layout.tsx`. `ComiteSubNav` recibe las claves desde las páginas
server que ya resuelven el rol. **Sin endpoint nuevo** (mandato del brief).

## 8. Test estructural (D-anti-regresión)

Las listas de ítems nav se extraen a un módulo compartido (`navItems` con `{ href, label, modulo }`
por nav). Test sin BD: cada `modulo` de cada ítem existe en `CATALOGO_MODULOS`; y cada módulo
del catálogo con pantalla visible está referenciado por algún ítem (o está en la lista blanca
de "sin pantalla propia" §3.3).
