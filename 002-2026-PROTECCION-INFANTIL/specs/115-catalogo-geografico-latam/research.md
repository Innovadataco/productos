# Research — SPEC-115: Catálogo geográfico real LATAM

**Fecha**: 2026-07-29

## Fuente

GeoNames geographical database, dumps diarios por país:
`https://download.geonames.org/export/dump/{ISO2}.zip` (cada zip contiene `{ISO2}.txt`,
TSV de 19 columnas: geonameid, name, asciiname, alternatenames, latitude, longitude,
feature class, feature code, country code, cc2, admin1, admin2, admin3, admin4,
population, elevation, dem, timezone, modification date) y
`https://download.geonames.org/export/dump/admin1CodesASCII.txt` (código, nombre con
tildes, nombre ASCII, geonameid de la división admin1).

## Licencia

**Creative Commons Attribution 4.0 (CC-BY 4.0)** — obliga atribución. Implementación:
texto "Datos geográficos © GeoNames (https://www.geonames.org), CC-BY 4.0" en la página
de privacidad (`src/app/privacidad/page.tsx`) y en el pie del desplegable del buscador de
ciudades. Documentada aquí y en `cierre.md`.

## Volumen real medido (descarga del 2026-07-29)

Feature class `P` (lugares poblados) por país, y filas que cumplen la regla de importación
(sede administrativa PPLC/PPLA/PPLA2/PPLA3/PPLA4 **o** población > 0):

| País | P total | Regla (sede o pob>0) |
|------|--------:|---------------------:|
| MX | 300.361 | 123.494 |
| BR | 72.391 | 5.906 |
| PE | 47.492 | 11.851 |
| CO | 35.699 | 1.187 |
| BO | 25.804 | 246 |
| VE | 25.553 | 415 |
| GT | 16.981 | 342 |
| AR | 14.890 | 1.310 |
| PA | 13.267 | 2.514 |
| HN | 12.966 | 544 |
| EC | 11.458 | 543 |
| CL | 6.968 | 387 |
| PY | 6.863 | 204 |
| CR | 5.900 | 140 |
| SV | 4.888 | 102 |
| NI | 2.631 | 171 |
| UY | 1.089 | 173 |
| BZ | 528 | 218 |
| **Total** | **605.729** | **149.747** |

## Decisión de filtrado (alternativas evaluadas)

- **P completo (605.729)**: incluye veredas/caseríos/ranchos sin población registrada;
  ruido masivo en el buscador sin beneficio claro. Descartado.
- **Sede o población ≥ 500 (31.490)**: deja fuera municipios y localidades pequeñas (SV
  quedaría en ~102, CO perdería municipios con población GeoNames desactualizada).
  Descartado: contradice el objetivo ("un padre de municipio pequeño no encuentra el
  suyo").
- **Sede administrativa o población > 0 (149.747) — ELEGIDA**: cubre todas las sedes de
  división administrativa (municipios) aunque no tengan población registrada, más toda
  localidad con población conocida. El ruido se gestiona en el servidor: búsqueda con
  límite 20 ordenada por prefijo + población descendente.

## Limitaciones conocidas de la fuente

- Cobertura de población desigual: SV (~102), NI, CR, PY, BO, UY tienen pocas localidades
  con población > 0; en esos países el catálogo resultante es más delgado por la fuente,
  no por el importador. La opción "Otra ciudad o municipio" sigue disponible.
- Nombres duplicados exactos dentro de un país: se deduplica (sede > población) por la
  única `(nombre, paisId)` preexistente; los descartes se loguean.
- `admin1CodesASCII.txt`: la 2ª columna conserva tildes (p.ej. "Piauí", "Nariño"); algunos
  nombres traen sufijo " Department" (Colombia) que el importador recorta al casar con los
  departamentos existentes.

## Alternativas de fuente descartadas

- Lista curada a mano: es exactamente el problema actual (muestra simbólica).
- API externa en runtime (Nominatim/Google): viola la constitución (datos sensibles no
  salen del servidor; dependencia de terceros) y añade latencia/costo. La importación es
  batch, local y versionable.
