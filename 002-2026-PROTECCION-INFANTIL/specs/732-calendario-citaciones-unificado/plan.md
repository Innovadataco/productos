# Plan · SPEC-732 · Un solo «Calendario» (publicar + responder)

## Estructura de PR

PR aparte, sobre main ya con SPEC-730 (sin apilar). Reusa la rejilla extraída en 730; no la vuelve a tocar.

## Pantalla / componente
- `CalendarioProfesional.tsx`: se retira el prop `modo`; el título es siempre «Calendario»; la tira «Esperando su respuesta · N por responder» lidera cuando `esperando.length > 0` (antes solo en `modo="citaciones"`). Publicar y responder ya viven en el mismo componente.
- `calendario/page.tsx`: monta el componente sin `modo`; descripción actualizada (publicar + responder).

## Menú y ruta
- `menu-por-estado.ts` + `nav-items.ts`: fuera la entrada «Citaciones».
- `citaciones/page.tsx`: stub de redirect PURO → `/calendario` (no 404, SPEC-723; sin compuerta porque no rinde, SPEC-711/571 mec. 4).

## Módulo de permiso (unificación)
- `seed-modulos-grants.ts`: `profesional_citaciones` fuera del grant PROFESIONAL.
- `permisos-catalogo.ts`: `profesional_citaciones` fuera del catálogo (si no, ADMIN —grant computado del catálogo— lo recibiría y quedaría solo-NAV, SPEC-496).
- APIs `solicitudes` (route + `[id]/confirmar` + `[id]/rechazar`): `assertModulo` pasa de `profesional_citaciones` a `profesional_calendario`.

## Candados
- Nuevo `calendario-unificado.candado.test.ts` (mutación-verificado).
- Ajustados: `menu-por-estado.candado` (labels sin Citaciones, OPERATIVAS 4→3), `guardia-habilitado.candado` (lista operativa sin citaciones + exención de stub de redirect puro), `menu.candado` (catálogo profesional 5→4).

## Preflight
`tsc` · `eslint` · `arch:check` (a–i) · `specs-discipline` · candados: calendario-unificado, menu, menu-por-estado, guardia-habilitado, permisos-modulo-sin-superficie, verificador-modulos, dashboard-profesional-forma, voz-usted-profesional, calendario (714). Sin tocar `specs/README.md`.

## Coordinación
- Diseño certifica contra el mockup del profesional (aviso «N por responder» + franjas ámbar + Confirmar/No puedo, ya caminado en el mockup nivel dios).
- Nota a Datos/CEO: grant/ModuloPermiso inerte de `profesional_citaciones` en BD viva = limpieza opcional por el carril de seed/scripts (no bloquea).
- CEO mergea (yo nunca).
