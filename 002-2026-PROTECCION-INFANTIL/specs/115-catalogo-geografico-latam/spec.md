# Feature Specification: Catálogo geográfico real LATAM y Centroamérica (SPEC-115, bloque B1 cola 002-PI-041)

**Feature Branch**: `feature/001-scaffolding` | **Date**: 2026-07-29 | **Status**: IMPLEMENTADO (sin push ni despliegue; verificación quickstart pendiente del deploy del coordinador)

## Contexto

Medido por ZEUS en la base: de 188 ciudades solo 39 tienen coordenadas. El catálogo es
muestra simbólica: Colombia con 73 municipios de ~1.100 y el resto de países con ~8
ciudades cada uno. Un padre de un municipio pequeño no encuentra el suyo al reportar y el
mapa público está mudo el 79% de las veces. **Un mapa que casi nunca muestra nada es peor
que no tener mapa.**

**Guardas**: migración Prisma SIEMPRE aditiva (nada de borrar ciudades existentes ni
romper FKs de reportes vivos); las 188 ciudades actuales y sus reportes NO se pierden ni
duplican; el dato de texto del reporte (`Reporte.ciudad` string) no se toca; búsqueda en
el SERVIDOR (nada de cargar miles de filas al navegador); degradación honesta del mapa;
atribución CC-BY 4.0 de GeoNames visible. Sin push, sin despliegue.

## User Stories

### US-1 (P1): Padre encuentra su municipio al reportar

Como padre de un municipio pequeño de LATAM, al reportar escribo el nombre de mi municipio
y lo encuentro en el buscador, para no tener que usar "Otra ciudad" ni abandonar el reporte.

**Acceptance Scenarios**

1. Un padre escribe "medellin" (sin tilde) en el buscador de ciudad y aparece "Medellín,
   Antioquia" entre los resultados.
2. Un padre de un municipio pequeño de Colombia (p.ej. "Monguí", "San Agustín") lo
   encuentra escribiendo su nombre.
3. Si el municipio no aparece, sigue disponible la opción "Otra ciudad o municipio" y el
   texto se conserva como hoy.

### US-2 (P1): Mapa público con cobertura real y honesta

Como visitante del dashboard público, el mapa muestra los reportes de la mayoría de
ciudades con coordenadas reales y, cuando una ciudad no tiene ubicación, el mapa lo dice,
para no asumir que no hay reportes.

**Acceptance Scenarios**

1. Una ciudad importada con coordenadas muestra su marcador con el conteo agregado.
2. Si existen N reportes cuya ciudad no tiene coordenadas, junto al mapa se lee
   "N reportes sin ubicación en el mapa".
3. Si no hay datos geográficos en absoluto, se mantiene el mensaje "Sin datos geográficos".

### US-3 (P2): Admin de colegio selecciona ubicación con cascada + buscador

Como ADMIN/SCHOOL_ADMIN que crea un colegio, mantengo la cascada País → Departamento →
Ciudad pero la ciudad se elige con buscador (no con una lista de miles de opciones).

**Acceptance Scenarios**

1. Al elegir país y departamento, el buscador de ciudad filtra dentro de ese departamento.
2. Sin departamento elegido, el buscador filtra por todo el país.

### US-4 (P2): Catálogo actualizable de forma idempotente

Como operador de la plataforma, ejecuto un script que descarga GeoNames y
inserta/actualiza el catálogo; al re-ejecutarlo nada se duplica y nada se pierde.

**Acceptance Scenarios**

1. Primera ejecución: Colombia pasa de ~73 a ~1.100+ ciudades con coordenadas.
2. Segunda ejecución inmediata: 0 inserciones nuevas (o solo cambios reales del dump), 0
   duplicados, FKs de reportes intactas.
3. Las ciudades preexistentes conservan su `id` y sus reportes asociados; las que casan
   con GeoNames quedan enriquecidas con coordenadas.

## Edge Cases

- Dos localidades del mismo país con el mismo nombre exacto: se conserva la sede
  administrativa o la de mayor población; el descarte se registra en el log del importador.
- Ciudad sin coordenadas (legado o "otra ciudad"): se guarda y se muestra como texto; el
  mapa la cuenta en "sin ubicación", no la oculta.
- Búsqueda con tildes/mayúsculas mezcladas: la normalización (NFD, sin diacríticos,
  minúsculas) hace que "Merida" encuentre "Mérida".
- GeoNames caído o dump corrupto: el importador falla sin tocar la base (descarga a caché
  y valida antes de escribir).
- Rate-limit del endpoint de búsqueda: teclear rápido no rompe la UI (debounce 300 ms; ante
  429 el buscador muestra estado vacío, no error bloqueante).

## Functional Requirements

- **FR-001**: El sistema DEBE importar los lugares poblados (feature class P de GeoNames:
  sedes administrativas PPLA/PPLA2/PPLA3/PPLA4/PPLC o población > 0) de MX, GT, BZ, SV,
  HN, NI, CR, PA, CO, VE, EC, PE, BR, BO, PY, CL, AR y UY, con lat/lng, población y
  división admin1. Los países existentes en la base (p.ej. DO) NO se pierden.
- **FR-002**: El importador DEBE ser idempotente con UPSERT por clave estable
  (`geonameId` único) y enriquecer (no duplicar) las ciudades preexistentes que casen por
  nombre normalizado + país.
- **FR-003**: La migración DEBE ser aditiva: columnas nuevas nullables o con default
  (`geonameId`, `nombreNormalizado`, `poblacion`, `codigo` de departamento), índices
  nuevos, extensión `pg_trgm`. Ninguna columna ni fila existente se elimina.
- **FR-004**: El sistema DEBE exponer `GET /api/ciudades/buscar?q=&paisId=&departamentoId=&limit=`
  público, validado con Zod, con rate-limit (scope `ciudades_buscar`) y límite de
  resultados (default 20, máx 50), buscando sobre nombre normalizado con índice.
- **FR-005**: Los formularios de ubicación (wizard de reporte y colegios/nuevo) DEBEN usar
  el buscador con debounce; la cascada País→Departamento→Ciudad se mantiene donde existe.
- **FR-006**: El mapa DEBE mostrar "N reportes sin ubicación en el mapa" cuando hay
  reportes cuya ciudad carece de coordenadas.
- **FR-007**: La atribución "Datos geográficos © GeoNames (CC-BY 4.0)" DEBE ser visible
  (página de privacidad y pie del buscador de ciudades).
- **FR-008**: El texto libre de ciudad (`Reporte.ciudad`) y las FK `ciudadId` de reportes
  vivos NO se modifican.

## Success Criteria

- **SC-001**: Colombia pasa de 73 a ~1.100+ ciudades con coordenadas; el total del
  catálogo supera las 100.000 localidades con lat/lng en los 18 países.
- **SC-002**: Re-ejecutar el importador no crea duplicados ni rompe FKs (conteo de
  ciudades estable, reportes apuntando a su ciudad).
- **SC-003**: El endpoint encuentra "Medellín" escribiendo "medellin", limita a 20 por
  defecto, respeta `paisId` y responde sin autenticación (tests).
- **SC-004**: El dashboard público muestra el conteo "sin ubicación" cuando aplica (test de
  componente o de endpoint).
- **SC-005**: Gate verde (tsc + lint + tests + build) bajo candado de cola nocturna.

## Assumptions

- GeoNames (https://download.geonames.org/export/dump/) es la fuente decidida por el
  coordinador; licencia CC-BY 4.0 que obliga atribución visible.
- La lista de países es exactamente la indicada (MX, GT, BZ, SV, HN, NI, CR, PA + CO, VE,
  EC, PE, BR, BO, PY, CL, AR, UY). Nota para ZEUS: DO, CU, PR, HT y demás Caribe quedan
  fuera por decisión del alcance (DO ya existe en la base y se conserva).
- GeoNames tiene cobertura de población desigual por país (p.ej. El Salvador ~102
  localidades con población > 0); se documenta como limitación de la fuente, no del
  importador.
