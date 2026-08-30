# Implementation Plan: El comité de convivencia, operativo

**Branch**: `work/pi-SPEC-319-comite-convivencia-operativo` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/319-comite-convivencia-operativo/spec.md` · Brief A-57 · Instructivo 002-PI-219

## Summary

Hacer operativa la cuenta compartida del Comité de Convivencia. El bloqueo crítico (US1/§2.1) es que tres copias del mapa rol→home en el cliente omiten `COMITE_CONVIVENCIA`, así el comité cae en `/mis-reportes` con error. Se introduce **una fuente única de verdad rol→home** en el cliente, consumida por los tres puntos de landing, coherente con `homeForRole` del middleware, con **Decisión B**: el landing del padre (`/mis-reportes`) no cambia en este SPEC. Alrededor: acceso por email reusando el flujo de invitación del rector (§2.2), directorio de integrantes operable (§2.3), firma del integrante al cerrar caso con migración aditiva (§2.4), rediseño del inicio como bandeja (§2.5) e higiene de rol (§2.6).

## Technical Context

**Language/Version**: TypeScript 5.x / Next.js 15 (App Router, RSC + client components), React 19

**Primary Dependencies**: Prisma 5.22 (PostgreSQL), `jose` (auth), Tailwind (design tokens/glass), Vitest (unit+integration por shards)

**Storage**: PostgreSQL vía Prisma. §2.4 agrega columna nullable `integranteFirmanteId` a `SolicitudComite` (migración aditiva, sin backfill). Resto sin cambios de esquema.

**Testing**: Vitest — unit (`vitest.unit.config.ts`) e integration (BD real de test). Casos rol→home unitarios sobre la fuente única; integration para `resolver()` con firmante y para creación de cuenta comité por token.

**Target Platform**: Web (prod en VPS `pi.innovadataco.com`, Docker). Verificación §6 en producción con la cuenta del comité.

**Project Type**: Web application (Next.js monolito, DAL frontier Q-3: Prisma solo vía repositorios).

**Performance Goals**: N/A (feature de navegación/UI/CRUD; sin metas de throughput).

**Constraints**: Cero regresión en el landing de roles ya correctos (candado 24 v2). Secretos nunca en pantalla ni chat (§2.2). Frontera DAL: servicios/rutas no importan Prisma directo. Solo-lectura: `src/lib/ai/**`, `.github/workflows/**`, `deploy-prod.sh`, middleware/guardas (A-56), profesores (A-58).

**Scale/Scope**: 6 sub-features (§2.1–§2.6). MVP crítico = §2.1 (desbloquea a Jelkin). ~1 módulo nuevo (`homeParaRol`), 3 consumidores, 1 migración aditiva, 2 endpoints reusados, 1 rediseño de home.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Spec Kit en todo** ✅ — spec+plan+tasks+analyze antes de implementar.
- **DAL frontier (Q-3)** ✅ — el acceso a `IntegranteComite` y `SolicitudComite` va por repositorios existentes (`comite-convivencia-integrantes`, `solicitudes`); no se importa Prisma en rutas/servicios nuevos. La fuente única rol→home es pura (sin BD).
- **Fuente única, no tres parches** ✅ — el requisito de fondo del brief es exactamente el principio anti-duplicación; §2.1 lo cumple.
- **Migración aditiva y reversible** ✅ — `integranteFirmanteId` nullable, sin backfill; no rompe filas existentes.
- **arch:check** ✅ esperado — §2.1–§2.6 no agregan rutas nuevas de página/API (se reusan rutas y endpoints existentes); `arch:check` no debería regenerar `02-roles-capacidades.md`. Se verifica en implement.
- **Secreto nunca expuesto** ✅ — §2.2 elimina el pintado de contraseña; el comité define su clave por `/activar`.
- **Sin tocar solo-lectura** ✅ — no se toca `src/lib/ai/**`, workflows, deploy, middleware/guardas, profesores.

Sin violaciones que justificar → Complexity Tracking vacío.

## Project Structure

### Documentation (this feature)

```text
specs/319-comite-convivencia-operativo/
├── plan.md              # Este archivo
├── research.md          # Fase 0 — decisiones técnicas resueltas en fuente
├── data-model.md        # Fase 1 — entidades y el campo nuevo del firmante
├── quickstart.md        # Fase 1 — guía de validación §6
├── contracts/           # Fase 1 — contrato de la fuente única y del endpoint resolver
└── checklists/requirements.md  # calidad del spec (ya generado)
```

### Source Code (repository root · 002-2026-PROTECCION-INFANTIL)

```text
src/
├── lib/
│   └── auth/
│       └── home-para-rol.ts          # NUEVO §2.1 · fuente única rol→home (cliente, pura)
├── app/
│   ├── login/page.tsx                # §2.1 · consume home-para-rol (dueño Dev PI-2)
│   ├── cambiar-password/page.tsx     # §2.1 · consume home-para-rol (dueño Dev PI-2)
│   ├── mis-reportes/page.tsx         # §2.1 · consume home-para-rol para el rebote (dueño Dev PI-2)
│   └── dashboard/colegio/comite/
│       └── page.tsx / (home)         # §2.5 · rediseño del inicio (bandeja)
├── lib/dal/services/
│   ├── comite-convivencia.ts         # §2.2 · crearCuenta → INVITADO+token+email (no password en pantalla)
│   └── comite-convivencia-bandeja.ts # §2.4 · resolver() pide integranteFirmanteId activo + audit
├── components/modules/colegio/comite/
│   ├── ComiteCuentaCard.tsx          # §2.2 · quita el pintado de clave; "Reenviar invitación"
│   ├── IntegrantesList.tsx           # §2.3 · contador, estado por fila, editar, fecha con hora
│   ├── CasoDetalle.tsx               # §2.4 · selector de integrante firmante al resolver
│   └── ComiteHome*.tsx               # §2.5 · componentes del inicio rediseñado
├── components/modules/NavHeader.tsx  # §2.6 · esEmpleado += COMITE_CONVIVENCIA; etiqueta única
├── lib/nav-items.ts                  # §2.5 · etiqueta única para /comite/casos
prisma/
└── schema.prisma + migrations/       # §2.4 · integranteFirmanteId nullable en SolicitudComite

# NO fuente única (quedan locales, con comentario del porqué):
#   src/app/dashboard/admin/operadores/page.tsx  (homeParaRol = fallback de acceso-denegado)
#   src/components/modules/NavHeader.tsx destinoLogo (destino del logo, contextual)
```

**Structure Decision**: Monolito Next.js existente. Se agrega un módulo puro `src/lib/auth/home-para-rol.ts` como fuente única del cliente (fácil de testear, sin dependencias de servidor — no se importa `proxy.ts` que arrastra edge/middleware). Los tres consumidores del landing lo importan. El resto son cambios localizados en el módulo comité existente.

## Fases de entrega (para el PARA · decide Fábrica si va en 1 PR o secuenciado)

- **Fase 1 — MVP desbloqueo (US1/§2.1 + §2.6)**: fuente única rol→home + rebote de `/mis-reportes` + higiene de rol. Es lo que desbloquea a Jelkin. Verificable y desplegable solo.
- **Fase 2 — Acceso seguro (US2/§2.2)**: cuenta comité por email/token; quita clave en pantalla.
- **Fase 3 — Directorio (US3/§2.3)**: integrantes operable.
- **Fase 4 — Firma (US4/§2.4)**: migración + selector de firmante + audit.
- **Fase 5 — Bandeja (US5/§2.5)**: rediseño del inicio.

## Complexity Tracking

Sin violaciones de constitución que justificar.
