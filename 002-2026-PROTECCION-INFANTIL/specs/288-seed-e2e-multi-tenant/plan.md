# Plan SPEC-288 — Seed E2E multi-tenant

## Estructura

```
scripts/
  seed-e2e-multi-tenant.ts   ← NUEVO
specs/288-seed-e2e-multi-tenant/
  spec.md · plan.md · tasks.md
specs/README.md               ← entrada SPEC-288
```

---

## Tarea 1 — Utilidades internas del script

Dentro del propio archivo:

- `generarPassword()`: 16 chars, `A-Za-z0-9` + al menos 1 símbolo de `!@#$%^&*`. Usa `randomBytes` de `node:crypto` (determinismo local, sin dependencias nuevas).
- `nowCOT()`: string ISO en zona `America/Bogota` (`Intl.DateTimeFormat`).
- `assertIntocables(tx, snapshot)`: helper que compara la lista de Sagrado corazón antes/después.

---

## Tarea 2 — Guardas de entorno (antes de tocar BD)

```ts
if (!process.env.DATABASE_URL) throw new Error("[seed-e2e] DATABASE_URL requerida");
if (process.env.NODE_ENV === "test") throw new Error("[seed-e2e] NODE_ENV=test bloqueado");
if (!process.env.PARAM_ENCRYPTION_KEY) throw new Error("[seed-e2e] PARAM_ENCRYPTION_KEY requerida (cifra el texto del reporte)");
```

---

## Tarea 3 — Snapshot de Sagrado corazón

```ts
const intocablesAntes = await prisma.colegio.findMany({
  where: { nombre: { contains: "Sagrado", mode: "insensitive" } },
  select: { id: true, nombre: true, tenantId: true, admin: { select: { id: true, email: true } } },
});
```

---

## Tarea 4 — Verificar semillas base

```ts
const [plataforma, pais, ciudad] = await Promise.all([
  prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }),
  prisma.pais.findFirst({ where: { OR: [{ codigo: "CO" }, { nombre: "Colombia" }] } }),
  prisma.ciudad.findFirst({ where: { nombre: "Bogotá" } }),
]);
if (!plataforma || !pais || !ciudad) throw new Error("[seed-e2e] Semillas base faltantes (whatsapp/Colombia/Bogotá) — corre `prisma db seed` primero");
```

---

## Tarea 5 — Transacción por colegio (`upsertColegioE2E`)

Función interna que recibe `letra: "A" | "B"` y devuelve `{ colegio, admin, password }`. Dentro de `prisma.$transaction`:

1. `tenant` — `findFirst({ where: { nombre: "e2e-multi-tenant-A" } })` → si no existe `create({ data: { nombre } })`.
2. `colegio` — `upsert({ where: { tenantId: tenant.id }, create: {...campos requeridos...}, update: { estado: "activo" } })`.
3. `password = generarPassword()`; `passwordHash = await hashPassword(password)`.
4. `admin` — `upsert({ where: { email: "soporte+e2e-colegio-a@innovadataco.com" }, create: { email, nombre, passwordHash, rol: "SCHOOL_ADMIN", debeCambiarPassword: false, estadoActivacion: "ACTIVO", tenantId: tenant.id, colegioId: colegio.id }, update: { passwordHash, debeCambiarPassword: false } })`.
5. `curso` — `upsert({ where: { colegioId_nombre_grado_anioLectivo: {...} }, create: {...}, update: {} })`.
6. 2 estudiantes — `findFirst`+`create` por nombre.
7. `profesor` — `findFirst`+`create` por (colegioId, nombre).
8. `reporte` + `clasificacion` — `findFirst({ where: { identificador: "@e2e-A-target", tenantId } })` + `create` si no existe. Texto cifrado con `encryptParameter("Reporte de prueba E2E multi-tenant. NO tocar.")`.

Return `{ colegio, admin, password }`.

---

## Tarea 6 — AuditLog + guard final

```ts
await prisma.auditLog.create({
  data: {
    accion: "LOGS_MANTENIMIENTO_PURGA",
    tipoRecurso: "SeedE2E",
    ipAddress: "script",
    userAgent: "scripts/seed-e2e-multi-tenant",
    metadatos: {
      origen: "e2e-multi-tenant",
      colegios: [resultA.colegio.id, resultB.colegio.id],
      admins: [resultA.admin.id, resultB.admin.id],
      regeneradoContraseñas: true,
      ejecutado: nowCOT(),
    },
  },
});

const intocablesDespues = await prisma.colegio.findMany({
  where: { nombre: { contains: "Sagrado", mode: "insensitive" } },
  select: { id: true, nombre: true, tenantId: true, admin: { select: { id: true, email: true } } },
});
assertIntocables(intocablesAntes, intocablesDespues);   // throw si diverge
```

---

## Tarea 7 — Impresión stdout formato exacto brief §4

Solo tras completar todo. Cero prints intermedios reveladores.

---

## Tarea 8 — CI guards

- `specs/288-seed-e2e-multi-tenant/tasks.md` (guard vacío)
- `specs/README.md` — entrada SPEC-288

---

## Verificación pre-push

```bash
npx tsc --noEmit                # cero errores nuevos
npx eslint scripts/seed-e2e-multi-tenant.ts
npx vitest run --config vitest.unit.config.ts src/lib/specs-discipline.test.ts prisma/seed-security.test.ts
npm run arch:check
```

## Verificación en vivo (SC-6, antes de emitir REALIZADO)

```bash
node --import tsx scripts/seed-e2e-multi-tenant.ts   # 1a ejecución
node --import tsx scripts/seed-e2e-multi-tenant.ts   # 2a ejecución — mismo output modulo passwords
# Login manual como rector A → confirmar solo ve Colegio A
```
