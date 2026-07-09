# PLAN MAESTRO TS-001 — PROGRESO DE EJECUCIÓN

## Estado Actual (2026-07-09 ~02:30 AM)

| Tarea | Estado | Commit |
|-------|--------|--------|
| **T0** — Helper crypto.ts | ✅ COMPLETADA | `3038d9a` |
| **T1** — Cifrar apiKey en AiModel | ✅ COMPLETADA | `3038d9a` |
| **T2** — Auth single-user | 🔄 EN PROGRESO (60%) | `3038d9a` |
| **T3** — SQLite → PostgreSQL | ⏳ PENDIENTE | — |
| **T4** — Higiene de código | ⏳ PENDIENTE | — |

---

## T0 COMPLETADA ✅

**Archivos creados:**
- `src/lib/crypto.ts` — AES-256-GCM con `getKey()` que falla explícitamente si `ENCRYPTION_KEY` no está configurada

**Validación:**
- Sin `ENCRYPTION_KEY` el build falla con error claro
- `.env.example` actualizado con `ENCRYPTION_KEY=` y `JWT_SECRET=`

---

## T1 COMPLETADA ✅

**Archivos modificados:**
- `src/app/api/config/models/route.ts` — POST encripta `apiKey`, GET excluye el campo
- `src/app/api/config/models/[id]/route.ts` — PUT encripta `apiKey` si se envía
- `src/lib/modelClients.ts` — `openaiCall` desencripta `apiKey` antes de usarla

**Criterios de aceptación:**
- [x] `apiKey` se cifra antes de `prisma.create` y `prisma.update`
- [x] `GET /api/config/models` nunca devuelve `apiKey` (verificado con `select`)
- [x] `modelClients.ts` desencripta correctamente

---

## T2 EN PROGRESO 🔄 (60%)

**Completado:**
- Instaladas dependencias: `bcryptjs`, `jose`, `@types/bcryptjs`
- Creado `scripts/seedUser.mjs` — crea usuario único `admin` si no existe
- Creado `src/lib/auth.ts` — `verifyAuth()` y `signToken()` sin fallback inseguro
- Creado `src/app/api/auth/login/route.ts` — login con cookie `httpOnly`
- Protegidas rutas de modelos:
  - `POST /api/config/models`
  - `PUT /api/config/models/[id]`
  - `DELETE /api/config/models/[id]`

**Pendiente:**
- [ ] Proteger `POST /api/config/apis`
- [ ] Proteger `POST /api/documents`
- [ ] Proteger `PATCH /api/documents`
- [ ] Proteger `POST /api/licitaciones`
- [ ] Proteger `POST /api/research/analyze`

---

## T3 PENDIENTE ⏳

**Tareas:**
- Cambiar `provider = "sqlite"` → `"postgresql"` en `schema.prisma`
- Crear `docker-compose.yml` con servicios `app` + `db`
- Backup de `base-oficial.sqlite` antes de migrar
- Regenerar migraciones contra PostgreSQL
- Validar que `docker compose restart db` no borra datos

---

## T4 PENDIENTE ⏳

**Tareas:**
- Agregar `"engines": { "node": ">=22" }` en `package.json`
- Quitar IP hardcodeada de `next.config.ts`
- Reemplazar `catch (err: any)` que expone `err.message` al cliente
- Agregar advertencia en `mockCall`
- Escribir tests para rutas críticas

---

## Instrucciones para Continuar

1. **Terminar T2:** Proteger las rutas API restantes con `verifyAuth()`
2. **T3:** Migrar a PostgreSQL con Docker
3. **T4:** Higiene de código y tests
4. **Validar todo:** `npm run build`, `npm run test`, pruebas manuales de login y modelos

**Nota:** El helper `crypto.ts` y `auth.ts` fallan explícitamente si faltan variables de entorno, cumpliendo con el requisito de "sin fallback inseguro".