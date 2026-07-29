# Plan — SPEC-115: Catálogo geográfico real LATAM y Centroamérica

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Spec**: [spec.md](./spec.md)

## Países (lista cerrada del alcance, ISO2)

MX, GT, BZ, SV, HN, NI, CR, PA (México + Centroamérica) y CO, VE, EC, PE, BR, BO, PY, CL,
AR, UY (Suramérica). Los países ya existentes en la base (CO, MX, AR, BR, CL, PE, EC, VE,
UY, PY, BO, CR, PA, GT, DO, HN, SV, NI) NO se pierden; DO queda fuera de la importación
pero se conserva intacto. BZ (Belice) es país nuevo en el catálogo.

**Nota para ZEUS**: la lista excluye el Caribe insular (CU, HT, PR, JM, DO…). DO ya está
sembrado y se conserva; si el producto quiere Caribe completo, basta añadir los ISO2 a
`PAISES_IMPORTAR` en `scripts/importar-geonames.ts` y re-ejecutar (idempotente).

## Respuesta 1 — Cómo se carga y se actualiza

Script idempotente `scripts/importar-geonames.ts`, ejecutable con:

```bash
node --env-file=.env --import tsx scripts/importar-geonames.ts
```

Flujo:

1. Descarga `https://download.geonames.org/export/dump/{ISO2}.zip` por país a caché local
   (`scripts/.geonames-cache/`, gitignored); reutiliza el zip si tiene < 7 días
   (`--force` fuerza descarga). También descarga `admin1CodesASCII.txt` (nombres de
   divisiones admin1 con tildes en la 2ª columna).
2. Valida cada dump (formato TSV de 19 columnas) ANTES de tocar la base; si un país falla,
   se omite ese país y se reporta, sin dejar la base a medias de ese país (se escribe por
   país en lotes transaccionales).
3. Filtra feature class `P` y (`feature code` ∈ {PPLC, PPLA, PPLA2, PPLA3, PPLA4} O
   población > 0). Volumen medido: ~150.000 filas en los 18 países (detalle en
   research.md).
4. UPSERT por clave estable **`geonameId`** (columna nueva, única): `INSERT … ON CONFLICT
   ("geonameId") DO UPDATE` en lotes de 1.000 vía SQL crudo (Prisma upsert fila a fila
   sería inmanejable para ~150k filas). El UPDATE no toca `nombre`/`paisId` para no
   chocar con la única `(nombre, paisId)`: solo refresca `lat`, `lng`, `poblacion`,
   `nombreNormalizado`, `departamentoId`, `esActivo`.

**Re-ejecución**: nada se duplica (conflicto por `geonameId` → update), nada se pierde
(nunca se borra; los IDs internos `cuid()` se conservan, por tanto las FK
`Reporte.ciudadId` intactas).

## Respuesta 2 — Qué ocurre con las 188 ciudades existentes

- **Se conservan todas** con su `id`. Antes de insertar, el importador carga las ciudades
  existentes y las casa por `pais.codigo + nombreNormalizado` contra las filas de
  GeoNames: la que casa se ENRIQUECE (`geonameId`, `lat`, `lng`, `poblacion`,
  `nombreNormalizado`, `departamentoId`) y su fila GeoNames no se inserta aparte.
- La que no casa (p.ej. "Río de Janeiro" con grafía distinta, ciudades legado de "Otra
  ciudad") queda intacta, sin coordenadas si no las tenía — y el mapa la cuenta en la
  degradación honesta (FR-006).
- Colisión exacta de nombre dentro de un país (varias localidades GeoNames con el mismo
  nombre): se conserva la sede administrativa (PPLA*/PPLC) o, en su defecto, la de mayor
  población; los descartes se cuentan y se loguean. Es la única "pérdida" aceptada:
  deriva de la única preexistente `(nombre, paisId)` que NO se toca (cambiarla rompería
  seed + 6 archivos de test que usan `nombre_paisId`).
- `Reporte.ciudad` (texto) y `Reporte.ciudadId` (FK) no se modifican en ningún caso.

## Respuesta 3 — Modelo de datos (migración aditiva)

Sobre `prisma/schema.prisma` (modelos `Pais`/`Departamento`/`Ciudad` existentes):

- `Ciudad`:
  - `geonameId Int? @unique` — clave estable del UPSERT.
  - `nombreNormalizado String @default("")` — NFD sin diacríticos, minúsculas
    (`src/lib/normalizar.ts`); índice GIN con `pg_trgm` para `ILIKE %…%` y btree
    `(paisId, nombreNormalizado)` para prefijos.
  - `poblacion Int?` — para ordenar resultados (prefijo primero, luego población desc).
- `Departamento`: se reutiliza `codigo String? @unique` (hoy NULL en Colombia) guardando
  el código GeoNames `{ISO2}.{admin1}` (p.ej. `CO.05`). El importador crea los
  departamentos que falten en los 18 países a partir de `admin1CodesASCII.txt`, casando
  primero por nombre normalizado con los 33 ya existentes de Colombia (solo les fija
  `codigo`). La cascada País→Departamento→Ciudad queda así disponible en todos los países.
- `Pais`: sin cambios de schema; el importador upserta por `codigo` (crea BZ).
- Migración: `CREATE EXTENSION IF NOT EXISTS pg_trgm` + columnas + índices. Todo aditivo.

## Respuesta 4 — Endpoint de búsqueda

`GET /api/ciudades/buscar?q=…&paisId=…&departamentoId=…&limit=20` en
`src/app/api/ciudades/buscar/route.ts`:

- **Público**: `/api/ciudades` ya está en `PUBLIC_ROUTES` del proxy (prefijo), sin auth.
- **Zod**: `q` string 2–100 chars (se normaliza igual que en importación), `paisId`
  requerido (cuid), `departamentoId` opcional, `limit` int 1–50 default 20.
- **Rate-limit**: scope nuevo `ciudades_buscar` (default 60 req / 60 s; configurable vía
  `ParametroSistema` `ratelimit.ciudades_buscar.*`, sembrado en seed).
- **Query** (SQL crudo): `WHERE paisId = $1 AND esActivo AND nombreNormalizado ILIKE
  '%'||$q||'%'` ordenado por `nombreNormalizado LIKE $q||'%' DESC` (prefijo primero),
  `poblacion DESC NULLS LAST`, `nombre ASC`, `LIMIT $n`. Devuelve
  `{ ciudades: [{ id, nombre, paisId, departamentoId, departamento, lat, lng }] }`
  (`departamento` = nombre, para desambiguar en la UI).
- **Índice justificado por volumen real**: ~150k filas; `ILIKE %…%` sin índice = seq scan
  + sort por cada tecla. Se crea extensión `pg_trgm` + índice GIN
  (`nombreNormalizado gin_trgm_ops`): búsquedas contains en ms sobre 150k filas. El btree
  `(paisId, nombreNormalizado)` cubre el orden por prefijo dentro de un país.

## Respuesta 5 — UI (buscador en los formularios de ubicación)

Componente nuevo `src/components/ui/CiudadSearchSelect.tsx` (combobox async):

- Input con debounce 300 ms → `GET /api/ciudades/buscar`; dropdown con
  "Nombre, Departamento"; selección devuelve `{ id, nombre }`; pie del dropdown con la
  atribución GeoNames (FR-007); estado vacío "Sin resultados"; ante error/429 muestra el
  estado vacío sin romper el formulario; opcionalmente muestra opción "Otra ciudad o
  municipio" (modo del wizard).
- `ReporteStepUbicacion.tsx`: País (select, igual) + `CiudadSearchSelect` + flujo "otra"
  intacto (input libre, se conserva el texto como hoy).
- `NuevoColegioPageClient.tsx`: cascada intacta; el `<select>` de ciudad se reemplaza por
  `CiudadSearchSelect` filtrado por `paisId` (+ `departamentoId` si hay); al cambiar
  país/departamento se resetea la ciudad como hoy.
- No se rediseña: mismos estilos `glass-input`, mismas props de formulario. Los tests del
  wizard se actualizan al nuevo control (interfaz cambia, comportamiento no).

## Respuesta 6 — Mapa (degradación honesta)

- `GET /api/estadisticas-publicas`: añade `sinUbicacion` = reportes aprobados con
  `ciudadId` NULL + los de ciudades sin `lat/lng` (se calcula sobre el mismo `groupBy`
  por ciudad + un `count` extra; agregado, sin datos personales).
- `MapaUbicaciones.tsx`: prop opcional `sinUbicacion?: number`; si > 0 muestra bajo el
  mapa "N reportes sin ubicación en el mapa" (mismo estilo del aviso de GeoJSON caído).
- `PublicDashboard.tsx`: pasa `sinUbicacion` al mapa. `ConsultaEnriquecidaClient.tsx`:
  cuenta las ubicaciones descartadas por falta de coords y las muestra con la misma prop.
- Nunca se pierde el dato de texto: la ciudad se sigue guardando y mostrando en listas;
  solo el mapa admite lo que no puede pintar.

## Riesgos y mitigaciones

- **Duplicados por nombre** → regla sede/población + log (Respuesta 2).
- **Volumen MX (123k)** → búsqueda en servidor con límite + índice GIN; ningún endpoint
  devuelve el catálogo completo a la UI (el `<select>` completo desaparece de los dos
  formularios).
- **Cobertura desigual de GeoNames** (SV ~102 con población) → limitación documentada; la
  opción "Otra ciudad" sigue existiendo.
- **pg_trgm no disponible** → la imagen `pgvector/pgvector:pg16` incluye contrib; la
  migración usa `CREATE EXTENSION IF NOT EXISTS`.
