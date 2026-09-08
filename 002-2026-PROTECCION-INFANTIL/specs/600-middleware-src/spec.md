# SPEC-600 · middleware.ts en `src/` (Next no lo autodetectaba en la raíz)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: bug crítico en producción (VPS), diagnóstico del dueño. Rama `work/pi-SPEC-600-middleware-src`.

## Impacto en arquitectura: sí (acotado)

Corrige DÓNDE corre la capa de routing: con App Router en `src/`, Next.js ignora `middleware.ts` en la raíz y solo autodetecta `src/middleware.ts`. En producción `.next/server/middleware.js` no se generaba, así que el guard de sesión (SPEC-287), el candado de auth-screens (SPEC-588) y el CSP con nonce (E-6 P4c) NUNCA corrieron en el VPS — por eso el dueño aterrizaba en `/login` con sesión viva tras el OAuth. La implementación no se mueve ni cambia; se agrega el punto de entrada que Next sí reconoce, y un candado que frena la recaída. Línea base verificada con `npm run arch:check` en VERDE.

## El problema

El `middleware.ts` vivía en la raíz de PI. Next.js con `src/` directory NO reconoce middleware fuera de `src/`: tras el build en producción, `.next/server/middleware.js` NO existía. Los tests unitarios pasaban con falsa confianza porque importan el archivo de la raíz directamente — el runtime de Next jamás lo hacía. Síntoma en vivo: sesión creada (USER_CREATE + JWT vivos) y aterrizaje en `/login` mostrando el formulario.

## Alcance

- **Nuevo `src/middleware.ts`**: re-exporta `middleware` desde `../middleware` y declara `config` con el matcher como **literal en este archivo** — Next 16 analiza `config` estáticamente y NO reconoce uno re-exportado (warning + config default, que ejecutaría el guard también sobre assets estáticos). La lógica (guardianes, cookie `sesion_estado`, CSP con nonce) sigue en la raíz — los tests y la historia de SPEC-287/588 viven con esa ruta y NO se mueven. El candado asiente que el matcher de `src/` es idéntico al de la raíz (cero deriva).
- **Candado `src/middleware-ubicacion.candado.test.ts`**: asiente que `src/middleware.ts` existe, que re-exporta `middleware` (función) y `config` (objeto con matcher no vacío), y que es la MISMA referencia que la raíz (re-export, no copia).
- Sin cambios de comportamiento: matcher, guardianes y CSP intactos.

## Functional Requirements

- **FR-001**: El sistema DEBE exponer el middleware en `src/middleware.ts` (única ubicación que Next.js autodetecta con `src/` directory), re-exportando la implementación de la raíz.
- **FR-002**: El candado DEBE fallar si `src/middleware.ts` desaparece, deja de re-exportar `middleware`/`config`, o si su `config.matcher` queda vacío.
- **FR-003**: El build de producción DEBE generar el artefacto compilado del middleware (`.next/server/middleware.js` o equivalente de Next 16); verificación hecha en este PR con `rm -rf .next && npm run build`.

## Criterios de aceptación

- [x] `src/middleware.ts` existe: re-export nombrado de `middleware` + `config` con matcher literal (idéntico al de la raíz).
- [x] Candado nuevo en verde (3 tests) y agregado a `vitest.unit.includes.ts`.
- [x] **Build limpio (`rm -rf .next && npm run build`) compila el middleware**: `.next/server/middleware/` + `.next/server/middleware-manifest.json` existen, el manifest registra nuestro matcher exacto (`originalSource` = el patrón de la raíz, no el default) y el bundle edge contiene el código del guard (`sesion_estado`). Confirmado en este worktree. (En Next 16 el artefacto es el directorio `middleware/`, no `middleware.js`; la convención `middleware` además avisa deprecada a favor de `proxy`, informativa.)
- [x] `tsc --noEmit` verde; ESLint verde; `npm run test` verde; `npm run arch:check` verde.

## Implementación

- `src/middleware.ts` — punto de entrada que Next autodetecta: `export { middleware } from "../middleware"` + `config` con matcher literal (el re-export de `config` no lo reconoce Next 16).
- `src/middleware-ubicacion.candado.test.ts` — candado de ubicación/re-export; `vitest.unit.includes.ts` lo suma a los unitarios.

## Deuda / notas

- La raíz sigue siendo el archivo "real": cualquier mejora del guard va ahí, y este candado avisa si el puente de `src/` se rompe. Si en el futuro Next soportara raíz con `src/`, el candado obliga a una decisión explícita antes de borrar el puente.
- En el VPS hace falta redeploy para que el artefacto llegue a producción (el build local ya lo genera).
