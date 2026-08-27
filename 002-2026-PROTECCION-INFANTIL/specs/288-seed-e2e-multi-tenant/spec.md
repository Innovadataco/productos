# SPEC-288 — Seed E2E multi-tenant

**Radicado**: 002-PI-188  
**Tipo**: Utilidad de calidad (desbloquea Campaña 6, D-89)  
**Estado**: IMPLEMENTADO  
**Fecha**: 2026-08-27  
**Impacto en arquitectura:** 1 script nuevo `scripts/seed-e2e-multi-tenant.ts`. Aditivo idempotente. Cero migraciones. Cero cambios en `src/`.

---

## Contexto

Calidad no puede ejecutar Campaña 6 (aislamiento multi-tenant) porque prod solo tiene 2 colegios "Sagrado corazón" que son cuentas personales de Jelkin (intocables). Este script crea 2 colegios + 2 rectores dedicados + siembra mínima, todo idempotente. Rota contraseñas al re-ejecutarse.

---

## Ajustes del brief al esquema real (verificado sobre `origin/feature/001-scaffolding@f4c5ffdb`)

| Campo del brief | Reality en `schema.prisma` | Solución en el script |
|-----------------|----------------------------|----------------------|
| `Colegio.codigo` | No existe | Usar `nombre` como identificador único: `"Calidad · Colegio A"` / `"Calidad · Colegio B"` |
| `Colegio.metadatos` | No existe (Colegio no tiene JSON) | Usar `Tenant.nombre="e2e-multi-tenant-A"` como marcador de origen; auditoría final va en `AuditLog.metadatos.origen` |
| `Colegio.activo` (boolean) | Es `estado: String @default("activo")` | `estado="activo"` |
| `Usuario.metadatos` | No existe | Marcador implícito por email (`soporte+e2e-colegio-{a,b}@`) |
| `Curso.grado=10` (int) | Es `grado: String?` | `grado="10"` |
| `Alumno.nombre` | El modelo se llama `Estudiante` (@@map Alumno); requiere `nombre + apellidos` (default "") | `nombre="Estudiante E2E {A|B}-1"`, `apellidos="Prueba"` |
| `Profesor` | Modelo separado; requiere `apellidos`, `estado` | `nombre="Profesor E2E {A|B}"`, `apellidos="Prueba"` |
| `Reporte.categoria=OTRO` | `categoria` no es campo de Reporte, es de `ClasificacionIA` | Reporte + ClasificacionIA con `categoria=OTRO` |
| `Reporte.metadatos.origen` | Reporte no tiene JSON metadatos | Marca implícita por `identificador="@e2e-{A|B}-target"` |
| `bcrypt saltRounds=10` | `src/lib/auth.ts` usa `saltRounds=12` | Reusar `hashPassword` de `@/lib/auth` (12) para no divergir del patrón del repo. **Desviación del brief documentada aquí.** |

**Rationale:** el brief especifica `metadatos.origen="e2e-multi-tenant"` para depuración trivial. Se conserva el objetivo con dos marcadores robustos:
1. `Tenant.nombre` con prefijo `e2e-multi-tenant-`
2. `Usuario.email` con alias `soporte+e2e-colegio-{a,b}@`
3. `Colegio.nombre` con prefijo `"Calidad · Colegio "`
4. `AuditLog.metadatos.origen="e2e-multi-tenant"` al final del script

Depuración: `WHERE nombre LIKE 'e2e-multi-tenant-%'` sobre Tenant, o `WHERE email LIKE 'soporte+e2e-%@%'` sobre Usuario.

---

## Alcance · 1 archivo nuevo

`scripts/seed-e2e-multi-tenant.ts` — TS ejecutable con `node --import tsx scripts/seed-e2e-multi-tenant.ts` (patrón vigente del repo, coherente con `revocar-grants-*.ts`).

### Estructura

Una sola `$transaction` de Prisma que:

1. **Verificación de intocables (candado §5.2):** query `Colegio.findMany({ where: { nombre: { contains: "Sagrado" } } })`, guardar `id/nombre/tenantId/adminId` en memoria. Si al final del script alguno cambió → `throw` y rollback automático.
2. Semillas base requeridas: `Plataforma` (whatsapp), `Pais` (Colombia), `Ciudad` (Bogotá) — `findFirst` + fallback: si no existen, lanzar `HALLAZGO` (no las crea; asume seed base corrido).
3. Para cada colegio ("A", "B"):
   a. `Tenant`: `findFirst({ where: { nombre } })` → si no existe `create`, si existe reutilizar id.
   b. `Colegio`: `upsert({ where: { tenantId }, create: {...}, update: { estado: "activo" } })`.
   c. `Usuario` (SCHOOL_ADMIN): password aleatoria 16 chars alfanuméricos+símbolo → `hashPassword` (bcrypt 12) → `upsert({ where: { email }, create: {..., passwordHash, debeCambiarPassword: false, colegioId, estadoActivacion: "ACTIVO"}, update: { passwordHash } })`. **Idempotencia con rotación:** el `update` regenera `passwordHash` con la nueva contraseña.
   d. `Curso`: `upsert({ where: { colegioId_nombre_grado_anioLectivo: {..., nombre: "Grado 10 (E2E)", grado: "10", anioLectivo: "2026"} }, create: {...}, update: {} })`.
   e. 2 `Estudiante`: `findFirst({ where: { cursoId, nombre } })` + fallback `create`.
   f. `Profesor`: `findFirst({ where: { colegioId, nombre, apellidos: "Prueba" } })` + fallback `create`.
   g. `Reporte` + `ClasificacionIA`: `findFirst({ where: { identificador: "@e2e-A-target", tenantId } })` + fallback `create` (Reporte con texto cifrado por `encryptParameter`, ClasificacionIA con `categoria=OTRO`, `confianza=0.5`).
4. `AuditLog.create({ accion: "LOGS_MANTENIMIENTO_PURGA", tipoRecurso: "SeedE2E", metadatos: { origen: "e2e-multi-tenant", colegios: [idA, idB], regeneradoContraseñas: true } })` — no hay `SEED_E2E_EJECUTADO` en el enum; se reutiliza el mismo mecanismo probado en SPEC-265/285 (candado "cero migraciones").
5. Guard final: re-verificar intocables sin cambios; si diverge → `throw` y rollback.
6. Fuera de la transacción: `stdout` con las 2 contraseñas + ids.

---

## Salida esperada (formato exacto del brief §4)

```
✅ Seed E2E multi-tenant COMPLETO (idempotente).

Copiar en ~/.config/pi-e2e/.env.e2e:

E2E_COLEGIO_A_ADMIN_EMAIL=soporte+e2e-colegio-a@innovadataco.com
E2E_COLEGIO_A_ADMIN_PASSWORD=<contraseña generada A>
E2E_COLEGIO_A_ADMIN_COLEGIO_ID=<uuid colegio A>

E2E_COLEGIO_B_ADMIN_EMAIL=soporte+e2e-colegio-b@innovadataco.com
E2E_COLEGIO_B_ADMIN_PASSWORD=<contraseña generada B>
E2E_COLEGIO_B_ADMIN_COLEGIO_ID=<uuid colegio B>

Ejecutado: {timestamp COT}
```

---

## Candados

1. **Cero DROP/TRUNCATE/DELETE.** Solo `upsert`/`create`/`findFirst`+`create`.
2. **Cero cambio a Sagrado corazón:** guard de entrada y salida (rollback si diverge).
3. **Cero bypass DAL/RLS:** el script vive en `scripts/` (frontera es Prisma directo por convención `scripts/*`, no `src/app`), no toca middleware ni tenancy.
4. **Rectores por Prisma directo,** NO por `/api/auth/register`.
5. **NO correr en CI:** el script no se agrega a workflows. Dev por defecto. Prod tras directriz explícita CEO.
6. **CERO cambios en `src/lib/ai/**`, CERO migraciones, CERO cambios en compose prod.**
7. **PARAM_ENCRYPTION_KEY** requerida: si falta, el script aborta antes de tocar la BD.
8. **Guard de env:** el script lee `NODE_ENV` — si es `test` o falta `DATABASE_URL`, aborta.

---

## Verificación en vivo (SC-6)

Post-implementación, Desarrollo ejecuta contra dev:

```
node --import tsx scripts/seed-e2e-multi-tenant.ts
```

Captura las 2 contraseñas. Login manual (o cURL) como rector A a `/api/auth/login`, GET `/api/colegio/mi-colegio` (o equivalente) → verifica solo Colegio A. Idem con B.

Reporta en el `002-PI-188 · VERIFICADO EN VIVO` que login rector A ve solo Colegio A.
