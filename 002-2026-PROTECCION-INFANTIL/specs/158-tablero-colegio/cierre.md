# Cierre: SPEC-158 — Tablero de control del colegio

**Fecha**: 2026-08-03 · **Radicado**: 002-PI-058 (lote D-51) · **Spec**: [spec.md](./spec.md)

## Evidencia

- Commits en `work/002-pi-058`: `09b01ede` agregados · `f0a9a9cc` componentes ·
  `fb28e1f4` página + nav + artefactos arch.
- Checks de día (exit 0): `tsc` · `lint` · `tokens:check` (**1122** = piso) ·
  `arch:check` VERDE (88 hrefs; `02-roles-capacidades.md` y `03-pantallas.md`
  regenerados en el mismo commit por la ruta nueva).
- Tests nuevos (19) + área: 52 archivos / 226 tests verdes + journeys colegio 5 OK.

## Qué se entregó (FR → evidencia)

- FR-001: `/dashboard/colegio/tablero/` con los 4 bloques + nav "Tablero" (aserción
  B verde). La página vieja `/dashboard/colegio/estadisticas` intacta.
- FR-002/003: `tableroColegio(colegioId)` en UNA llamada (spies ×1 por método); el
  embudo cuenta reportes DISTINTOS por bucket de estado más pendiente — fixture
  mixto de 5 reportes → `{recibidos:5, cerrados:2, enRevision:1, teEsperan:2}` con
  aserción explícita de suma sin solapes.
- FR-004: reloj 24h SVG propio — `AT TIME ZONE 'UTC' AT TIME ZONE
  'America/Bogota'` (columna TIMESTAMP naive en UTC) con fallback documentado a
  UTC-5; reporte a las 02:00 UTC pica en la hora 21 (test); 24 posiciones con
  ceros; ventana pico circular de 6h determinística (cruza medianoche); vacío
  honesto.
- FR-005: ritmo mensual y barras por curso reusando las series/top existentes
  (métrica D2); barras en SVG propio con enlaces a la vista de curso.
- FR-006/007: A/B tenant en cada bloque; I-29 (solo conteos); cero color crudo.

## Decisiones de implementación (documentadas)

- "Te esperan a ti" destacado en **rubí** cuando > 0 (consistente con el semáforo
  de la home: alertas nuevas = actúa hoy), pino cuando 0; copy "Nada te espera —
  la vigilancia sigue activa".
- `nav-items.test.ts` no se tocó (es estructural, no fija la lista; pasa con el
  ítem nuevo).

## Deuda técnica

- La página vieja `/dashboard/colegio/estadisticas` convive con el tablero; una
  eventual consolidación es decisión de ZEUS (no inventada).
- El reloj asume `America/Bogota` fija (producto Colombia, sin DST);
  generalización por país queda fuera.
