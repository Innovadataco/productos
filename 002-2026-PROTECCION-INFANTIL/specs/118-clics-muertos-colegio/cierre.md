# Cierre — Spec 118: Clics muertos del colegio (D-37)

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA Y COMMITEADA, **SIN push y SIN DESPLEGAR** (cola nocturna 002-PI-041, bloque B4: el coordinador empuja en serie y gatea el deploy).

## Lo hecho

- **Causa (a) — logo**: el proxy ya no rebota al `SCHOOL_ADMIN` desde el área
  pública de solo lectura. `esRutaPermitidaSchoolAdmin` (`src/lib/proxy.ts:76`)
  permite ahora `/`, `/dashboard-publico`, `/seguimiento`
  (`PUBLICAS_LECTURA_SCHOOL_ADMIN`, `src/lib/proxy.ts:50`) y las APIs públicas de
  solo lectura que esas pantallas consumen (`APIS_LECTURA_SCHOOL_ADMIN`,
  `src/lib/proxy.ts:59`): `/api/consulta` (formulario del home), `/api/estadisticas-publicas`
  (dashboard público) y `/api/reportes/seguimiento` (seguimiento). `/consulta` no
  existe como página (la consulta vive en el home): su superficie real es la API.
  **Sigue cerrado**: `/dashboard/admin`, `/api/admin/*`, `/dashboard`,
  `/mis-reportes`, `/reportar` y `/api/reportes` (su POST crea reportes: solo se
  abrió el sub-árbol de seguimiento, GET). Helper `matchesRoute`
  (`src/lib/proxy.ts:61`) con igualdad exacta para `/`: la raíz no abre el árbol.
- **Causa (b) — botón "Dashboard" + regla generalizada D-37**: helper
  `esEnlaceNavegable` (`src/components/modules/NavHeader.tsx:95`) =
  `href !== pathname && esDestinoPermitidoPorRol(rol, href)` (misma fuente de
  verdad del proxy, SPEC-113). Aplicado a TODOS los enlaces del header para TODOS
  los roles: botón "Dashboard" (desktop y móvil), menú de usuario (incl. Cambiar
  contraseña), menú móvil e "Iniciar sesión". Un enlace a la página actual o a un
  destino bloqueado simplemente no se ofrece. Excepción deliberada y documentada:
  el logo en `/` (la marca siempre se muestra; convención universal).

## Cambio de comportamiento (justificación — NO ablandamiento)

Decisión de producto NUEVA y explícita (ZEUS/D-37, enunciado del bloque B4): el
aislamiento total del colegio no aportaba seguridad (las estadísticas públicas son
visibles incluso sin sesión) y generaba clics muertos. Tests actualizados para
reflejarla, con comentarios de justificación in situ:

- `src/lib/proxy.test.ts`: `esRutaPermitidaSchoolAdmin("/")` pasa de `false` a
  `true`; nuevos casos de rutas/APIs abiertas y de la superficie que sigue cerrada.
- `src/lib/e2e/journeys/aislamiento.test.ts`: la matriz menú=proxy añade las rutas
  públicas de lectura como PERMITIDAS para `SCHOOL_ADMIN`; `CASOS_BLOQUEO` suma
  `/api/reportes` (crear reportes sigue vedado); nuevo test dedicado SPEC-118.
- `src/lib/e2e/journeys/sesion-roles.test.tsx`: aserción por propiedad — en el home
  de cada uno de los 5 roles, ningún enlace visible del header apunta al pathname
  actual ni a un destino que el proxy bloquea.
- `src/components/modules/NavHeader.test.tsx`: D-37 — "Dashboard" no se ofrece en
  su propia página destino (colegio, padre, anónimo) y sí fuera de ella; el menú de
  usuario no ofrece la página actual.

## Pruebas (rojo → verde)

- ROJO confirmado antes de implementar (`proxy.test.ts` + `NavHeader.test.tsx`):
  6 tests fallando — proxy ×2 (rutas públicas de lectura y sus APIs aún cerradas)
  y header ×4 (botón "Dashboard" ofrecido en su propia página destino para colegio,
  padre y anónimo; "Mi colegio" ofrecido estando en `/dashboard/colegio`).
- Verde: `proxy.test.ts` + `NavHeader.test.tsx` + `src/lib/e2e` entera: **49/49
  tests en 9 archivos** (1 archivo del motor lento skipped, preexistente).

## Gate (bajo candado `/tmp/pi-gate-lock`)

- `npx tsc --noEmit` ✅
- `npm run lint` ✅ (0 errores; 1 warning preexistente en `IaModelSelector.tsx`, ajeno)
- Tests tocados + `src/lib/e2e` ✅ (49/49 en 9 archivos; motor lento skipped, preexistente)
- `npm run test` (suite entera) ✅ **1020/1022** — el único fallo es el sancionado
  por la cola: `specs-discipline.test.ts` (índice `specs/README.md`) por las carpetas
  sin indexar `116-vista-padre-sin-tecnico`, `118-clics-muertos-colegio` y
  `120-smoke-prod-safe` (de tres agentes del bloque; el README lo indexa el coordinador).
- `npm run build` ✅

## Nota de convivencia (cola 002-PI-041)

`specs/README.md` NO se tocó (regla del bloque). Por eso
`src/lib/specs-discipline.test.ts` ("el índice specs/README.md cubre todas las
carpetas reales") falla con `118-clics-muertos-colegio` sin indexar hasta que el
coordinador la indexe (en el mismo fallo aparecen las carpetas 116 y 120 de otros
agentes del bloque). Es el único fallo de la suite entera y es esperado.

## Despliegue — DIFERIDO

Sin push y sin deploy (guardas del bloque). El coordinador empuja en serie y
despliega con `./scripts/dev-restart.sh`. Validación interina = gate verde +
revisión del diff por ZEUS.

## Deuda / observaciones para ZEUS

- Los enlaces legales del footer (`LandingFooter` → `/privacidad`, `/terminos`)
  siguen cerrados para el `SCHOOL_ADMIN` (la decisión cerrada abrió solo las 4
  rutas listadas). Si se quiere cubrir también ese clic, abrir esas dos rutas de
  solo lectura en una spec futura.
- `/consulta` no tiene página: si algún día se crea, hay que añadirla a
  `PUBLICAS_LECTURA_SCHOOL_ADMIN` (una línea + test).
