# AGENTS.md — 003-2026-SICOV-OTPC

> **Documento maestro para Claude Code.** Léelo COMPLETO al inicio de cada sesión, antes de
> crear, instalar o ejecutar cualquier cosa. Es la fuente de verdad del proyecto 003 y está
> por encima de cualquier instrucción dada solo por chat.

---

## 0. Cómo debe operar Claude Code en este proyecto (contexto y recordación)

Claude Code **no recuerda entre sesiones ni entre máquinas** por sí solo: la memoria (`~/.claude`)
es local a cada equipo y usuario. Por eso **el contexto durable vive en este repo**, no en el chat.

**Reglas de operación (obligatorias):**

1. **Al iniciar sesión, LEE en este orden:** este `AGENTS.md` → `HANDOFF-SICOV.md` (análisis del
   sistema real) → los artefactos Spec-Kit vigentes en `specs/` (`spec.md`, `plan.md`, `tasks.md`).
   No empieces a codificar sin ese contexto.
2. **Las instrucciones durables van al repo, no al chat.** Si el responsable te da una regla nueva
   que debe persistir, escríbela en `AGENTS.md` (o en el `spec` correspondiente) y commitéala. Lo
   que solo se diga por chat se pierde en la siguiente sesión.
3. **`AGENTS.md`/`CLAUDE.md` se cargan solos en tu contexto** — mantenlos concisos y actualizados.
   Si algo cambia (puerto, decisión de stack, comando de deploy), actualiza este archivo en el mismo commit.
4. **Verifica contra el código real antes de afirmar.** No asumas; abre el archivo. Marca dudas con
   `[NEEDS CLARIFICATION]` en `specify` en vez de inventar.
5. **Modo plan para lo sensible/grande:** entrega hasta el `plan.md` y **DETENTE para revisión humana**
   antes de implementar.
6. **Reporta conciso.** Tono neutral, sin voseo ("reporta/crea/verifica", no "reportá/creá/verificá").

---

## 1. Qué es el proyecto

**003-2026-SICOV-OTPC** — rediseño del sistema **Gesmovil / SICOV** (gestión de despachos, llegadas,
mantenimientos, novedades y proveedores vigilados, con reporte a la Superintendencia de Transporte).
El detalle del dominio, la integración y el modelo de datos están en **`HANDOFF-SICOV.md`**.

El **código fuente actual** en esta carpeta es un **avance ya construido** (frontend React+Vite + backend
NestJS + Prisma, con diseño propio y datos demo). Ver estado y decisiones abiertas en la sección 6.

---

## 2. LAS 5 REGLAS DE ORO (ninguna se salta al cerrar un spec)

1. **Spec-Kit completo** — todos los artefactos (`spec.md`, `plan.md`, `research.md`, `data-model.md`,
   `quickstart.md`, `contracts/`, `checklists/`, `tasks.md`) + checklist validado.
2. **Subir al repo** — un commit por User Story + uno de documentación, con evidencia (`git log` +
   archivos tocados) y push a la rama de trabajo.
3. **Desplegar limpio** — script de reinicio que borre el build viejo, levante la app y verifique el
   healthcheck. Nunca dejar procesos/workers duplicados (uno solo).
4. **Probar** — con el `quickstart.md` + `tsc --noEmit` / `lint` / `test` / `build`.
5. **Documentar** — `cierre.md` + sección Implementación en `spec.md` + deuda técnica.

> En una línea: **spec completo → commiteado con evidencia → desplegado limpio → probado → documentado.**

---

## 3. Metodología: Spec-Kit (Spec-Driven Development)

Toolkit oficial: https://github.com/github/spec-kit

**Flujo obligatorio por feature:**
`constitution → specify → clarify → plan → tasks → analyze → implement → validate → close`

- Comandos: `/speckit.constitution`, `/speckit.specify`, `/speckit.clarify`, `/speckit.plan`,
  `/speckit.tasks`, `/speckit.analyze`, `/speckit.checklist`, `/speckit.implement`.
- Cada spec vive en `specs/NNN-nombre/` con el set completo de artefactos.
- `spec.md`: User Stories con Priority (P1/P2) + Acceptance Scenarios (Given/When/Then) + Edge Cases;
  Functional Requirements ("FR-XXX: El sistema DEBE…"); Success Criteria; Assumptions.
- **Estados canónicos:** `PLANEADO → DESARROLLO → IMPLEMENTADO → PENDIENTE DE PRUEBA → FINALIZADO → CERRADA`.
- **Gate de plan:** en features sensibles/grandes, entrega el `plan.md` y DETENTE para revisión humana.

Usar la **misma versión de Spec-Kit y el mismo preset** que el proyecto 002, para artefactos homogéneos.

---

## 4. Repositorio y ramas

- **Repo:** `Innovadataco/productos` (monorepo de la Fábrica de Software).
- **Este proyecto:** carpeta `003-2026-SICOV-OTPC/`.
- **Rama de trabajo:** `feature/003-sicov-otpc-scaffolding`.
- **Flujo de integración:** rama de trabajo → **PR** hacia `feature/001-scaffolding` (rama de desarrollo)
  → luego a `main`.
- **Gobierno del repo:** todo código pasa por **PR y revisión**; **sin ACTA-VALIDACIÓN no hay merge**;
  nunca subir secretos; documentar cambios de arquitectura. Líder: **ZEUS**. Agente de revisión: **ODIN**.
- **Commits:** prefijos `feat(003-USx): …`, `fix(003): …`, `docs(003): …`, `test(003): …`. Un commit por
  User Story; no mezclar features.

---

## 5. Infraestructura en la Mac Studio (convivencia — CRÍTICO)

En esta máquina viven **001 y 002 en desarrollo activo**. El 003 **no puede interferir**.

### 🚫 NO TOCAR JAMÁS
- Contenedores `001-2026-innovadataco-db-1` (:5432) y `002-2026-proteccion-infantil-db-1` (:5433).
- Volúmenes `001-..._innovadataco_db_data` y `002-..._postgres_data`.
- Puertos ocupados: `5000, 5001, 5005, 5006, 5432, 5433, 7000, 11434` + sistema.
- Modelos Ollama de otros proyectos (`ornith:9b/35b`, `qwen2.5:32b`, `nomic-embed-text`) — **no borrar**.
- Comandos prohibidos: `docker stop/rm/restart` sobre 001/002, `docker volume rm` ajenos,
  `docker system prune`, `ollama rm`.

### ✅ LO QUE SÍ CREA EL 003
- Su **propio** contenedor `003-...-db-1` con **puerto propio** (sugerido **BD 5434**→5432 interno).
- Su **propio** volumen (`003-..._db_data`) con `mem_limit` en el compose desde el día 1.
- Su **propio** puerto de app (sugerido **5010**). **Verifica con `lsof -i :5010` y `lsof -i :5434` antes.**
- Ollama compartido en `:11434` (solo lectura; `ollama pull` de modelos nuevos permitido, sin borrar).

**Filosofía:** BD **aislada** por proyecto (Docker), Ollama **compartido**, proyectos inactivos se
**apagan** (`docker stop`) para liberar RAM sin perder aislamiento.

---

## 6. Reglas de oro técnicas (siempre)

- **Migraciones SIEMPRE aditivas y NO destructivas.** Nunca `prisma migrate reset` ni nada que borre datos.
  Dump de respaldo (`pg_dump`) antes de tocar seed/datos.
- **Nunca confiar en un build sin borrar el build viejo antes** (`rm -rf .next`/`dist` según stack).
- **Un solo proceso/worker a la vez** — matar el viejo antes de levantar el nuevo.
- **Secretos por variables de entorno, nunca en el código.** `.env` va en `.gitignore`; se commitea
  `.env.example`. El `.env` real (credenciales de Supertransporte: `EXTERNAL_APP_USER`, `TOKEN`, token de
  vigilado) vive **solo local**, nunca en el repo (que además es público).
- **Un agente por proyecto/rama.** No commitear a la misma rama que otro agente (p. ej. Kimi en 002) para
  evitar conflictos de git.
- **No cerrar** hasta completar TODAS las tareas y artefactos. **No dejar el sistema roto ni con lockout.**

---

## 7. Cómo se prueba

- `npx tsc --noEmit` (tipos) · `npm run lint` (estilo) · `npx vitest run` (tests; toda función/endpoint
  nuevo con su `.test.ts`; los tests existentes deben seguir verdes) · `npm run build` (producción).
- **Deploy limpio** con script de reinicio (rm build viejo + levantar + healthcheck).
- **Probar en vivo** con el `quickstart.md` — lo que pasa los tests puede fallar en vivo.

---

## 8. Estado actual y decisiones abiertas

- **Construido (demo):** frontend React+Vite (diseño propio, todos los módulos) + backend NestJS + Prisma
  (SQLite en dev) + colas + capa de integración con stubs + seed demo. Todo en `web/` y `api/`.
- **DECISIÓN ABIERTA (stack):** la fábrica está estandarizada en **Next.js 16 + Prisma** (ver proyecto 001).
  El código actual es React+Vite + NestJS. **Confirmar con el responsable si se porta a Next.js** (recomendado
  para consistencia; ~90% reaprovechable) o se mantiene, ANTES de construir mucho encima.
- **DECISIÓN ABIERTA (BD):** hoy SQLite (andamio). Producción/objetivo: **PostgreSQL** en Docker propio del 003.
- **Correcciones pendientes del demo:** ver `HANDOFF-SICOV.md` (login vigía→vigilado, doble token real,
  esquema real de 29 tablas, 5 bugs de la revisión de código).

---

## 9. Resumen de una línea

> Trabaja con Spec-Kit y las 5 reglas de oro; lee `AGENTS.md` + `HANDOFF-SICOV.md` al iniciar; crea tu propia
> infraestructura (Docker/puerto/BD con prefijo 003); **nunca toques 001/002**; guarda las instrucciones
> durables en el repo; ante duda que implique recursos ajenos o decisiones de stack, **DETENTE y pregunta**.
