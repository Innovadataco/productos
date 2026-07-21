# Data Model — 001-auth-despacho-doble-token

> Esquema `sicov` en PostgreSQL. **Columnas verificadas 1:1 contra las migraciones reales** del legacy (`legacy-sistema-original/back_gestion_despachos/database/migrations/`). Modelos Prisma con `@map`/`@@map` a los nombres físicos exactos y `@@schema("sicov")`. Migraciones **aditivas**; nunca `migrate reset`.

## Configuración Prisma (obligatoria)
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")   // ...?schema=sicov
  schemas  = ["sicov"]
}
```
- `searchPath` real del legacy: `[sicov, public]` (`config/database.ts:45`). Todas las tablas viven en `sicov.*`.
- Convenciones: cada tabla tiene PK `serial` (`Int @id @default(autoincrement())`); columnas con prefijo propio (`usn_`, `rol_`, `des_sol_`…) → `@map`. `json` legacy = `Json`. Booleans de estado con default `true`.
- ⚠️ **Dos nombres de tabla no coinciden con su archivo de migración:** `..._tbl_intentos_inicio_sesions.ts` crea **`tbl_bloqueo_usuarios`**; `..._logs_errores.ts` crea **`tbl_logs_errores`**.

## Alcance P1 (13 tablas del core)
`tbl_roles`, `tbl_usuarios`, `tbl_modulos`, `tbl_submodulos`, `tbl_funcionalidades`, `tbl_roles_modulos`, `tbl_roles_modulos_funcionalidades`, `tbl_usuarios_modulos`, `tbl_bloqueo_usuarios`, `tbl_proveedores_vigilados`, `tbl_despachos_solicitudes`, `tbl_estados`, `tbl_logs_errores`. Las 16 restantes se modelan en features siguientes (mapa completo al final).

---

## Rol → `sicov.tbl_roles`
| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `rol_id` | Int PK serial | no | auto |
| `nombre` | `rol_nombre` | varchar(30) | sí | — |
| `estado` | `rol_estado` | Boolean | sí | — |
| `root` | `rol_root` | Boolean | sí | false |
| `creado` | `rol_creado` | Timestamptz | sí | now() |
| `actualizado` | `rol_actualizado` | Timestamptz | sí | now() |

Valores canónicos (fijados en seed): **1** Administrador · **2** Cliente/empresa vigilada · **3** Operador/subusuario. (El rol 9 del HANDOFF no existe en el legacy — descartado, opción A del responsable. En el código legacy aparecen 5/7 solo en flujos PESV/Vigía, fuera de alcance P1.)

## Usuario → `sicov.tbl_usuarios`
| Prisma | Columna | Tipo | Null | Default | Notas |
|---|---|---|---|---|---|
| `id` | `usn_id` | Int PK serial | no | auto | |
| `nombre` | `usn_nombre` | varchar(200) | **no** | — | |
| `identificacion` | `usn_identificacion` | varchar(255) | sí | — | **UNIQUE**; NIT del vigilado |
| `usuario` | `usn_usuario` | varchar(255) | sí | — | **UNIQUE**; credencial |
| `clave` | `usn_clave` | varchar(255) | sí | — | **bcrypt** |
| `claveTemporal` | `usn_clave_temporal` | Boolean | sí | **true** | fuerza cambio 1er ingreso |
| `telefono` | `usn_telefono` | varchar(255) | sí | — | |
| `correo` | `usn_correo` | varchar(255) | sí | — | |
| `tokenAutorizado` | `usn_token_autorizado` | varchar(255) | sí | — | **token del vigilado** (cabecera 2) |
| `rolId` | `usn_rol_id` | Int | sí | — | **FK → tbl_roles.rol_id** |
| `administradorId` | `usn_administrador` | Int | sí | — | **identificación del admin** (no `usn_id`); join lógico a `usn_identificacion` |
| `estado` | `usn_estado` | **Boolean** | sí | true | activo/inactivo |
| `creacion` | `usn_creacion` | Timestamptz | sí | — | (sin default en legacy) |
| `actualizacion` | `usn_actualizacion` | Timestamptz | sí | — | |

Relaciones: `rol`. ⚠️ **Herencia rol 3:** `usn_administrador` guarda la **identificación** del administrador (no su `usn_id`), por lo que el join es `usn_administrador → usn_identificacion` (relación por campo no-PK; en Prisma se resuelve con `@relation(fields:[administradorId], references:[identificacion])` o con consulta explícita, no con la PK). Verificado en `AutenticacionUsuarioHelper.ts`.
**Reglas:** login valida `usn_clave` con bcrypt (mensaje genérico). `usn_estado=false` → denegado. Rol 3: `tokenAutorizado`+`identificacion` **efectivos** = los del usuario cuya `usn_identificacion == usn_administrador`; si faltan → error de configuración 400 (no reporta).

## Modulo / Submodulo / Funcionalidad (menú data-driven)
- **`tbl_modulos`**: `mod_id` PK · `mod_nombre` v(30) · `mod_nombre_mostrar` v(30) · `mod_ruta` v(100) · `mod_orden` int · `mod_icono` v(255) · `mod_estado` bool · timestamps def now().
- **`tbl_submodulos`**: `smod_id` PK · `smod_nombre` · `smod_nombre_mostrar` · `smod_ruta` v(100) · `smod_modulo` **FK→mod_id** · `smod_icono` · `smod_estado` bool def true · timestamps.
- **`tbl_funcionalidades`**: `fun_id` PK · `fun_nombre` v(30) · `fun_estado` bool · timestamps.

## Autorización: RolModulo / RolModuloFuncionalidad / UsuarioModulo
- **`tbl_roles_modulos`**: `rom_id` PK · `rom_rol_id` **FK→rol_id** · `rom_modulo_id` **FK→mod_id** · timestamps.
- **`tbl_roles_modulos_funcionalidades`**: `rmf_id` PK · `rmf_rol_id` FK · `rmf_modulo_id` FK · `rmf_funcionalidad_id` **FK→fun_id** · timestamps.
- **`tbl_usuarios_modulos`**: `usm_id` PK · `usm_usuario_id` **FK→usn_id CASCADE** · `usm_modulo_id` **FK→mod_id CASCADE** · `usm_estado` bool def true · timestamps · **UNIQUE(usm_usuario_id, usm_modulo_id)**.

> El menú lateral se arma con los módulos habilitados por rol (`roles_modulos`) + overrides por usuario (`usuarios_modulos`). Es la base de `roleGuard`/`VerificarModulo`. El login devuelve `modulos` normalizados para pintar el sidebar.

## BloqueoUsuario → `sicov.tbl_bloqueo_usuarios`  (archivo `..._tbl_intentos_inicio_sesions.ts`)
| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `blu_id` | Int PK | no | auto |
| `identificacion` | `blu_identificacion` | varchar(255) | sí | — (**UNIQUE**) |
| `intentosFallidos` | `blu_intentos_fallidos` | Int | sí | 0 |
| `bloqueado` | `blu_bloqueado` | Boolean | sí | false |
| `ultimoIntento` | `blu_ultimo_intento` | Timestamptz | sí | — |
| `actualizacion` | `blu_actualizacion` | Timestamptz | sí | now() |
| `creacion` | `blu_creacion` | Timestamptz | sí | now() |

Controla bloqueo por intentos fallidos de login (por `identificacion`).

## ProveedorVigilado → `sicov.tbl_proveedores_vigilados`
| Prisma | Columna | Tipo | Null | Default |
|---|---|---|---|---|
| `id` | `tpv_id` | Int PK | no | auto |
| `empresa` | `tpv_empresa` | varchar(255) | sí | — |
| `vigilado` | `tpv_vigilado` | varchar(255) | sí | — |
| `token` | `tpv_token` | String @db.Uuid | sí | — |
| `estado` | `tpv_estado` | Boolean | sí | true |
| `fechaInicial` | `tpv_fecha_inicial` | Date | sí | — |
| `fechaFinal` | `tpv_fecha_final` | Date | sí | — |
| `documento` | `tpv_documento` | varchar(255) | sí | — (NIT) |
| `ruta` | `tpv_ruta` | varchar(255) | sí | — |
| `nombreOriginal` | `tpv_nombre_original` | varchar(255) | sí | — |
| `createdAt` | `tpv_created_at` | Timestamptz | sí | now() |
| `updatedAt` | `tpv_updated_at` | Timestamptz | sí | now() |

**ValidacionProveedor:** reporte procede solo si existe proveedor con `documento == nitVigilado`, `estado=true`, y `fechaInicial <= hoy(Bogota) <= fechaFinal`. Fuera de vigencia → rechazo.

## DespachoSolicitud → `sicov.tbl_despachos_solicitudes`  (create + alter `_cola`, estado FINAL)
| Prisma | Columna | Tipo | Null | Default | Origen |
|---|---|---|---|---|---|
| `id` | `des_sol_id` | Int PK | no | auto | create |
| `payload` | `des_sol_payload` | Json | **no** | — | create |
| `nitVigilado` | `des_sol_nit_vigilado` | varchar(20) | **no** | — | create |
| `usuarioId` | `des_sol_usuario_id` | varchar(20) | **no** | — | create (texto, no FK) |
| `fuente` | `des_sol_fuente` | varchar(10) | **no** | 'WEB' | create |
| `procesado` | `des_sol_procesado` | Boolean | **no** | false | create |
| `idDespachoExterno` | `des_sol_id_despacho_externo` | Int | sí | — | create |
| `respuestaExterna` | `des_sol_respuesta_externa` | Json | sí | — | create |
| `errorExterno` | `des_sol_error_externo` | Text | sí | — | create |
| `fechaCreacion` | `des_sol_fecha_creacion` | Timestamptz | sí | now() | create |
| `fechaActualizacion` | `des_sol_fecha_actualizacion` | Timestamptz | sí | now() | create |
| `estado` | `des_sol_estado` | varchar(30) | **no** | 'pendiente' | **alter** |
| `reintentos` | `des_sol_reintentos` | Int | **no** | 0 | **alter** |
| `rolId` | `des_sol_rol_id` | Int | sí | — | **alter** |
| `siguienteIntento` | `des_sol_siguiente_intento` | Timestamptz | sí | now() | **alter** |

Índice: `@@index([estado, siguienteIntento], map: "des_sol_estado_intento_idx")`.
**Ciclo:** `pendiente → procesando → procesado` | `fallido` (reintentable). El worker selecciona por `(estado, siguienteIntento)`; reintento (auto/manual) actualiza `reintentos`/`siguienteIntento` sin dejar atascado (corrige Bug 1). `usuarioId`/`nitVigilado`/`rolId` guardan el contexto efectivo (heredado si rol 3).

## Soporte P1
- **`tbl_estados`**: `est_id` PK · `est_nombre` v(150) · `est_estado` bool def true.
- **`tbl_logs_errores`** (archivo `logs_errores.ts`): `log_id` PK · `log_mensaje` v(1024) notNull · `log_stack_trace` text · `log_usuario` v(255) · `log_endpoint` v(255) · `log_creacion` tstz def now().

---

## Mapa completo (29 migraciones) — referencia features siguientes
`tbl_tipo_mantenimientos`, `tbl_archivo_programas`, `tbl_mantenimientos`, `tbl_preventivos` (`tpv_nit` **bigint**), `tbl_correctivos` (`tcv_nit` **bigint**), `tbl_alistamientos`, `tbl_actividades_alistamientos`, `tbl_detalles_actividades_alistamientos` (FK CASCADE), `tbl_autorizaciones` (~50 col, PDFs), `tbl_novedades` + `tbl_novedades_vehiculos` + `tbl_novedades_conductores`, `tbl_mantenimiento_jobs` (cola de mantenimientos, patrón idéntico a despachos), `tbl_llegadas_solicitudes` (cola de llegadas). Alter `nit→bigint` en preventivos/correctivos. Columnas exactas en el reporte de research.

## Migración inicial (aditiva)
`prisma migrate dev --name init_sicov_p1` crea las 13 tablas del core en `sicov` (BD nueva → aditiva). Seed demo (no dump real): roles 1/2/3, módulos + asignaciones, un admin (rol 1), un vigilado (rol 2) con `tokenAutorizado` y `ProveedorVigilado` de contrato vigente, un subusuario (rol 3) con `administradorId = usn_identificacion` del vigilado, y despachos de ejemplo en varios estados.
