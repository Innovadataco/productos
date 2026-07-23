# HANDOFF-SICOV.md — Traspaso técnico del sistema real

> Análisis del sistema original **Gesmovil / SICOV** para no reiniciar el trabajo. Alimenta
> `/speckit.specify` y `data-model.md`. Fuente: código real analizado (backend AdonisJS 5 + frontend Angular 20).

---

## 1. Qué es el sistema

Plataforma de la Superintendencia de Transporte (SICOV) operada por **Gesmovil**, autorizado por la Super
para **interoperar y reportar** datos de transporte. Módulos: despachos (salidas), llegadas, mantenimientos
(preventivo/correctivo/alistamiento/autorización), novedades (vehículo/conductor), soportes, proveedores
vigilados, consulta integradora.

**Actores/roles (numéricos):** `1 = Administrador`, `2 = Cliente / empresa vigilada`, `3 = Operador / subusuario`,
`9 = rol especial (ve todas las placas)`. El **vigilado = la empresa de transporte**.

---

## 2. Modelo de integración con Supertransporte (LO MÁS CRÍTICO)

Gesmovil reporta a la Super con un esquema de **doble token**. Cada petición transaccional lleva **3 cabeceras**
(`app/Dominio/Utilidades/ClienteApiSupertransporte.ts`):

| Header | Qué es | Origen |
|---|---|---|
| `Authorization: Bearer <tokenExterno>` | **Token de proveedor (Gesmovil)** | Gesmovil se autentica contra la Super con `EXTERNAL_APP_USER` + `EXTERNAL_APP_PASSWORD`; token **cacheado con vigencia y auto-refresh** (`TokenExterno.ts`) |
| `token: <tokenAutorizado>` | **Token del vigilado** | Campo `usn_token_autorizado` de `tbl_usuarios`. Subusuario (rol 3) **hereda** el del administrador |
| `documento: <nitVigilado>` | NIT del vigilado | Identificación del usuario (o del admin si es subusuario) |

- Endpoints externos: `URL_DESPACHOS/despachosempresa`, llegadas, `URL_INTEGRADORA/api-integradora/resumen`,
  paramétricas (con su propio `TOKEN_PARAMETRICO`), y token estático (`TOKEN`) para ciertos GET.
- La **"consulta integradora"** verifica en vivo (SICOV) licencia, SOAT, RTM, pólizas, alcoholimetría, tarjeta
  de operación del conductor+vehículo. Se usa en dashboard, wizard de salidas y novedades.
- **Login:** único, `usuario` + `contrasena` → devuelve **dos tokens**: `token` (JWT interno) y `tokenExterno`
  (para la API integradora). **NO existe login por token de "vigía"** (ese fue un error del demo a corregir).

---

## 3. Esquema de datos real (29 migraciones, esquema `sicov` en PostgreSQL)

**Columnas clave confirmadas:**
- `tbl_usuarios`: `usn_id`, `usn_nombre`, `usn_identificacion` (unique), `usn_usuario` (unique), `usn_clave`
  (bcrypt), `usn_clave_temporal` (fuerza cambio al primer ingreso), `usn_telefono`, `usn_correo`,
  **`usn_token_autorizado`** (token del vigilado), `usn_rol_id`, **`usn_administrador`** (enlace subusuario→empresa),
  `usn_estado`.
- `tbl_proveedores_vigilados`: `tpv_id`, `tpv_empresa`, `tpv_vigilado`, **`tpv_token`** (uuid),
  `tpv_fecha_inicial`/`tpv_fecha_final` (**vigencia de contrato**, se valida en middleware), `tpv_documento`,
  `tpv_ruta`, `tpv_estado`.
- `tbl_despachos_solicitudes` (cola): `des_sol_id`, `des_sol_payload` (JSON), `des_sol_nit_vigilado`,
  `des_sol_usuario_id`, `des_sol_fuente` (WEB…), **`des_sol_procesado`** (bool), `des_sol_id_despacho_externo`,
  `des_sol_respuesta_externa` (JSON), `des_sol_error_externo`.

**Resto de tablas (leer columnas exactas de `var/.../database/migrations/` al construir `data-model.md`):**
roles, modulos, submodulos, funcionalidades, roles_modulos, roles_modulos_funcionalidades, usuarios_modulos,
intentos_inicio_sesions, estados, logs_errores, tipo_mantenimientos, archivo_programas, mantenimientos,
preventivos, correctivos, alistamientos, actividades_alistamientos, detalles_actividades_alistamientos,
autorizaciones, novedades, novedades_vehiculos, novedades_conductores, mantenimiento_jobs, llegadas_solicitudes,
+ alter (nit a bigint, cola de despachos).

---

## 4. Arquitectura del sistema real

- **Backend (AdonisJS 5, ~19k LOC):** arquitectura **por capas / DDD** — `app/Dominio` (entidades, casos de uso,
  utilidades), `app/Infraestructura` (repositorios Lucid, clientes HTTP), `app/Presentacion` (controladores, rutas).
  **Colas como workers independientes** (`start/despachos_queue_worker.ts`, `mantenimiento_queue_worker.ts`) con
  estados y reintentos.
- **Frontend (Angular 20, ~22k LOC, 64 componentes):** código ACTIVO en `features/*` (standalone + signals); ignorar
  árboles legacy `*.module.ts`. **Menú lateral data-driven** por los `modulos` del login. Guards: `authGuard`,
  `roleGuard` (por `data.roles`), `usuariosEntryGuard`. Estilos Bootstrap 5 + SweetAlert2.
- **Middlewares:** AutenticacionJWT, AutenticacionVigia, Autorizacion, ValidacionProveedor (token + NIT + contrato
  vigente), VerificarModulo.

---

## 5. Pantallas y flujos reales (para paridad funcional)

- **Login** (usuario/contraseña) · **Recuperar** · **Cambio de clave** (modal, checklist de política en vivo).
- **Dashboard/Inicio:** tab gráficos (barras apiladas por categoría, filtro cliente/fechas) + placas con póliza +
  consulta integradora; tab **logs de cola** con **polling cada 8s**, reintento automático y manual.
- **Salidas/Despachos:** **wizard** (cabecera → consulta integradora → subformularios conductores/vehículo/rutas/
  autorizaciones) con **un solo POST** a `/api/v1/integracion/despachos`. Novedades por salida.
- **Llegadas:** listado **paginado server-side** + modal de registro.
- **Mantenimientos:** tabs Preventivos/Correctivos con **carga masiva XLSX** (server-side) + plantilla + registro.
- **Alistamientos** y **Autorizaciones:** pantallas propias (formularios extensos, PDF programa alistamiento ≤4MB).
- **Usuarios** (con asignación de módulos) y **Subusuarios** (rol 2 gestiona rol 3; **CRUD hoy mockeado** en el front).
- **NO existen** pantallas de "Terminales/rutas" ni "CRUD de empresas" (las rutas son maestra del wizard).

**Detalles a preservar:** normalización tolerante de respuestas (`array_data|data|obj`, snake/camel); fechas en
zona `America/Bogota`; Excel 100% server-side (endpoints `bulk/*/xlsx` + descarga de plantilla + reporte de errores).

---

## 6. Estado del código en esta carpeta (avance demo)

Construido como demo (React+Vite + NestJS + Prisma SQLite + datos demo): login, dashboard, despachos, llegadas,
integradora, mantenimientos, novedades, soportes, terminales, empresas, usuarios; auth JWT; colas en proceso;
capa de integración con stubs; seed. **Verificado funcionando** (frontend + backend + BD).

**Desviaciones a corregir vs. el sistema real:**
1. Login tenía pestaña "Vigía" por token → debe ser **login único usuario/contraseña**; el segundo token es el
   `tokenExterno` de integradora.
2. Falta implementar el **doble token real** (proveedor cacheado + token del vigilado por usuario) en integración.
3. Esquema simplificado → mapear las **29 tablas reales**.
4. Inventé pantallas **Terminales/Empresas** que no existen → quitar/reemplazar por el modelo real.
5. Colas en proceso (`setInterval`) → el real usa **workers independientes**.

**Bugs detectados en revisión de código (corregir):** reintento de cola no resetea `reintentos` (queda atascado);
botón "Reintentar" sin handler; login demo enmascara errores 5xx del backend; `useRecurso` muestra demo ante 401
(sesión expirada); KPI "Despachos hoy" cuenta todo sin filtrar por fecha.

---

## 7. Decisiones tomadas y abiertas

**Tomadas:** arquitectura **modular pragmática** (no hexagonal completa); **PostgreSQL** en Docker propio del 003;
integraciones con **stubs** tras interfaz hasta tener credenciales; datos **demo** (no dump real).

**Abiertas (confirmar con el responsable):**
- **Stack:** portar a **Next.js 16 + Prisma** (estándar de fábrica, recomendado) vs. mantener React+Vite/NestJS.
- **Alcance del 003 y significado de "OTPC"**; cuál es la **primera feature (P1)**.
- Contratos exactos (payloads) de las APIs de Supertransporte.

---

## 8. Siguiente paso sugerido (bajo Spec-Kit)

`/speckit.constitution` (principios: aislamiento Docker, migraciones aditivas, doble token, secretos por env) →
`/speckit.specify` de la **primera feature P1** (sugerido: Autenticación + reporte de un despacho con doble token,
que ejercita el core de integración) usando este documento como insumo → gate de plan → implementar.

---

## 9. Fe de erratas — verificación contra código real (2026-07-22, ZEUS)

Hallazgos de la verificación línea a línea del legacy. Rutas relativas a `legacy-sistema-original/`.

| # | Afirmación del handoff | Realidad verificada |
|---|------------------------|---------------------|
| 1 | "NO existe login por token de vigía" | **FALSO a nivel backend:** existe `POST /api/v1/autenticacion/inicio-vigia` (`ControladorAutenticacion.ts:31-54`) y el middleware `AutenticacionVigia` protege toda la superficie `api/v2/*` (empresas, mantenimiento v2, archivos, registro-vigia). El frontend sí hace login único, pero el canal vigía está **VIVO** en el backend. Decisión **D-005** pendiente (CEO): confirmar consumidores reales antes del switch-over. |
| 2 | "Rol 9 ve todas las placas" | **NO existe en el código:** `DiccionarioAutorizacion.ts` solo define 1 y 2; las ramas reales manejan 1/2/3; grep de rol 9 vacío. |
| 3 | "Token de proveedor cacheado con vigencia y auto-refresh" | **Parcialmente falso:** `TokenExterno.set()` se invoca siempre SIN expiración y con `_expiraEn=null` `isVigente()` devuelve `true` indefinidamente (`TokenExterno.ts:44-49`); solo se refresca si un error lo limpió. El TTL real del token de la Super debe validarse en modo real. |
| 4 | "Login devuelve dos tokens" | Devuelve **TRES:** `token` (JWT interno), `tokenExterno` y `tokenParametrica` (`ServicioAutenticacion.ts:108,122`). Además hay doble nombre de env: `TOKEN_PARAMETRICA` (login) vs `TOKEN_PARAMETRICO` (`ClienteApiSupertransporte.ts:40`), y un bearer hardcodeado en `ControladorMantenimiento.ts:1180`. |
| 5 | "Bugs: reintento no resetea contador; botón Reintentar sin handler" | Eso era del **DEMO**, no del legacy: el legacy SÍ resetea `reintentos=0` en el reintento manual (`ServicioSolicitudDespacho.ts:170`; `RepositorioMantenimientoDB.ts:1164`) y el botón tiene handler real. |
| 6 | "29 tablas" | Son **27 tablas** creadas en **29 migraciones** (2 son ALTER). El archivo `..._tbl_intentos_inicio_sesions.ts` crea en realidad `tbl_bloqueo_usuarios`. |
| 7 | "NO existen pantallas de Terminales ni CRUD de empresas" | Módulos backend **SIN pantalla** en el frontend legacy: **Soportes** (endpoints, algunos SIN autenticación), **Empresas/Proveedores vigilados** (CRUD completo bajo `autenticacionVigia`) y **Terminales** (CRUD rutas/paradas/clases/vías + `enviar-st`). No son "solo maestras": son superficie **máquina-a-máquina**. Novedades en el frontend vive como modal dentro de salidas, no como pantalla propia. |
| 8 | (Seguridad del legacy — a NO replicar) | `postTransaccional` imprime cabeceras (ambos tokens) y body por `console.log` (`ClienteApiSupertransporte.ts:78-82`); `ruta_soportes.ts` tiene endpoints sin auth; `Autorizacion.ts` no hace `return` tras el 401 (sigue a `next()`); `ValidacionProveedor.ts` se salta TODA la validación si llega el header `fuentedato` (líneas 13-15); `BLOQUEO_CREDENCIALES=false` por defecto y el contador de intentos no se resetea tras login exitoso. |
| 9 | (Cola de llegadas) | `tbl_llegadas_solicitudes` **NO** tiene columnas de reintentos/estado de cola (solo `procesado`), a diferencia de despachos. |
| 10 | (Workers) | El worker legacy **NO es `setInterval`:** es bucle asíncrono continuo (`while true` + sleep 1s/2s) en `start/despachos_queue_worker.ts` y `mantenimiento_queue_worker.ts`; procesa lotes de 20, máx 3 reintentos, +5 min entre intentos. |

**Estas correcciones prevalecen sobre §2–§6 donde contradigan.**

### 9.1 Verificación contra la BD de producción (2026-07-22)

Export de solo lectura autorizado por el CEO (acta CE-01 / D-009):

| Hallazgo | Detalle |
|---|---|
| **Esquema real** | La BD se llama **`appdb`** y las tablas viven en el esquema **`public`** — **NO** en `sicov`. El esquema `sicov` es decisión de diseño del 003. Todo script de migración lee `public.*` → escribe `sicov.*`. |
| **`tbl_proveedores_vigilados` VACÍA (0 filas)** | Es la tabla que valida el middleware `ValidacionProveedor` del canal máquina-a-máquina. Vacía ⇒ **ninguna petición M2M podría autenticarse hoy**. Indicio fuerte de que el canal vigía/`api/v2` no tiene consumidores (decisión **D-005**). |
| **Volumen de datos real** | **9 usuarios**: 1 administrador (rol 1, sin token), **2 empresas vigiladas (rol 2, con token)** y 6 subusuarios (rol 3) que cuelgan de 2 NIT de administrador. La migración de datos es mínima. |
| **`URL_INTEGRADORA` en producción** | Trae la **URL completa** (`.../api-integradora/resumen`) mientras el código le añade otra vez `/api-integradora/resumen` ⇒ **ruta duplicada en el legacy productivo**. En el 003 la convención es **host base únicamente** (ver `.env.example`). |
| **`NODE_ENV=development`** | El despliegue productivo del legacy no está endurecido. No replicar. |
| **PostgreSQL expuesto** | Escucha en `0.0.0.0:5432` (todas las interfaces) en el VPS del legacy. Revisar antes del switch-over. |
