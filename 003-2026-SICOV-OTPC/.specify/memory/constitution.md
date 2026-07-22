# SPECKIT CONSTITUTION — 003-2026-SICOV-OTPC

> **Versión:** 1.0.0
> **Fecha:** 2026-07-21
> **Producto:** SICOV-OTPC — Operación de Transporte de Pasajeros por Carreteras (rediseño de Gesmovil / SICOV)
> **Stack:** Next.js 16 (App Router) + React 19 + Prisma + PostgreSQL 16+ + TypeScript 5.x
> **Runtime:** Node.js >=22
> **Módulos del dominio:** Autenticación/Usuarios, Despachos (salidas), Llegadas, Mantenimientos, Novedades, Soportes, Proveedores vigilados, Consulta integradora
> **Arquitectura API:** Next.js App Router API Routes (no PostgREST, no tRPC, no GraphQL)
> **Integración regulatoria:** reporte a la Superintendencia de Transporte (SICOV) con esquema de **doble token**

---

## 0. PROPÓSITO Y ALCANCE DEL PRODUCTO

**SICOV-OTPC** es el rediseño del sistema **Gesmovil / SICOV**: la plataforma con la que un **proveedor autorizado** (Gesmovil) y las **empresas de transporte vigiladas** gestionan la **Operación de Transporte de Pasajeros por Carreteras** —despachos (salidas), llegadas, mantenimientos, novedades y proveedores— y **reportan e interoperan** con la Superintendencia de Transporte.

**Actores/roles (numéricos, heredados del sistema real):**

| Rol | Nombre | Alcance |
|-----|--------|---------|
| **1** | Administrador | Gestión global del proveedor y de vigilados |
| **2** | Cliente / empresa vigilada | Opera su propia empresa de transporte (el "vigilado") |
| **3** | Operador / subusuario | Subusuario de un vigilado; **hereda** el token autorizado y NIT de su administrador (`usn_administrador → usn_identificacion`) |

> **Nota (verificado 2026-07-21):** el sistema legacy real solo implementa roles **1/2/3** (más 5/7 en flujos PESV/Vigía, fuera de alcance). El "rol 9 = ve todas las placas" que menciona `HANDOFF-SICOV.md` **no existe en el código**; por decisión del responsable (opción A) el 003 implementa solo 1/2/3.

> **Nota (verificado 2026-07-22):** el canal vigía (`api/v2/*` + `POST /api/v1/autenticacion/inicio-vigia`) existe **VIVO** en el backend legacy. Su reemplazo o eliminación en el 003 es **decisión pendiente del CEO (D-005)**; el MVP **no lo construye**.

**Límite fundamental:** la plataforma es un **canal de reporte e interoperación** hacia la Super; **no reemplaza** la responsabilidad legal del vigilado ni la vigencia de sus documentos (SOAT, RTM, pólizas, licencias). La "consulta integradora" **verifica en vivo** contra SICOV; el sistema no inventa ni cachea veredictos de habilitación.

> El detalle de dominio, integración y modelo de datos vive en `HANDOFF-SICOV.md` (traspaso del sistema real: backend AdonisJS 5 + frontend Angular 20). Es insumo obligatorio de todo `spec.md` y `data-model.md`.

---

## 1. PRINCIPIOS INNEGOCIABLES

Estos cinco principios están **por encima de cualquier consideración de conveniencia técnica**. Ninguna feature se cierra si los viola.

### 1.1 Aislamiento de infraestructura por proyecto (Docker)
El 003 **crea y usa exclusivamente su propia infraestructura**, con prefijo `003-`:
- Contenedor de BD **`003-2026-sicov-otpc-db-1`**, puerto host **5434 → 5432** interno.
- Volumen propio **`003-2026-sicov-otpc_db_data`**, con **`mem_limit`** declarado en el compose desde el día 1.
- Puerto de aplicación propio **5010**. **Verificar `lsof -i :5010` y `lsof -i :5434` antes de levantar.**
- Ollama es **compartido** en `:11434` (solo lectura; `ollama pull` permitido, **nunca** `ollama rm`).

**🚫 Prohibido tocar 001/002:** contenedores `001-2026-innovadataco-db-1` (:5432) y `002-2026-proteccion-infantil-db-1` (:5433), sus volúmenes, sus puertos (`5000,5001,5005,5006,5432,5433,7000,11434`), ni sus modelos Ollama. Prohibidos `docker stop/rm/restart` sobre 001/002, `docker volume rm` ajenos, `docker system prune`, `ollama rm`.

> **Deuda registrada:** el `docker-compose.yml` actual del scaffold usa `postgres` en **puerto 5432** (colisiona con 001), sin prefijo `003-` ni `mem_limit`. **Debe corregirse** (puerto 5434, nombres/volumen `003-*`, `mem_limit`) antes de cualquier `docker compose up`. Es tarea explícita de la primera feature de infraestructura.

### 1.2 Migraciones aditivas y no destructivas
- **Nunca** `prisma migrate reset` ni ninguna operación que borre datos.
- Los cambios de esquema son **aditivos** (columnas/tablas nuevas, `nullable` o con `default`); las remociones se hacen en dos fases (deprecate → drop) y **nunca** sobre datos vivos sin respaldo.
- **`pg_dump` de respaldo** antes de tocar seed o datos.
- El esquema objetivo es **`sicov`** en PostgreSQL (**27 tablas** del sistema real —29 migraciones, 2 son ALTER—; mapear columnas exactas desde las migraciones del legacy y `HANDOFF-SICOV.md` §9 al construir `data-model.md`).

### 1.3 Secretos por variables de entorno — nunca en el repo
- Todo secreto va en `.env` **local**; `.env` está en `.gitignore`; se commitea únicamente `.env.example` sin valores reales.
- **El repositorio es público:** jamás se commitean credenciales de Supertransporte (`EXTERNAL_APP_USER`, `EXTERNAL_APP_PASSWORD`, `TOKEN`, `TOKEN_PARAMETRICO`, tokens de vigilado, `DATABASE_URL` con clave).
- Ningún log, test fixture, seed ni mensaje de error imprime secretos.

### 1.4 Doble token proveedor + vigilado (reporte a Supertransporte)
Toda petición transaccional a la Super lleva **tres cabeceras** (nada de atajos ni un solo token):

| Header | Qué es | Origen |
|--------|--------|--------|
| `Authorization: Bearer <tokenExterno>` | **Token de proveedor** (Gesmovil) | Autenticación proveedor con `EXTERNAL_APP_USER` + `EXTERNAL_APP_PASSWORD`; **cacheado con vigencia y auto-refresh** |
| `token: <tokenAutorizado>` | **Token del vigilado** | Campo `usn_token_autorizado` del usuario; el **subusuario (rol 3) hereda** el del administrador |
| `documento: <nitVigilado>` | NIT del vigilado | Identificación del usuario (o del admin, si es subusuario) |

- **Login único usuario/contraseña** → devuelve `token` (JWT interno de la app) y `tokenExterno` (API integradora); el legacy devuelve además **`tokenParametrica`** (paramétricas) — incluirlo si el 003 consume paramétricas. El frontend del 003 **no implementa** login por token de "vigía"; el canal vigía del backend legacy está **VIVO** y queda sujeto a **D-005** (ver nota en §0).
- El token de proveedor **se cachea con vigencia y auto-refresh** (requisito del 003 — el legacy real nunca seteaba expiración; **validar el TTL real** del token de la Super en modo real).
- Middleware de validación de proveedor: **token + NIT + contrato vigente** (`tpv_fecha_inicial`/`tpv_fecha_final`); petición fuera de vigencia **se rechaza**.
- Mientras no haya credenciales reales, la integración vive **tras una interfaz con stubs**; el contrato de las 3 cabeceras se respeta igual en los stubs.

### 1.5 Las 5 reglas de oro (ninguna se salta al cerrar un spec)
1. **Spec-Kit completo** — `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `checklists/`, `tasks.md` + checklist validado.
2. **Subir al repo** — un commit por User Story + uno de documentación, con evidencia (`git log` + archivos tocados) y push a la rama de trabajo. Sin **ACTA-VALIDACIÓN no hay merge**.
3. **Desplegar limpio** — script de reinicio que **borra el build viejo**, levanta la app y verifica el healthcheck. **Un solo** proceso/worker (matar el viejo antes del nuevo).
4. **Probar** — `quickstart.md` + `tsc --noEmit` + `lint` + `test` + `build`; los tests existentes siguen verdes.
5. **Documentar** — `cierre.md` + sección Implementación en `spec.md` + deuda técnica.

> En una línea: **spec completo → commiteado con evidencia → desplegado limpio → probado → documentado.**

---

## 2. PRINCIPIOS TÉCNICOS

### 2.1 Stack (estándar de la Fábrica de Software, alineado con 001/002)
| Capa | Tecnología | Política |
|------|-----------|----------|
| Framework | **Next.js 16** (App Router) | API Routes exclusivos; no PostgREST, no GraphQL, no tRPC |
| UI | **React 19** + TypeScript 5.x | Server Components por defecto; `"use client"` solo donde haga falta |
| ORM | **Prisma** | PostgreSQL obligatorio (esquema `sicov`); raw SQL solo en migraciones manuales |
| Autenticación | **JWT manual** (`jose` + `bcryptjs`) | Cookie `httpOnly`; sin NextAuth/Auth.js; login único usuario/contraseña |
| Colas asíncronas | **Worker Node independiente** (BullMQ+Redis o `pg-boss`) | Despachos/llegadas/mantenimientos como **workers separados** del server web, con estados y reintentos |
| Cliente HTTP externo | Capa de integración propia con **stubs** tras interfaz | Doble token (§1.4); normalización tolerante de respuestas |
| Testing | **Vitest** | Todo endpoint/función nueva con su `.test.ts` |
| Estilo | ESLint (`eslint-config-next`) | — |

> **Decisión de stack (confirmada 2026-07-21):** se **porta a Next.js 16 + Prisma + PostgreSQL**. El scaffold demo (React+Vite + NestJS + Prisma SQLite) se reemplaza; la lógica de dominio/integración es reaprovechable (~90%).

### 2.2 Integración Supertransporte (endpoints)
- `URL_DESPACHOS/despachosempresa`, llegadas, `URL_INTEGRADORA/api-integradora/resumen`, paramétricas (con `TOKEN_PARAMETRICO`) y GET con token estático (`TOKEN`).
- La **consulta integradora** verifica en vivo licencia, SOAT, RTM, pólizas, alcoholimetría y tarjeta de operación de conductor+vehículo. Se usa en dashboard, wizard de salidas y novedades.
- **Normalización tolerante** de respuestas externas: aceptar `array_data | data | obj` y claves `snake_case`/`camelCase` sin romper.
- Fechas en zona **`America/Bogota`**.

### 2.3 Colas como workers independientes
El sistema real usa **workers separados** (no `setInterval` en el proceso web). El flujo canónico de despacho:
1. API recibe la solicitud → guarda en `tbl_despachos_solicitudes` (`des_sol_procesado = false`) → encola.
2. **Worker independiente** consume la cola, arma las 3 cabeceras (§1.4) y hace **un solo POST** al endpoint externo.
3. Persiste `des_sol_id_despacho_externo`, `des_sol_respuesta_externa` o `des_sol_error_externo`; marca `des_sol_procesado`.
4. Reintentos con backoff; **el reintento debe resetear el contador correctamente** (bug del demo a corregir).
5. Un solo worker vivo a la vez (matar el anterior antes de levantar).

---

## 3. CALIDAD DE CÓDIGO

### 3.1 TypeScript — reglas no negociables (`"strict": true`)
| Prohibido | Obligatorio |
|-----------|-------------|
| `any` como anotación | `unknown` + type guard (`catch (err: unknown)`) |
| `as any` para silenciar | narrowing correcto o `as const` |
| `// @ts-ignore` | `// @ts-expect-error` con justificación |
| `let` no reasignado | `const` siempre que sea posible |

**Patrón estándar de error en API:**
```typescript
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : "Error desconocido";
  console.error("[Modulo] Error en operacion:", message);
  return NextResponse.json(
    { error: "Descripcion legible", details: message },
    { status: 500 }
  );
}
```

### 3.2 Convenciones de nombres
| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Rutas API | `route.ts` | `src/app/api/integracion/despachos/route.ts` |
| Páginas | `page.tsx` | `src/app/despachos/page.tsx` |
| Componentes | PascalCase | `DespachoWizard.tsx` |
| Hooks | `use` + PascalCase | `useAuth.ts` |
| Utilidades | camelCase | `clienteSupertransporte.ts` |
| Constantes | SCREAMING_SNAKE_CASE | `MAX_PDF_MB` |
| Modelos Prisma | PascalCase singular con `@@map` | `Usuario` → `@@map("tbl_usuarios")` |
| Tablas BD | esquema `sicov`, snake_case real | `tbl_usuarios`, `tbl_despachos_solicitudes` |

### 3.3 Códigos de estado en API
`400` input inválido · `401` no autenticado · `403` sin permiso (rol) · `404` no encontrado · `409` conflicto · `413` payload grande (PDF alistamiento ≤4MB) · `429` rate limit · `500` interno · `502` upstream Super falló · `503` integración no disponible. **Nunca** retornar stack traces al cliente; solo a logs del servidor. Nunca loguear secretos ni tokens.

---

## 4. ARQUITECTURA Y PERSISTENCIA

### 4.1 Singleton de recursos costosos
`PrismaClient` (y el cliente de cola) se inicializan como singletons (patrón `globalThis` en `src/lib/prisma.ts`), igual que en 001/002.

### 4.2 Modelo de datos (esquema `sicov`)
- Mapear las **27 tablas reales** desde las migraciones del sistema real / `HANDOFF-SICOV.md` §9 al construir `data-model.md`. No inventar tablas ni pantallas: en el frontend legacy **no existen pantallas** de "Terminales" ni "CRUD de empresas" (las rutas del wizard salen de maestras) — el demo las inventó como UI y se retiran. **SÍ existen** como módulos backend máquina-a-máquina (Terminales, Empresas/Proveedores vigilados, Soportes), sin UI, sujetos a **D-005**; el MVP no los construye.
- Columnas clave confirmadas: `tbl_usuarios` (`usn_id`, `usn_usuario` unique, `usn_clave` bcrypt, `usn_clave_temporal`, `usn_token_autorizado`, `usn_rol_id`, `usn_administrador`, `usn_estado`), `tbl_proveedores_vigilados` (`tpv_token`, `tpv_fecha_inicial/final`, `tpv_documento`), `tbl_despachos_solicitudes` (cola).
- `@@index` en toda foreign key y campo de búsqueda frecuente. IDs según el esquema real.

### 4.3 Paginación estándar
Toda lista que pueda crecer (llegadas, logs de cola, despachos) usa **paginación server-side** (`page`/`pageSize`, `DEFAULT_PAGE_SIZE=25`, `MAX_PAGE_SIZE=100`) con `findMany` + `count` en `Promise.all`.

### 4.4 Cargas masivas y archivos
- Excel/XLSX (mantenimientos) **100% server-side**: endpoints `bulk/*/xlsx` + descarga de plantilla + reporte de errores.
- PDF de programa de alistamiento **≤ 4 MB** (`413` si excede).

---

## 5. TESTING

| Nivel | Herramienta | Ubicación | Objetivo |
|-------|-------------|-----------|----------|
| Unitario | Vitest | `src/lib/*.test.ts` | funciones puras (armado de cabeceras, normalización, validaciones) |
| Integración API | Vitest + `Request` nativo | `src/app/api/**/route.test.ts` | todos los endpoints |
| Integración externa | Vitest contra **stubs** | `src/lib/integracion/*.test.ts` | doble token, refresh de token, contrato vigente |

- Todo endpoint/función nuevo se mergea **con su `.test.ts`**; los existentes siguen verdes.
- Probar en vivo con `quickstart.md`: lo que pasa los tests puede fallar en vivo.

---

## 6. SEGURIDAD

### 6.1 Autenticación y autorización
- Login único usuario/contraseña; `usn_clave` con **bcrypt**; `usn_clave_temporal` fuerza cambio en el primer ingreso.
- JWT interno en cookie `httpOnly`; `tokenExterno` para la integradora (no se expone al cliente sin necesidad).
- Autorización **por rol** (1/2/3) y por módulo (menú lateral data-driven según módulos del usuario).
- Subusuario (rol 3) **hereda** el token autorizado y el NIT del administrador; nunca genera los suyos.

### 6.2 Secretos y datos
- Ver §1.3. Credenciales de Supertransporte solo en `.env` local; nunca en repo, logs ni tests.
- Respaldo (`pg_dump`) antes de tocar datos; migraciones aditivas (§1.2).

### 6.3 Bugs del demo a corregir (heredados)
1. Reintento de cola **no resetea** `reintentos` (queda atascado).
2. Botón "Reintentar" **sin handler**.
3. Login demo **enmascara errores 5xx** del backend.
4. `useRecurso` muestra datos demo ante **401** (sesión expirada) — debe forzar re-login.
5. KPI "Despachos hoy" cuenta todo **sin filtrar por fecha**.

---

## 7. PROCESO DE DESARROLLO

### 7.1 Metodología Spec-Kit (obligatoria por feature)
`constitution → specify → clarify → plan → tasks → analyze → implement → validate → close`.
Cada feature vive en `specs/NNN-nombre/` con el set completo de artefactos. **Estados canónicos:** `PLANEADO → DESARROLLO → IMPLEMENTADO → PENDIENTE DE PRUEBA → FINALIZADO → CERRADA`.
**Gate de plan:** en features sensibles/grandes, entregar `plan.md` y **DETENERSE para revisión humana** antes de implementar.

### 7.2 Repositorio y ramas
- Monorepo `Innovadataco/productos`, carpeta `003-2026-SICOV-OTPC/`.
- Rama de trabajo de esta sesión: **`feature/001-scaffolding`** (AGENTS.md §4 nombra `feature/003-sicov-otpc-scaffolding`; alinear según indique el responsable).
- Flujo: rama de trabajo → **PR** → revisión (ODIN) / líder (ZEUS) → `main`. Sin ACTA-VALIDACIÓN no hay merge. Nunca subir secretos.
- Commits: `feat(003-USx): …`, `fix(003): …`, `docs(003): …`, `test(003): …`. Un commit por User Story; no mezclar features.
- **Un agente por proyecto/rama** para evitar conflictos de git.

### 7.3 Antes de commit
`npm run lint` (0 errores) · `npx tsc --noEmit` · `npx vitest run` (verde) · `npm run build` (compila) · `rm -rf .next` antes de confiar en un build.

---

## 8. GLOSARIO

| Término | Significado |
|---------|-------------|
| **OTPC** | Operación de Transporte de Pasajeros por Carreteras (dominio del producto) |
| **SICOV** | Sistema de la Superintendencia de Transporte con el que se interopera y reporta |
| **Vigilado** | La **empresa de transporte** supervisada; su NIT y token autorizado identifican sus reportes |
| **Proveedor** | Gesmovil, autorizado por la Super; aporta el `tokenExterno` (Bearer) cacheado |
| **Doble token** | Esquema de 3 cabeceras: token de proveedor (Bearer) + token del vigilado + NIT (§1.4) |
| **Consulta integradora** | Verificación en vivo contra SICOV de licencia, SOAT, RTM, pólizas, alcoholimetría, tarjeta de operación |
| **Despacho / salida** | Registro de una salida de vehículo; se encola y reporta a la Super con un solo POST |
| **Worker** | Proceso Node independiente que consume la cola de despachos/llegadas/mantenimientos |
| **Subusuario** | Usuario rol 3 que hereda token autorizado y NIT de su administrador (rol 2) |

---

## 9. HISTORIAL DE CAMBIOS

| Versión | Fecha | Autor | Cambio |
|---------|-------|-------|--------|
| 1.0.0 | 2026-07-21 | Speckit / Claude Code | Creación inicial. Principios innegociables (aislamiento Docker 003, migraciones aditivas, secretos por env, doble token proveedor+vigilado, 5 reglas de oro). Stack confirmado Next.js 16 + Prisma + PostgreSQL. OTPC = Operación de Transporte de Pasajeros por Carreteras. |

---

## Governance

Esta constitución **rige sobre cualquier otra práctica** en el proyecto 003. Las secciones **0 y 1 (principios innegociables)** tienen **prioridad absoluta** sobre consideraciones de conveniencia técnica. Toda PR y revisión debe verificar cumplimiento; la complejidad debe justificarse. Las enmiendas requieren: documentación en el Historial (§9), aprobación del responsable y, si aplica, plan de migración. Ante una tarea que contradiga este documento —especialmente si implica recursos de 001/002 o decisiones de stack— **DETENERSE y consultar** antes de proceder. Guía de desarrollo en tiempo de ejecución: `AGENTS.md` + `HANDOFF-SICOV.md`.

**Version**: 1.0.0 | **Ratified**: 2026-07-21 | **Last Amended**: 2026-07-21
