# Implementation Plan: SPEC-334 · El Guardián (header + favicon)

**Branch**: `work/pi-SPEC-334-marca-guardian` | **Date**: 2026-08-31 | **Spec**: [spec.md](spec.md)

## Summary

Componente `Guardian` (SVG del brief §8) con tallas y estados, animación en `globals.css` (§8) que respeta reduced-motion, swap en `NavHeader` conservando `logoHref` (I-38), y `app/icon.svg` de favicon. Colores por tokens del sistema (`--pino/cielo/ambar-rgb`, ya con claro/oscuro).

## Cambios por archivo

- `src/components/ui/Guardian.tsx` (nuevo): SVG con máscara del niño + clip del barrido; `useId()` para ids únicos; props `variante` (viva/reducida/minima), `estado` (calma/alerta), `className`, `title`. Fills `rgb(var(--pino-rgb))` / `rgb(var(--cielo-rgb))` / `rgb(var(--ambar-rgb))`.
- `src/app/globals.css`: keyframes `pi-respirar`/`pi-barrido`/`pi-nodo` + clases `.pi-cuerpo`/`.pi-scan`/`.pi-nd` + `[data-estado="alerta"]` (1,3 s) + bloque `prefers-reduced-motion`.
- `src/components/modules/NavHeader.tsx`: `<Guardian className="h-8 w-8" />` en lugar del `span.accent-gradient > ShieldIcon`; `ShieldIcon` local eliminado (muerto). `logoHref`/`destinoLogo` SIN tocar (I-38).
- `src/app/icon.svg` (nuevo): talla mínima, tinta pino `#0B6E5A` (favicon Next.js).

## Tests
- `Guardian.test.tsx`: hueco del niño en toda talla · nodos 8/4/0 · ámbar sin rojo · ids únicos · aria-label.
- `nav-logo.test.ts` / `NavHeader.test.tsx`: I-38 y render del header intactos (no se tocan; deben seguir verdes).

## Verificación
`tsc·lint·tokens·arch·locks·ratchets` + `specs-discipline` + `test:unit`. Evidencia navegador (claro/oscuro + clic por rol) la captura el CEO/Calidad post-deploy.
