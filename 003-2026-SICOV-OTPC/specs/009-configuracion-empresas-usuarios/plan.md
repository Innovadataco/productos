# Implementation Plan — 009-configuracion-empresas-usuarios

**Branch**: `feature/001-scaffolding` · **Date**: 2026-07-23 · **Spec**: [spec.md](./spec.md)

**Status**: PLANEADO — **MODO PLAN: gate de ZEUS antes de implementar** (Fase 1 D-047,
API-independiente; regla CEO AGENTS §6 vigente: cero Super)

## 1. Resumen técnico

Módulo Configuración (rol 1) + cascada de usuarios (rol 2), 100% contra BD local. **Cero entidades
nuevas**: empresa+token = `ProveedorVigilado`⇄`Usuario` rol 2 por join lógico NIT (ya usado por
`validarContratoVigente`); permisos = `UsuarioModulo`+`Submodulo` existentes con UNA columna
aditiva (`usm_submodulo_id`). Correo por interfaz única con adaptador Resend (D-048) y caída a
stub sin key. El guard D-017 se extiende a submódulo y se aplica a las rutas ya existentes de
preventivo/correctivo.

## 2. Modelo de datos (contra el esquema ACTUAL — abierto, no inventado)

### Empresa + token (SIN cambios de esquema)

| Concepto | Dónde vive HOY | Uso en 009 |
|---|---|---|
| Empresa (razón social, NIT, contrato, estado) | `ProveedorVigilado`: `tpv_empresa`, `tpv_documento`, `tpv_fecha_inicial/final`, `tpv_estado` | CRUD rol 1 (NIT inmutable; desactivación lógica) |
| **Token de empresa** | `tpv_token` (uuid) **ya existe** | Asignable y **MODIFICABLE** en UI; al cambiar se sincroniza con `usn_token_autorizado` del admin de empresa (transacción). NO se usa contra la Super (Fase 1) |
| Admin de empresa (rol 2) | `Usuario` con `usn_identificacion = tpv_documento`, `usn_token_autorizado`, `usn_clave_temporal` | Creado junto a la empresa; credencial por correo |
| Operadores (rol 3) | `Usuario` con `usn_administrador = NIT` (join lógico existente; heredan token/NIT — contexto-usuario.ts) | Creados por rol 2 |
| Módulos de la empresa | `UsuarioModulo` del admin (personalizado > rol, ya implementado en `cargarModulos`) | Set otorgado por rol 1; techo de la cascada |

### Cascada granular (UNA columna aditiva, cero tablas nuevas)

```prisma
model UsuarioModulo {
  ...campos actuales...
  submoduloId Int? @map("usm_submodulo_id")   // ADITIVA, nullable: null = módulo completo
  submodulo   Submodulo? @relation(...)
  // NO se usa @@unique de Prisma: el unique de (usuarioId, moduloId, submoduloId) NO garantiza
  // la unicidad del "módulo completo" porque en PostgreSQL dos filas (u, m, NULL) se consideran
  // DISTINTAS entre sí. La unicidad se declara con DOS índices únicos PARCIALES en la migración
  // SQL editada a mano (ver §Justificación). Prisma solo modela la columna + FK.
}
```

**B1 — unicidad por índices únicos PARCIALES (NO `@@unique`).** El unique actual
`(usuarioId, moduloId)` se retira; en su lugar la migración SQL crea dos índices parciales que
sí garantizan "una sola fila de módulo completo por usuario" (los `NULL` en un índice único de
PostgreSQL son distintos entre sí, así que un unique de 3 columnas admitiría dos filas
`(u, m, NULL)` — inaceptable):

```sql
CREATE UNIQUE INDEX ux_usmod_completo   ON sicov.tbl_usuarios_modulos (usm_usuario_id, usm_modulo_id)                    WHERE usm_submodulo_id IS NULL;
CREATE UNIQUE INDEX ux_usmod_submodulo  ON sicov.tbl_usuarios_modulos (usm_usuario_id, usm_modulo_id, usm_submodulo_id) WHERE usm_submodulo_id IS NOT NULL;
```

Alternativa `UNIQUE NULLS NOT DISTINCT` descartada por dependencia de versión (solo si se
confirma Prisma 5.22 + PG16); los parciales son la vía segura e independiente de versión.

- Semántica: fila (usuario, mantenimientos, NULL) = todo el módulo; (usuario, mantenimientos,
  preventivos) = solo ese submódulo. `cargarModulos` no cambia (sigue proyectando módulos);
  se añade `cargarSubmodulos(usuarioId)` para el guard y el menú.
- **B2 — exclusión completo ↔ submódulo (regla server-side, no solo índice):** por
  `(usuario, módulo)` existe **o una única fila NULL (módulo completo) o N filas de submódulo,
  NUNCA ambas**. Al asignar "módulo completo" el servicio borra las filas de submódulo de ese
  módulo; al asignar submódulos borra la fila NULL — todo en la MISMA transacción. Los índices
  parciales no impiden la coexistencia completo↔submódulo, así que la exclusión se valida y
  materializa server-side (ver §4 y §5); sin ella la semántica del guard es ambigua.
- **Seed aditivo** de `Submodulo`: `preventivos`/`correctivos` bajo `mantenimientos` (los de
  006/007/008 se siembran como catálogo asignable SIN pantalla: `alistamiento-diario`,
  `autorizaciones-nna`, `novedades-*` — solo nombres, cero lógica).
- Módulo nuevo en catálogo: `configuracion` (solo rol 1) con submódulos `empresas`, `apis`
  (spec 013); `usuarios` gana pantalla. **NO se hardcodea el id** (los ids son `serial`): se
  siembra por NOMBRE (`configuracion`) y se resuelve por nombre en el seed, el guard y el menú.
- `Funcionalidad`/`RolModuloFuncionalidad`: se conservan tal cual (techo por ROL futuro); esta
  spec no las puebla más allá de lo existente — declarado en spec como fuera de alcance.

### Justificación de la única migración

`ALTER TABLE tbl_usuarios_modulos ADD COLUMN usm_submodulo_id INT NULL` + FK a `tbl_submodulos`.
Aditiva, `--create-only` + **revisión manual obligatoria del SQL** (gate B1). En la MISMA migración
revisada: `DROP` del unique viejo `(usm_usuario_id, usm_modulo_id)` y `CREATE` de los dos índices
únicos PARCIALES de B1 (completo con `WHERE submodulo IS NULL`, submódulo con `WHERE submodulo IS
NOT NULL`). Sin tocar datos. Alternativa descartada: tabla puente nueva (prohibida por el encargo
y redundante).

## 3. Correo (D-048) — interfaz + adaptador Resend

```
src/lib/correo/
├── correo.ts        # interfaz: enviarCorreo({para, asunto, texto}): Promise<ResultadoEnvio>
│                    #   factory: con RESEND_API_KEY → AdaptadorResend; sin ella → AdaptadorStub
├── resend.ts        # adaptador API HTTP de Resend (POST https://api.resend.com/emails,
│                    #   Authorization: Bearer <key>; SDK opcional — se prefiere fetch: cero deps)
└── stub.ts          # log "[correo][stub] para=<...> asunto=<...>" (SIN clave temporal en el log)
```

- `api/auth/recuperar` se refactoriza para usar la interfaz (hoy stub inline) — mismo contrato.
- Sin key: los flujos SIEMPRE completan (el alta no depende del correo); fallo de Resend → el alta
  persiste + aviso + acción "reenviar credencial" (regenera temporal).
- `.env.example`: `RESEND_API_KEY=""` + `CORREO_REMITENTE="SICOV-OTPC <onboarding@resend.dev>"`.
  La key la carga el CEO; nunca en repo/código/logs (ni el cuerpo con la clave temporal se loguea).
- Test: adaptador stub (contrato), factory (con/sin key), Resend con fetch mockeado (cero red).

## 4. Endpoints (todos verifyAuth + guard `configuracion` o alcance D-015)

```
# Empresas (rol 1)
POST   /api/configuracion/empresas            # crea ProveedorVigilado + Usuario rol 2 + módulos + correo
GET    /api/configuracion/empresas            # listado paginado
GET    /api/configuracion/empresas/[nit]      # detalle (sin exponer clave; token visible solo rol 1)
PATCH  /api/configuracion/empresas/[nit]      # datos/vigencia/estado/módulos (NIT y rol inmutables)
PATCH  /api/configuracion/empresas/[nit]/token    # modifica token (sincroniza usuario admin)
POST   /api/configuracion/empresas/[nit]/reenviar-credencial

# Usuarios en cascada (rol 1 ve todo; rol 2 SOLO su NIT — D-015 server-side)
POST   /api/usuarios                          # crea rol 2/3 de MI empresa (subconjunto de MIS módulos, sin Usuarios para rol 3 — §10.8)
GET    /api/usuarios                          # listado del alcance
PATCH  /api/usuarios/[id]                     # nombre/correo/estado/módulos+submódulos (identificación y rol NO)
POST   /api/usuarios/[id]/reenviar-credencial
```

Reglas server-side: subconjunto validado contra `cargarModulos/Submodulos` del OTORGANTE (no del
payload); rol 2 no toca usuarios con `usn_administrador != su NIT` (404); política de clave
reutilizada; transacciones para empresa+usuario+módulos.

- **B2 (server-side) al asignar módulos/submódulos:** dentro de la transacción, por cada
  `(usuario, módulo)` afectado se materializa la exclusión — "módulo completo" ⇒ borra las filas
  de submódulo de ese módulo; "submódulos" ⇒ borra la fila NULL. Nunca coexisten completo y
  submódulo (los índices parciales de B1 no lo impiden; lo garantiza este servicio).
- **El envío de correo va FUERA de la transacción de alta.** La transacción persiste
  empresa+usuario+módulos y hace COMMIT; solo DESPUÉS se invoca la interfaz de correo. Un fallo de
  Resend (o la ausencia de key) **nunca revierte** la creación — el alta queda firme y se ofrece
  "reenviar credencial". El correo no participa jamás de la transacción de datos.

## 5. Guard extendido (reusa 005-A)

`requiereModulo(usuario, modulo, submodulo?)`: si el usuario tiene fila NULL (módulo completo) →
pasa; si tiene filas por submódulo → exige el pedido. La exclusión completo↔submódulo (B2) hace
que esta decisión sea inequívoca: nunca hay a la vez fila NULL y filas de submódulo para el mismo
`(usuario, módulo)`. Se aplica: rutas de mantenimientos preventivo→
`("mantenimientos","preventivos")`, correctivo→`("mantenimientos","correctivos")` (bulk incluidos);
rutas de configuración → `("configuracion", "empresas"|"apis")`. Tests de matriz (módulo completo /
solo submódulo / sin nada).

## 6. UI (hereda breadcrumb del layout — I-14)

`/dashboard/configuracion` (rol 1): tarjetas Empresas y APIs (013). `/dashboard/configuracion/
empresas`: tabla + modal crear/editar + modal token + reenviar credencial. `/dashboard/usuarios`
(rol 1 y 2): tabla del alcance + modal crear/editar con selector módulos→submódulos (checkboxes
anidados limitados al set del otorgante, servido por la API — nunca calculado en cliente).

## 7. Qué NO entra (explícito)

- **Nada de Super/Fase 2**: el token solo se persiste; cero uso del cliente real (gate apagado).
- **006/007/008**: solo sus submódulos como CATÁLOGO seed asignable; ni pantallas ni endpoints ni
  colas de esas operaciones.
- Funcionalidades finas (`RolModuloFuncionalidad`) más allá del estado actual; SMTP crudo;
  verificación de dominio de correo (usa remitente de pruebas de Resend hasta que el CEO configure
  dominio).

## 8. Fases de implementación (post-aprobación)

1. **Datos**: migración aditiva (`usm_submodulo_id` + FK + DROP unique viejo + 2 índices únicos
   PARCIALES de B1) + seeds por NOMBRE (submódulos, módulo `configuracion`, funcionalidades base)
   — `--create-only` + **revisión manual del SQL** + pg_dump previo.
2. **Correo**: interfaz + adaptadores + refactor de recuperar + tests (US3, commit propio).
3. **US1 empresas**: servicio + endpoints + UI + tests (commit `feat(003-US1-009)`).
4. **US2 cascada**: servicio usuarios + guard extendido aplicado a preventivo/correctivo + UI +
   tests de matriz (commit).
5. **Verificación**: suite previa (127) + nuevos; tsc/lint/build; navegador en ventana privada
   (crear empresa → login con temporal → crear operador solo-preventivos → 403 en correctivos);
   staging explícito por commit (AGENTS §6).

## 9. Riesgos

- Cambio del unique de `tbl_usuarios_modulos` a **dos índices parciales** (B1): único DDL
  no-trivial — revisión manual del SQL obligatoria en el gate de la migración.
- Exclusión completo↔submódulo (B2): garantizada server-side, no por índice — test dedicado que
  verifica que asignar completo purga los submódulos y viceversa.
- Sincronía token empresa⇄usuario admin: transacción única + test dedicado (evitar divergencia).
- Enumeración de usuarios entre empresas: respuestas 404 uniformes (D-015).
- Resend sin dominio verificado: usar remitente sandbox de Resend hasta decisión del CEO
  (documentado; el fallo de envío nunca bloquea el alta).

---

**⛔ DETENIDO (MODO PLAN).** Tras aprobación: `/speckit.tasks` → `/speckit.analyze` → implementación
junto a la spec 013 (comparten fase de datos y UI de Configuración).
