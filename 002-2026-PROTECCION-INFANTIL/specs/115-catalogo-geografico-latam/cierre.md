# Cierre — SPEC-115: Catálogo geográfico real LATAM y Centroamérica (bloque B1, cola 002-PI-041)

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA Y COMMITEADA, **SIN PUSH** (el coordinador empuja en serie) y **SIN DESPLEGAR** (Regla: el deploy lo decide el responsable).

## Lo hecho

- **Catálogo real (FR-001/FR-002)**: importador idempotente `scripts/importar-geonames.ts`
  (`node --env-file=.env --import tsx scripts/importar-geonames.ts [--force] [--paises=CO,MX]`).
  Fuente GeoNames (dumps por país + `admin1CodesASCII.txt`), filtro: feature class P
  (sedes PPLC/PPLA/PPLA2/PPLA3/PPLA4 o población > 0) **+ capa municipal canónica A.ADM2**
  (cubre municipios cuya sede GeoNames registra como PPLX con población 0 — p.ej. Girardot,
  Cundinamarca). UPSERT por `geonameId` único; enriquece las ciudades preexistentes que
  casan por nombre normalizado + país (incluye overrides en español para "Mexico City",
  "Guatemala City", "Panama City"); deduplica nombres exactos por país (sede > ADM2 >
  población) y loguea descartes. Nunca borra; los ids internos y las FK `Reporte.ciudadId`
  quedan intactos.
- **Migración 100% aditiva (FR-003)**: `20260729130000_catalogo_geografico_latam` —
  `Ciudad.geonameId` (único), `nombreNormalizado` (default ''), `poblacion`, índice btree
  `(paisId, nombreNormalizado)`, extensión `pg_trgm` + índice GIN trgm. Nada destructivo.
  Se conserva `@@unique([nombre, paisId])` (cambiarla rompía seed + 6 tests).
- **Departamentos en los 18 países**: `Departamento.codigo` (hoy NULL) guarda el código
  GeoNames `{ISO2}.{admin1}`; los 33 de Colombia se casaron por nombre normalizado (solo
  fijaron `codigo`, sin duplicarse); se crearon los de los demás países (33 → 351). La
  cascada País→Departamento→Ciudad queda disponible en todo el catálogo.
- **Búsqueda en el SERVIDOR (FR-004)**: `GET /api/ciudades/buscar?q=&paisId=&departamentoId=&limit=`
  público (el proxy ya cubre `/api/ciudades` por prefijo), Zod (q 2–100, limit 1–50,
  default 20), rate-limit scope `ciudades_buscar` (60 req/60 s, configurable vía
  `ParametroSistema`, sembrado en seed), SQL sobre `nombreNormalizado` con índice GIN
  (EXPLAIN: Bitmap Index Scan trgm, 0,38 ms en el catálogo real), orden prefijo →
  población → nombre. Headers de rate-limit también en el 200.
- **UI (FR-005)**: `src/components/ui/CiudadSearchSelect.tsx` (combobox async, debounce
  300 ms, dropdown "Nombre, Departamento", atribución GeoNames en el pie, degradación no
  bloqueante ante error/429). Integrado en `ReporteStepDetalle.tsx` (paso vivo del wizard
  de reporte; `ReporteStepUbicacion.tsx` es código muerto — verificado con grep, sin
  tocar) y en `NuevoColegioPageClient.tsx` (cascada País→Departamento→Ciudad intacta; el
  buscador filtra por departamento cuando hay). Flujo "Otra ciudad o municipio" intacto:
  el texto libre se conserva igual que antes (FR-008: `Reporte.ciudad` y FKs no se tocan).
- **Mapa honesto (FR-006)**: `/api/estadisticas-publicas` devuelve `sinUbicacion`
  (reportes aprobados sin ciudad o cuya ciudad no tiene coordenadas, sobre el predicado
  único `whereReporteAprobado`); `MapaUbicaciones` acepta la prop `sinUbicacion` y muestra
  "N reporte(s) sin ubicación en el mapa"; cableado en `PublicDashboard` y
  `ConsultaEnriquecidaClient`.
- **Atribución CC-BY 4.0 (FR-007)**: sección "7. Datos geográficos" en
  `src/app/privacidad/page.tsx` + pie del desplegable del buscador ("Datos geográficos:
  GeoNames (CC-BY 4.0)") + research.md.

## Carga REAL en la BD de desarrollo (puerto 5433)

| País | Antes | Después | Con coords |
|------|------:|--------:|-----------:|
| CO | 73 | 1.155 | 1.155 |
| MX | 8 | 68.433 | 68.433 |
| PE | 8 | 9.076 | 9.076 |
| BR | 8 | 5.536 | 5.536 |
| PA | 6 | 1.930 | 1.930 |
| AR | 8 | 1.703 | 1.703 |
| VE | 7 | 672 | 672 |
| GT | 6 | 669 | 669 |
| EC | 7 | 608 | 608 |
| HN | 6 | 541 | 541 |
| CL | 8 | 438 | 438 |
| PY | 6 | 361 | 361 |
| BO | 7 | 350 | 350 |
| NI | 6 | 309 | 309 |
| UY | 6 | 240 | 240 |
| BZ | 0 | 206 | 206 |
| CR | 6 | 169 | 169 |
| SV | 6 | 146 | 146 |
| DO (no importado, conservado) | 6 | 6 | 1 |
| **Total** | **187** | **92.548** | **92.540** |

- Antes: 187 ciudades, 39 con coordenadas (79% del mapa mudo). Después: **92.548, el
  99,99% con coordenadas**.
- **Idempotencia verificada**: 2ª y 3ª ejecución en CO — `insertadas=0 enriquecidas=0`,
  total estable 1.155 → 1.155. Re-ejecución completa (dump idéntico en caché): solo
  `sin_cambios`, 0 duplicados.
- Legado: las 187 ciudades preexistentes conservan su `id`; 72/73 de CO enriquecidas en la
  1ª pasada y Girardot (la 73ª) al añadir la capa ADM2 — 0 ciudades CO sin `geonameId`.
- Nota de dedupe: 53 filas ADM2 de CO se omiten en cada re-ejecución (`omitidas=53`)
  porque su nombre exacto ya existe como localidad P insertada en la 1ª pasada (transición
  de prioridad P→ADM2); comportamiento estable, sin duplicados ni pérdida.

## Pruebas

- `src/lib/normalizar.test.ts` (4): tildes, ñ→n, colapso de símbolos, idempotencia.
- `src/app/api/ciudades/buscar/route.test.ts` (7, integración): encuentra "Medellín"
  escribiendo "medellin" sin auth; prefijo gana a población; límite; filtro país y
  departamento; 400 con parámetros inválidos; rate-limit no rompe (headers presentes).
- `src/components/ui/CiudadSearchSelect.test.tsx` (6): debounce → llamada al servidor con
  q/paisId/departamentoId; no busca con <2 chars; onSelect; atribución + "Otra ciudad";
  degradación ante 429.
- `ReporteWizard.test.tsx`: actualizado al buscador (el comportamiento N-1/N+1 del texto
  se conserva intacto).
- `estadisticas-publicas/route.test.ts`: `sinUbicacion=1` con fixture determinista sin
  coordenadas (la BD de test conserva seed con coords; el fixture lo fuerza) y `0` en
  vacío. `PublicDashboard.test.tsx`: la prop llega al mapa.

## Gate (bajo candado /tmp/pi-gate-lock)

- `npx tsc --noEmit` ✅ 0 errores · `npm run lint` ✅ 0 errores (1 warning preexistente en
  `IaModelSelector.tsx`, ajeno) · tests tocados 31/31 ✅ · `npm run build` ✅ · suite
  completa `npm run test` (modo gate, `.env.test`): **1081/1082 ✅ (1 skipped, 0 fallos)**.
  Incidencia propia detectada y corregida en el camino: el test del endpoint asumía
  rate-limit activo, pero la suite corre con `DISABLE_RATE_LIMIT=true`; el archivo de test
  ahora lo habilita explícitamente para sí mismo (y lo restaura al salir).

## Con-vivencia y guardas

- **Sin push** (coordinador empuja en serie), **sin despliegue**, **sin tocar el motor**,
  **sin ablandar tests** (solo se actualizaron fixtures/interacciones por cambio de
  interfaz y se endureció el fixture de `sinUbicacion`), **migración aditiva**, **ciudades
  existentes intactas**.
- `specs/README.md` y `docs/cola-nocturna-041.md` NO tocados (los gestiona el coordinador).
  Si `src/lib/specs-discipline.test.ts` falla por esta carpeta sin indexar, es el fallo
  conocido del índice — lo resuelve el coordinador.
- Staging selectivo por rutas; `scripts/.geonames-cache/` gitignored.

## Deuda / notas para ZEUS

- **Cobertura GeoNames desigual**: SV (146), NI (309), CR (169), PY (361), UY (240) quedan
  delgados por la fuente (poca población registrada); "Otra ciudad" cubre el hueco.
- **`/api/ciudades` (lista completa) sigue vivo** para compatibilidad (tests, consumidores
  legado) pero la UI ya no lo usa; con MX=68k filas convendría caparlo o deprecarlo en otra
  spec (fuera de alcance).
- **`take: 50` preexistente** en el groupBy por ciudad de estadísticas públicas: con
  catálogo real, ciudades fuera del top-50 no se pintan ni cuentan en `sinUbicacion`.
  Métrica separada de la degradación por falta de coords; candidata a follow-up.
- **Caribe insular fuera del alcance** (CU, HT, PR, JM…): basta añadir ISO2 a
  `PAISES_IMPORTAR` y re-ejecutar (idempotente) si el producto lo decide.
- Seed geográfico manual de `prisma/seed.ts` conservado como catálogo mínimo offline; el
  importador lo enriquece (verificado) — si se quiere adelgazar el seed, otra spec.
- **Quickstart manual pendiente del deploy**: probar wizard /reportar con municipio
  pequeño (p.ej. Monguí) y el dashboard público tras el `dev-restart.sh` del coordinador.
