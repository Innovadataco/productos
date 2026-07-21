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
