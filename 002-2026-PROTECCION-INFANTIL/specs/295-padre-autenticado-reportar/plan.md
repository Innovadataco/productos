# Implementation Plan: Padre autenticado puede reportar (cierra I-146)

**Branch**: `work/002-PI-196` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: INSTRUCTIVO-002-PI-196 · BRIEF-A-38 · I-146

---

## Summary

Reemplazar el stub `PlaceholderPadre` de `src/app/dashboard/padre/reportar/page.tsx` por una página que reutiliza `ReporteWizard` (ya es componente compartido — vive en `src/components/modules/`) con nueva prop `modoAutenticado`. Agregar campo aditivo `origenRol String?` al modelo `Reporte` (migración pura ADD COLUMN nullable, cero riesgo). En la API `/api/reportes`, setear `origenRol = "PARENT"` cuando `user?.rol === "PARENT"`. Redirect post-envío autenticado va a `/dashboard/padre/mis-reportes` (no al expediente — verificado que no existe flujo automático "reporte → expediente"). Cero cambios al motor IA, cero cambios al flujo anónimo, cero cambio al sidebar (ya correcto).

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Stack** | Next.js 15 App Router · React 19 · TypeScript 5 · Prisma 5 · Vitest · Playwright |
| **Runtime** | Server component (`page.tsx`) + client component (`ReporteWizard`) |
| **Testing** | Vitest integration (API `/api/reportes` con BD real) + Vitest unit (ReporteWizard con MSW) + Playwright E2E `padre-reporta-autenticado.spec.ts` |
| **Rendimiento** | Sin impacto — un campo `String?` adicional en la tabla `reportes`, un prop en el componente cliente |
| **Constraints** | Cero cambios al motor IA · cero cambios al flujo anónimo · migración aditiva pura · cero cambios al sidebar |
| **Autonomía** | Régimen D-51: build → PR → gate CI → auditoría Fábrica → deploy Jelkin → verificación en vivo (SC-008 obligatoria) |

---

## Constitution Check

- ✅ Solo texto — el reporte es texto.
- ✅ IA local — irrelevante; no toca motor.
- ✅ **Migraciones aditivas y no destructivas** — `ALTER TABLE reportes ADD COLUMN "origenRol" TEXT` es pura adición nullable. Cero cambio a filas existentes.
- ✅ Frontera DAL (Q-3) — `ReporteCreationService` sigue en `src/lib/dal/services/`; solo se agrega un campo al input.
- ✅ Sin `any` ni stack traces al cliente.
- ✅ Un commit por User Story + uno de docs.

Sin violaciones. `Complexity Tracking` no aplica.

---

## Project Structure

### Documentation (this feature)

```text
specs/295-padre-autenticado-reportar/
├── plan.md              # Este archivo
├── spec.md              # ya creado
├── tasks.md             # Fase 2 (a producir con /speckit.tasks)
└── cierre.md            # Post-verificación (patrón SPEC-266+)
```

### Código a tocar

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                                       # AGREGAR Reporte.origenRol String?
│   └── migrations/
│       └── 2026MMDDHHMMSS_spec_295_reporte_origen_rol/
│           └── migration.sql                               # ALTER TABLE reportes ADD COLUMN
├── src/app/
│   ├── dashboard/padre/reportar/page.tsx                   # REEMPLAZAR stub por ReporteWizard modoAutenticado
│   └── api/reportes/route.ts                               # SETEAR origenRol=PARENT
├── src/components/modules/
│   ├── ReporteWizard.tsx                                   # PROP modoAutenticado + banner identidad + redirect autenticado
│   └── ReporteWizard.test.tsx                              # Ajustar/agregar tests para modo autenticado (mock user PARENT)
├── src/lib/dal/services/
│   └── reporte-creation-service.ts                         # ACEPTAR origenRol en input, persistirlo
├── src/lib/dal/repositories/
│   └── reporte-repository.ts                               # (si tiene) aceptar origenRol
├── tests/e2e/
│   └── padre-reporta-autenticado.spec.ts                   # NUEVO E2E Playwright
└── specs/295-padre-autenticado-reportar/                   # spec-kit del frente
```

**Structure Decision**: monolito Next.js. Alcance quirúrgico. Sin nuevos componentes, sin refactor de extracción (el wizard ya es reusable). Un campo Prisma aditivo + una prop React + un endpoint que lo setea.

---

## Implementation Steps

### Fase 0 — Estado verificado (documentado en spec §Estado del código)

Stub confirmado. Wizard ya compartido. API ya maneja PARENT. `origenRol` NO existe. Sidebar OK. `Expediente` NO se crea automáticamente al reportar.

### Fase 1 — Schema Prisma aditivo (FR-003)

1. **`prisma/schema.prisma`**: agregar `origenRol String?` al modelo `Reporte` (después de `usuarioId`, antes de `operadorId`). Sin default. Sin @@index (el campo es de baja cardinalidad — 2 valores + NULL).
2. **Migración**: `npx prisma migrate dev --name spec_295_reporte_origen_rol --create-only`. Verificar que el SQL generado sea solo `ALTER TABLE "reportes" ADD COLUMN "origenRol" TEXT;`. Sin drop, sin default rompedor.
3. **`npx prisma generate`** — actualiza tipos.

### Fase 2 — API `/api/reportes` setea origenRol (FR-004, FR-005)

4. **`src/lib/dal/services/reporte-creation-service.ts`**: agregar campo `origenRol?: string | null` a `CrearInput`. Pasar a `prisma.reporte.create({ data: { ..., origenRol } })`.
5. **`src/app/api/reportes/route.ts:117-137`**: en la llamada a `new ReporteCreationService(tx).crear({ ... })`, agregar `origenRol: user?.rol === "PARENT" ? "PARENT" : null`. Solo se setea cuando hay PARENT autenticado; anónimos y otros roles quedan NULL.
6. Test integración: 3 casos (PARENT → PARENT; anónimo → NULL; rol interno → 403 sin insert).

### Fase 3 — `ReporteWizard` acepta prop `modoAutenticado` (FR-002)

7. **`src/components/modules/ReporteWizard.tsx`**: agregar prop `modoAutenticado?: boolean` (default `false`).
   - Cuando `modoAutenticado=true`:
     - En `useEffect` de fetch `/api/me`, además de setear `user`, setear `data.esAnonimo=false` una sola vez tras cargar sesión.
     - Renderizar un banner al inicio del wizard: "Reportando como {user.nombre ?? user.email}" con checkbox "reportar anónimo" (que toggle `data.esAnonimo`).
     - Tras `handleSubmit` OK, en vez de `setResultado({ numeroSeguimiento })`, hacer `window.location.href = "/dashboard/padre/mis-reportes"`.
   - Cuando `modoAutenticado=false` (default): comportamiento actual conservado íntegramente. Anónimos NO ven banner, `esAnonimo=true` default, redirect al `ConfirmacionReporte` inline.
8. **Test unit `ReporteWizard.test.tsx`**: agregar 2 casos con `modoAutenticado`: (a) banner visible con user PARENT mockeado; (b) redirect al POST OK; conservar los tests existentes sin cambios.

### Fase 4 — Página `/dashboard/padre/reportar` real (FR-001)

9. **`src/app/dashboard/padre/reportar/page.tsx`**: reemplazar el stub por:
   ```tsx
   import { ReporteWizard } from "@/components/modules/ReporteWizard";
   
   export default function PadreReportarPage() {
       return (
           <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
               <div className="mb-8 text-center">
                   <h1 className="text-2xl font-bold tracking-tight">Reportar una situación</h1>
                   <p className="mt-2 text-sm text-muted">
                       Tu identidad quedará vinculada al reporte. Puedes marcar "reportar anónimo" si prefieres.
                   </p>
               </div>
               <ReporteWizard modoAutenticado />
           </main>
       );
   }
   ```

### Fase 5 — Test E2E Playwright (FR-012)

10. **`tests/e2e/padre-reporta-autenticado.spec.ts`** (nuevo):
    - Load credentials from `.env.e2e` (patrón SPEC-266+).
    - Login PARENT vía POST `/api/auth/login`.
    - `page.goto("/dashboard/padre/reportar")` con cookie de sesión.
    - Assert: formulario visible (no `PlaceholderPadre`), banner "Reportando como".
    - Llenar wizard (identificador único de test, plataforma, ciudad, texto).
    - Envío → assert redirect a `/dashboard/padre/mis-reportes`.
    - Query BD via API admin (o via psql si el harness E2E lo soporta): verificar `Reporte { usuarioId=<parent.id>, origenRol="PARENT" }`.

### Fase 6 — Gate LOCAL

11. `npx tsc --noEmit`
12. `npm run lint` — 0 err
13. `npm run tokens:check` · `npm run arch:check` (regenerar docs si drift) · `npm run locks:check` · `npm run ratchets:check`
14. `npm run test:unit` (incluye tests actualizados de `ReporteWizard.test.tsx`)
15. `npm run test:integration -- reportes` (integración `/api/reportes` con BD real)
16. Registro `specs/README.md` con SPEC-295.

### Fase 7 — Pre-push (I-101/I-104)

17. `git fetch origin && git rebase origin/feature/001-scaffolding`
18. `git diff --name-status origin/feature/001-scaffolding..HEAD` — verificar solo archivos SPEC-295. Cero archivos ajenos.

### Fase 8 — Push

19. `git push origin work/002-PI-196`. Fábrica abre PR + mergea.

### Fase 9 — Verificación en vivo (SC-008 · obligatoria post-deploy)

20. Acceder a app con credenciales `.env.e2e` como PARENT.
21. Navegar a `/dashboard/padre/reportar` → verificar formulario real.
22. Enviar reporte de prueba (identificador único, marca de tiempo en el texto).
23. Verificar redirect a `/dashboard/padre/mis-reportes`.
24. `ssh pi-vps ... psql -c "SELECT id, \"usuarioId\", \"esAnonimo\", \"origenRol\" FROM reportes WHERE id='<nuevo>';"` — assert `origenRol='PARENT'`, `usuarioId=<parent.id>`.
25. Cleanup: `UPDATE reportes SET eliminado=true, "motivoBaja"='TEST_SPEC_295' WHERE id='<nuevo>'` (o script existente de limpieza de test data).
26. `cierre.md`: ruta canónica del componente compartido, decisión sobre `origenRol` (String?), redirect a `/mis-reportes` justificado, regresión anónimo OK.

### Commit map (español, imperativo)

- `docs(spec-kit): SPEC-295 · spec + plan · padre autenticado puede reportar (I-146) [002-PI-196]`
- `feat(prisma): agregar Reporte.origenRol como campo aditivo nullable [SPEC-295]`
- `feat(api-reportes): setear origenRol="PARENT" cuando user.rol=PARENT [SPEC-295]`
- `feat(reporte-wizard): prop modoAutenticado + banner identidad + redirect a mis-reportes [SPEC-295]`
- `feat(dashboard-padre): reemplazar stub PlaceholderPadre por página real [SPEC-295]`
- `test(e2e): padre autenticado puede reportar y llega a /mis-reportes [SPEC-295]`

---

## Test Strategy

- **Unit (Vitest)**: `ReporteWizard.test.tsx` con `modoAutenticado` mock: banner visible, redirect correcto. Los tests actuales sin la prop siguen verdes.
- **Integración (Vitest + BD real)**: `POST /api/reportes` con JWT PARENT vs sin JWT vs con JWT interno. Verificar `origenRol` correcto en BD en cada caso.
- **E2E (Playwright)**: `padre-reporta-autenticado.spec.ts` cubre el flujo completo (login → wizard → BD).
- **Regresión**: los tests actuales de `/reportar` público (`ReporteWizard.test.tsx`, `reportes.spec.ts` E2E) siguen verdes sin modificarlos.
- **Verificación en vivo (SC-008)**: obligatoria. Reporte con `usuarioId`, `origenRol`, y captura de pantalla del redirect.

---

## Risks & Mitigations

| Riesgo | Mitigación |
|---|---|
| `ALTER TABLE reportes ADD COLUMN` en tabla grande (miles/millones de filas) tarda o bloquea. | La operación es puramente aditiva sin default rompedor — PostgreSQL 11+ la ejecuta en O(1) sin re-escribir la tabla (metadata-only). Verificable en dev antes del deploy. |
| Anónimo se pone `esAnonimo=false` accidentalmente por cambio en la lógica del wizard. | La prop `modoAutenticado` es explícita; el default es `false`. Los tests unit del wizard cubren tanto modo con como sin prop. |
| El redirect a `/dashboard/padre/mis-reportes` no muestra el reporte recién creado por race (reporte creado en un tx, listado por otro que aún no lo ve). | El listado usa `SELECT ... FROM reportes WHERE usuarioId=?` — Postgre garantiza read-committed por default; tras `commit` de la transacción de creación, el siguiente `SELECT` lo ve. Cero race real. Si por render Next hay stale-cache, el usuario ve el reporte en el próximo refresh. |
| Cambio de contrato UI: mostrar banner "Reportando como" puede ser inesperado para el padre. | Diseño intencional (brief §2.1-2 lo pide). El checkbox "reportar anónimo" da la salida si el padre prefiere. |
| El campo `origenRol` como `String?` no captura semántica de enum (hay `SCHOOL_ADMIN`, `COMITE_CONVIVENCIA` que podrían reportar en el futuro). | Punto de compuerta 1 documentado. Fase 2 puede migrar `String?` → `enum OrigenRolReporte` sin cambio destructivo (los `PARENT` string se mapean directo). |
| Rebase sobre `origin/feature/001-scaffolding` genera conflicto con SPECs de otros Desarrollo. | Scope de este frente: `dashboard/padre/reportar/page.tsx`, `ReporteWizard.tsx`, `/api/reportes/route.ts`, `reporte-creation-service.ts`, Prisma schema, E2E. Verificado en INSTRUCTIVO §Coordinación: D-1 en `email.ts`, D-2 en `Dockerfile/deploy-prod.sh`. Cero colisión. |

---

## Out of Scope

- **Crear/actualizar Expediente automáticamente al reportar** (Punto de compuerta 2). Brief §3 lo excluye por implicar cambio de pipeline. Frente separado si Fábrica lo pide.
- **Otros stubs del sidebar padre**: círculo-confianza, notificaciones, perfil. Candado brief §3.
- **Filtro `/mis-reportes` por autor**: es A-39.
- **Cambios al motor IA** (`src/lib/ai/**`). Candado global.
- **Cambios al flujo anónimo público** `/reportar`. Candado brief §3.
- **Convertir `origenRol` a enum estricto** (Fase 2 posible).
- **UI diferenciada para reportes PARENT en `/mis-reportes`** (badge "reportado por ti") — es UX minor fuera de alcance de este brief.
