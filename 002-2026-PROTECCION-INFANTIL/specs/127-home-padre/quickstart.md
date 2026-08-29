# Quickstart: SPEC-127 — Home del padre

Verificación de los criterios de aceptación del instructivo 002-PI-043 que aplican a esta
spec. Ejecutar desde `002-2026-PROTECCION-INFANTIL/` tras implementar.

## Criterio 1 — PARENT redirigido a su home aterriza en /dashboard sin doble rebote

```bash
npx vitest run src/lib/proxy.test.ts
```

El test de regresión nuevo DEBE pasar y demostrar la cadena completa:
redirect de una ruta admin-only → `Location: /dashboard` → `proxy()` sobre `/dashboard`
con la misma sesión → permitido (sin segundo redirect).

## Criterio 2 — Suite completa + tsc + build verdes con proxy.ts tocado (D-36)

```bash
npm run test && npx tsc --noEmit && npm run build
```

Todo verde. Incluye `proxy-sesion-roles.test.ts` y `src/lib/e2e/journeys/aislamiento.test.ts`
(sin debilitar ninguna aserción).

## Criterio 4 — arch:check verde con artefactos regenerados

```bash
npx tsx scripts/arch/generar-pantallas.ts   # regenera 03-pantallas.md
npm run arch:check
```

- `docs/architecture/03-pantallas.md` muestra PARENT → `/dashboard` en la tabla home-por-rol.
- `arch:check` VERDE (drift cero, huérfanos, aserción A, aserción B).

## Criterio 5 — Aserciones A y B verdes, sin allowlist nueva

Cubiertas por `arch:check`. Verificar en la salida: aserción A (puerta ≡ predicado) VERDE
y aserción B (menú que no miente) VERDE, sin excepciones añadidas a `excepciones.json` ni
allowlists en los scripts de aserción.

## Verificación del candado

```bash
git diff pre-cola-043 -- src/lib/proxy.ts
```

El diff de `proxy.ts` DEBE limitarse a `homeForRole` (una línea + comentario). Cualquier
otro cambio en el archivo viola la excepción acotada (D-42).
