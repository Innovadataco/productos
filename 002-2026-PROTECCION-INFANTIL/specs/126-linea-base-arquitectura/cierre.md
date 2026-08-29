# Cierre — SPEC-126 · Línea base de arquitectura generada desde el código

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Instructivo**: 002-PI-042 (ZEUS)

## Resumen

La documentación de arquitectura ya no se escribe a mano: 5 generadores deterministas
leen el código (schema Prisma, proxy, navegación, seed, package.json/Dockerfile/compose)
y producen `docs/architecture/`. `npm run arch:check` (cableado al CI de la raíz del
monorepo) mantiene la línea base viva con 4 verificaciones: drift de artefactos,
huérfano no declarado, aserción A (puerta ≡ predicado) y aserción B (el menú no miente).

Además se aplicó la **D-41 (vinculante, ZEUS)**: ningún menú decide permisos por su
cuenta — todo componente de navegación consume `esDestinoPermitidoPorRol`; el módulo de
BD decide QUÉ se ofrece y el predicado del proxy tiene la ÚLTIMA palabra sobre si se
pinta. La D-41 cierra el hallazgo **I-39** (la primera corrida de la aserción B salió
ROJA sobre el código real: 2 hrefs muertos).

## Commits (un cambio lógico = un commit, push en el mismo acto)

| Hash | Contenido |
| --- | --- |
| `cb341268` | Maquinaria de aserciones A/B + tasks.md (evidencia del hallazgo I-39) — previo |
| `c39a7d33` | D-41: todo menú pinta módulo de BD ∧ predicado del proxy (cierra I-39) |
| `4584547f` | US1: 5 generadores + primera generación real en `docs/architecture/` |
| `a0218352` | US2: `arch:check` (4 aserciones) + paso en CI raíz + tests T009 |
| `4f8ce0d6` | US3: disciplina "Impacto en arquitectura" + regla de lectura en AGENTS.md |

## Hallazgo I-39 y decisión D-41

Primera corrida de la aserción B sobre el código real (condición ZEUS: ROJA = PARAR y
reportar, nunca silenciar):

```
[Arch:B] ROJO: 2 hrefs muertos (pintados pero bloqueados por la puerta):
  COMITE_VALIDACION · /dashboard/admin/comite/gestion   · COMITE_NAV_TABS (módulo comite)           · proxy=redirigir→/dashboard/admin/comite
  COMITE_VALIDACION · /dashboard/admin/comite/auditoria · COMITE_NAV_TABS (módulo comite_auditoria) · proxy=redirigir→/dashboard/admin/comite
```

Causa: el seed concede a `COMITE_VALIDACION` los módulos `comite`, `comite_bandeja` y
`comite_auditoria` (`prisma/seed.ts` `clavesPorRol`), pero esas dos rutas son
`ADMIN_ONLY_ROUTES` en `proxy.ts`: el menú las pintaba y la puerta redirigía (clic
muerto). ZEUS dictó la D-41 y se aplicó sin tocar `seed.ts`, `proxy.ts`,
`nav-items.ts` ni `permisos-catalogo.ts`.

### Barrido D-37 (componentes de navegación)

Filtraban SOLO por módulo (sin el predicado) — **migrados a módulo ∧ predicado**:

- `src/app/dashboard/admin/comite/components/ComiteSubNav.tsx` (gana prop `rol` del
  padre servidor; las 4 páginas del comité la pasan).
- `src/components/modules/AdminNav.tsx` (ya tenía `rol`; se añade el predicado al filtro).
- `src/components/modules/colegio/ColegioNav.tsx` (gana prop `rol` desde el layout).
- `src/app/dashboard/admin/ia/page.tsx` (tabs `IA_TABS`).
- `src/app/dashboard/admin/page.tsx` (aterrizaje: no redirige a destinos que la puerta bloquea).

Pintaban enlaces fijos sin consumir el predicado — **migrados con el patrón de
`NavHeader.tsx` (`useAuth` + `esDestinoPermitidoPorRol`)**:

- `src/app/dashboard/admin/operadores/components/OperadoresSubNav.tsx`.
- `src/app/dashboard/admin/estadisticas/components/DashboardSubNav.tsx`.

Ya cumplían (sin cambios): `src/components/modules/NavHeader.tsx` (D-37 de SPEC-118,
origen del patrón).

Test de regresión (`src/lib/role-visibility.test.tsx`): para `COMITE_VALIDACION` con
los 3 módulos concedidos, "Gestión" y "Auditoría" NO se pintan y "Bandeja"/"Apelaciones"
SÍ (justificado en el propio test: decisión D-41, no ablandamiento). Los tests del
proxy de ese mismo archivo (la puerta redirige al COMITE en gestion/auditoria) y los
journeys de aislamiento NO cambian: la puerta sigue bloqueando; solo cambia lo que se
pinta.

### Veredicto tras la D-41

```
[Arch:A] VERDE: puerta ≡ predicado en 1110 combinaciones (185 rutas × 6 roles).
[Arch:B] VERDE: 86 hrefs pintados evaluados, todos alcanzables (sin excepciones nuevas).
```

## Nota de oráculo: huérfanos reales = 4, no 3

El oráculo del brief citaba 3 huérfanos (Plan, Subscription, BillingCycle). La primera
generación real detectó que `RateLimit` también es huérfano por la definición mecánica
(tabla clave-valor de ventanas fijas, sin FK por diseño — verificado en
`prisma/schema.prisma:1008`). Según los Assumptions de la spec ("prevalece el conteo
real documentado con su fecha"), `RateLimit` se añadió a
`scripts/arch/excepciones.json` con justificación y fecha. Reportado a ZEUS como nota;
no es drift introducido por esta spec.

## Evidencia del quickstart (5 criterios)

- **AC-1** `npm run arch:check` en árbol limpio → **VERDE, exit 0**: 5 artefactos
  idénticos a lo commiteado; huérfanos solo los declarados; A y B en verde.
- **AC-2** (ejecutado de verdad): `model DriftPrueba` añadido al schema → **ROJO,
  exit 1** con las dos entradas esperadas — `(a) ROJO: 01-modelo-datos.md con drift` y
  `(b) ROJO: modelo huérfano NO declarado: DriftPrueba` (listado por nombre) —;
  `git checkout -- prisma/schema.prisma` → **VERDE, exit 0**.
- **AC-3** `npx tsx scripts/arch/asercion-puerta-predicado.ts` → **VERDE, exit 0**:
  1110 combinaciones alineadas; 122 divergencias del eje anónimo documentadas como nota
  (condición ZEUS 1: nunca son rojo).
- **AC-4** `npx tsx scripts/arch/asercion-menu-no-miente.ts` → **VERDE, exit 0**:
  86 hrefs pintados evaluados, todos alcanzables.
- **AC-5** `specs/126/spec.md` contiene "Impacto en arquitectura:" (línea 180);
  `AGENTS.md` incluye la regla "Antes de tocar `src/`, leer `docs/architecture/`"
  (Reglas de oro); `src/lib/specs-discipline.test.ts` exige la línea en specs ≥ 126
  (excepciones que solo encogen, tope duro 0) — 8/8 tests verdes.

## Gate de calidad

- `npx tsc --noEmit`: exit 0.
- `npm run lint`: 0 errores (1 warning preexistente ajeno: `IaModelSelector.tsx`).
- Tests tocados: `role-visibility.test.tsx` (17), `AdminNav.test.tsx` (3),
  `specs-discipline.test.ts` (8), `scripts/arch/*.test.ts` (18) — verdes.
- `npm run build` (con `rm -rf .next` previo): verde.
- Suite completa `npm run test`: verde (misma base que CI).

## Deuda técnica y notas para ZEUS

1. **`homeForRole` por defecto devuelve `/dashboard/admin` para PARENT**: un PARENT que
   pide una ruta admin-only rebota `/dashboard/admin/comite/gestion` → `/dashboard/admin`
   → `/` (dos redirects). Comportamiento preexistente de `proxy.ts` (no se toca, FR-010);
   queda documentado en `03-pantallas.md`. Candidato a decisión: home por defecto para
   PARENT debería ser `/dashboard` o `/`.
2. **Ejes de permisos NO reconciliados** (fuera de alcance por decisión de ZEUS): el eje
   `PermisoModulo` (BD) y el eje de rutas (proxy) se documentan por separado en
   `02-roles-capacidades.md`. El caso semilla: `COMITE_VALIDACION` conserva en seed los
   módulos `comite`/`comite_auditoria` cuyas rutas son admin-only (tras la D-41 ya no se
   pintan, pero el grant sigue existiendo).
3. **122 divergencias del eje anónimo** (sin sesión: la puerta exige login donde el
   predicado solo describe el menú): documentadas en `02-roles-capacidades.md`, nunca
   son rojo (condición ZEUS 1).
4. `IA_TABS` no entra en la aserción B (tabs por `key`, sin href): documentado en el
   informe de la aserción, no se salta en silencio.
5. `OperadoresSubNav`/`DashboardSubNav` resuelven el rol con `useAuth` (patrón NavHeader):
   durante la carga inicial de sesión sus tabs no se pintan (mismo comportamiento que
   los enlaces del header).
