# Feature Specification: 009 — Configuración: Empresas (clientes) y Usuarios en cascada

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-23

**Status**: PLANEADO — MODO PLAN (gate de revisión de ZEUS; NO implementar)

**Input**: Encargo 003-SICOV-004 (ZEUS). Módulo CONFIGURACIÓN (solo rol 1) con submódulos
Clientes/Empresas y Usuarios (cascada de permisos D-017). **FASE 1 del roadmap D-047: todo
API-independiente, contra BD local — NADA toca la Super** (regla CEO en AGENTS §6). Correo por
Resend tras interfaz (D-048). Se construye junto a la spec 013 porque comparten empresa+token.

---

## Contexto (contra el código REAL, verificado 2026-07-23)

- **Empresa+token YA existen:** `ProveedorVigilado` (`tbl_proveedores_vigilados`) tiene
  `tpv_empresa`, `tpv_vigilado`, `tpv_documento` (NIT), **`tpv_token` (uuid)**, `tpv_fecha_inicial/
  final` (contrato), `tpv_ruta`, `tpv_estado`. El enlace empresa↔usuario rol 2 es el **join lógico
  NIT** (`usn_identificacion == tpv_documento`) que ya usa `validarContratoVigente`.
- **La granularidad de permisos YA está modelada:** `Modulo` → `Submodulo` (`smod_modulo`) →
  `Funcionalidad` + `RolModuloFuncionalidad` (por rol) y `UsuarioModulo` (por usuario;
  `cargarModulos` ya prioriza lo personalizado sobre lo del rol). El guard D-017
  (`requiereModulo`) ya protege cada endpoint de operación.
- **Correo:** hoy es un stub inline en `api/auth/recuperar/route.ts` (console.log). La política de
  clave (mín 8, mayúscula, minúscula, dígito, símbolo) ya existe y se reutiliza.
- **Manual (HANDOFF §10.1/§10.8):** el admin de plataforma NO opera (solo Inicio y Usuarios); crea
  clientes asignándoles módulos + token; el cliente crea operadores y les asigna módulos ("el
  módulo principal quedará excluido automáticamente"); identificación y rol NO son editables;
  credenciales temporales se envían por correo. Multi-tenant con administración delegada.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rol 1 crea y administra EMPRESAS de transporte (Priority: P1)

El administrador de plataforma entra a Configuración → Clientes/Empresas y crea una empresa:
datos (razón social, NIT, correo, vigencia de contrato), **token** (generado o digitado;
**MODIFICABLE** después) y **módulos que la empresa podrá usar**. Al crearla, el sistema crea el
usuario admin de empresa (rol 2) con clave temporal y **envía la credencial por correo** (Resend
tras interfaz; sin API key cae a stub/log). El token se guarda pero **NO se usa contra la Super en
Fase 1**.

**Acceptance Scenarios**:

1. **Given** rol 1 autenticado, **When** crea una empresa (razón social, NIT único, correo,
   vigencia, token, módulos ⊆ asignables D-018 con Usuarios incluido), **Then** se crean
   `ProveedorVigilado` + `Usuario` rol 2 (identificación=NIT, `usn_token_autorizado`=token,
   `claveTemporal=true`) + sus `UsuarioModulo`, y se envía la credencial al correo definido; 201.
   La unicidad del NIT la garantiza `usn_identificacion @unique` del admin de empresa (G3); el
   **token** de empresa se valida **único server-side** (no por índice, la columna es nullable — G2).
2. **Given** una empresa existente, **When** rol 1 **modifica el token**, **Then** se actualizan
   `tpv_token` y `usn_token_autorizado` del admin de empresa en conjunto (auditado); los operadores
   lo heredan (herencia rol 3 ya existente) sin tocar sus filas.
3. **Given** una empresa, **When** rol 1 edita datos/vigencia/módulos o la desactiva, **Then** la
   identificación (NIT) **NO es editable**; desactivar (`tpv_estado=false` + `usn_estado=false` del
   admin) bloquea el login de su gente sin borrar datos (aditivo, reversible).
4. **Given** un NIT o usuario ya existente, **When** intenta crearla, **Then** 409 sin efectos.
5. **Given** roles 2/3, **When** llaman cualquier endpoint de Configuración, **Then** 403
   (verifyAuth([1]) + guard del módulo `configuracion`).

---

### User Story 2 - Cascada de permisos: rol 2 crea sus usuarios y reparte qué hace cada uno (Priority: P1)

El admin de empresa (rol 2) entra con la credencial recibida (cambio de clave forzado ya
existente) y en Usuarios crea su equipo: otros admins de empresa y **operadores (rol 3)**, con
credencial por correo. A cada operador le asigna **qué hace**: módulos completos (unos
mantenimientos, otros alistamientos) y, dentro de mantenimientos, **submódulos**
(unos preventivos, otros correctivos) — usando `UsuarioModulo` + `Submodulo` existentes. La
cascada se valida **SERVER-SIDE**: nadie otorga lo que no tiene (D-015/D-017).

**Acceptance Scenarios**:

1. **Given** rol 2 autenticado, **When** crea un operador (nombre, identificación única, correo,
   módulos/submódulos ⊆ los suyos, **sin Usuarios** — §10.8), **Then** se crea rol 3 con
   `usn_administrador`=NIT de la empresa, clave temporal enviada por correo; 201.
2. **Given** un operador, **When** rol 2 reasigna sus módulos/submódulos, **Then** el cambio surte
   efecto en el guard en la siguiente petición (server-side); identificación y rol NO editables.
3. **Given** un operador con solo el submódulo `preventivos`, **When** llama un endpoint de
   correctivos, **Then** 403 (guard extendido a submódulo); con el módulo completo, opera ambos.
4. **Given** rol 2, **When** intenta asignar un módulo que su empresa no tiene, o el módulo
   Usuarios a un operador, **Then** 400/403 server-side (ignorando lo que mande el cliente).
7. **Given** un operador con submódulos sueltos de mantenimientos, **When** rol 2 le asigna el
   **módulo completo**, **Then** las filas de submódulo previas se **borran** en la misma
   transacción (y viceversa: asignar submódulos borra la fila de módulo completo). Por
   `(usuario, módulo)` existe **o una fila de módulo completo o N de submódulo, NUNCA ambas**
   (regla de exclusión B2, validada server-side).
5. **Given** rol 2, **When** lista/edita usuarios, **Then** solo ve los de SU empresa
   (`usn_administrador` = su NIT — D-015); rol 1 ve todas (desviación deliberada aprobada).
6. **Given** una clave nueva, **When** no cumple la política (mín 8, may/min/número/símbolo),
   **Then** 400 (política existente reutilizada).

---

### User Story 3 - Correo real por Resend tras la interfaz (Priority: P2, D-048)

Las credenciales (alta de empresa, alta de usuario, recuperar clave) salen por una **interfaz de
correo única**: con `RESEND_API_KEY` en `.env` envía real vía API HTTP de Resend; **sin la key cae
a stub/log** (comportamiento actual). La key la carga el CEO en `.env`; solo `.env.example` lleva
el nombre.

**Acceptance Scenarios**:

1. **Given** `RESEND_API_KEY` ausente, **When** se crea una empresa/usuario o se recupera clave,
   **Then** el flujo completa OK y el "correo" queda en log de stub (nunca falla por falta de key).
2. **Given** la key presente, **When** se envía, **Then** sale por Resend (API HTTP, no SMTP) y el
   resultado (id/aceptado o error) se registra sin exponer la key ni la clave temporal en logs.
3. **Given** un fallo de Resend, **When** se crea el usuario, **Then** el alta NO se revierte: se
   informa que el correo falló y el rol 1/2 puede reenviar la credencial (regenera temporal).

### Edge Cases

- Token de empresa duplicado → 409 (tpv_token debe ser único operativamente).
- Reenvío de credencial: regenera clave temporal (nunca se reenvía la anterior; no se almacena en claro).
- Cambio de token con operadores activos → siguen heredando el nuevo (join por NIT, sin fila propia).
- Empresa desactivada → login 401/403 de todo su personal; reactivable sin pérdida.
- Correo inválido → 400 antes de crear nada.
- Rol 2 intenta editar un usuario de otra empresa → 404 (alcance D-015, sin fuga de existencia).

## Requirements *(mandatory)*

- **FR-001**: Módulo `configuracion` (catálogo D-018 ampliado; solo rol 1) con submódulos
  Clientes/Empresas y APIs (013); Usuarios ya existe en el catálogo y gana su pantalla. Los módulos
  y submódulos se siembran y **resuelven por NOMBRE** (`configuracion`, `usuarios`, `empresas`,
  `apis`, …); **nunca por id** (los ids son `serial`, no garantizados).
- **FR-002**: CRUD de empresas sobre `ProveedorVigilado` + `Usuario` rol 2 enlazados por NIT
  (join lógico existente): crear (con token asignable), editar (NIT NO editable), **modificar
  token** (sincroniza `tpv_token` y `usn_token_autorizado`), activar/desactivar. Sin borrado físico.
- **FR-003**: Asignación de módulos por empresa vía `UsuarioModulo` del admin de empresa
  (lo personalizado ya prevalece sobre el rol en `cargarModulos`); la cascada a operadores es un
  SUBCONJUNTO validado server-side.
- **FR-004**: Gestión de usuarios en cascada (rol 2 → sus rol 2/3 con `usn_administrador`=NIT):
  crear/editar/activar con identificación y rol NO editables; alcance D-015 server-side.
- **FR-005**: Granularidad por submódulo REUSANDO el esquema: seed de `Submodulo` (p. ej.
  `preventivos`/`correctivos` bajo `mantenimientos`) y **columna ADITIVA** `usm_submodulo_id`
  (nullable; null = módulo completo) en `tbl_usuarios_modulos` — sin tablas nuevas. Guard D-017
  extendido: `requiereModulo(usuario, modulo, submodulo?)` aplicado a los endpoints ya existentes
  de preventivo/correctivo.
- **FR-006**: Credenciales por correo (alta empresa, alta usuario, reenviar, recuperar) por la
  interfaz única de correo; clave temporal cumple la política y fuerza cambio al primer ingreso
  (mecanismo existente).
- **FR-007 (D-048)**: Adaptador Resend (API HTTP) tras la interfaz; sin `RESEND_API_KEY` → stub/log;
  la key JAMÁS en repo/código/logs; `.env.example` solo con el nombre.
- **FR-008 (Fase 1)**: El token de empresa se guarda/modifica pero **ningún flujo de esta spec
  llama a la Super** (doble gate apagado; regla CEO AGENTS §6).
- **FR-009**: Migraciones ADITIVAS (columna `usm_submodulo_id`, seeds de módulos/submódulos);
  `--create-only` + revisión de SQL; tests para todo endpoint/función nueva y suite previa verde.

### Key Entities

Reusa: `ProveedorVigilado` (empresa+token), `Usuario` (roles/cascada por `usn_administrador`),
`Modulo`/`Submodulo`/`Funcionalidad`/`RolModuloFuncionalidad`/`UsuarioModulo` (permisos).
Aditivo: `usm_submodulo_id` (nullable) + seeds. Nada más.

## Success Criteria

- **SC-1**: Rol 1 crea una empresa completa (token+módulos+credencial por correo-stub) en < 2 min;
  el admin de empresa entra con la temporal y el cambio forzado funciona.
- **SC-2**: Un operador con solo `preventivos` recibe 403 en correctivos (server-side) y 200 en
  preventivos; reasignar surte efecto sin redeploy.
- **SC-3**: Nadie fuera de rol 1 alcanza Configuración; rol 2 jamás ve/edita usuarios de otro NIT.
- **SC-4**: Con y sin `RESEND_API_KEY` los flujos completan; cero secretos en repo/logs.
- **SC-5**: Cero llamadas a `*.supertransporte.gov.co` (Fase 1); suite previa (127) + nuevos verdes.

## Fuera de alcance (Fase 1 / otras specs)

- Uso del token contra la Super (Fase 2). Operaciones de 006 (alistamientos), 007 (autorizaciones)
  y 008 (novedades): aquí solo entran sus **módulos/submódulos como catálogo asignable** (seed) —
  las pantallas y flujos de esas operaciones NO. Funcionalidades finas por `RolModuloFuncionalidad`
  más allá del seed base. PDF/archivos de empresa (`tpv_ruta` se conserva tal cual).

## Assumptions

- "Credencial" = usuario + clave temporal (política vigente) — nunca el token de empresa por correo.
- El módulo Configuración es NUEVO en el catálogo (aditivo al seed D-018); Usuarios (módulo
  `usuarios`, resuelto por nombre) obtiene pantalla dentro de Configuración para rol 1 y en el
  dashboard para rol 2 según cascada §10.8. Ningún id serial se hardcodea (I1).
- Plantillas de correo mínimas (texto plano con marca SICOV-OTPC); diseño HTML queda para pulido.
