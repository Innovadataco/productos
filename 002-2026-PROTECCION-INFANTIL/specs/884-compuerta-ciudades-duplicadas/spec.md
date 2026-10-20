# SPEC-884 · Compuerta estructural contra ciudades duplicadas (I-364)

> Estado: IMPLEMENTADO (pendiente CI verde + revisión del CEO). Rama `work/pi-SPEC-884-compuerta-ciudades-duplicadas`.
> Radicado: CEO → Datos, 20-10-2026. Carril **Datos** + D-121 (CON migración, aditiva). Toca el MODELO (índice).

**Impacto en arquitectura:** agrega un índice `UNIQUE` **parcial** por SQL CRUDO sobre `Ciudad`
(`(paisId, departamentoId, nombreNormalizado) WHERE "esActivo"`, `NULLS NOT DISTINCT`). NO vive en
`schema.prisma` (Prisma no expresa `WHERE` ni `NULLS NOT DISTINCT`), como los índices trigram/HNSW; por eso
se declara en el guardián `scripts/verify-hnsw-indexes.ts` (`REQUIRED`) en el MISMO PR (regla AGENTS). Es
100% ADITIVO: no toca el índice de búsqueda `Ciudad_paisId_nombreNormalizado_idx` ni el schema. Suma un
corrector y un detector en `scripts/geo/` que REUSAN `calcularDesactivaciones` de SPEC-580.

## Problema (I-364)

El catálogo de ciudades se nutre de dos fuentes (seed viejo + import GeoNames). Variantes tilde/espacio del
MISMO municipio (p.ej. «Medellín»/«Medellin», «Bogotá»/«Bogotá  D.C.») entran como filas distintas: pasan el
`@@unique([nombre, paisId])` (nombre CRUDO distinto) pero son la misma ciudad. SPEC-580 saneó 37 pares a
mano; faltaba la COMPUERTA que impida reintroducirlos.

## Grano del duplicado (medido, no supuesto)

Un duplicado es **mismo `(paisId, departamentoId, nombreNormalizado)`** — tres columnas:

- **Medido en prod:** los 253 grupos con `nombreNormalizado` repetido dentro de un país abarcan TODOS
  departamentos DISTINTOS → son municipios legítimamente distintos (p.ej. «La Unión» en varios deptos). Un
  unique por `(paisId, norm)` los rechazaría → hay que AÑADIR `departamentoId`.
- **Pero no se puede quitar `paisId`:** ciudades de PAÍSES distintos con `departamentoId` NULL y la misma
  norma (p.ej. «Santiago» en CL, PA, DO) son legítimas; sin `paisId`, `NULLS NOT DISTINCT` las fusionaría
  (y reventaría hasta el seed del test). Mismo grano que usa el corrector (que reusa 580 particionando por
  país — dentro de un país el grano `(depto, norm)` de 580 ya es correcto).

## Fix (decisión CEO: A-plano parcial + corrector + guardián B)

1. **Migración** `20261020161100_spec884_ciudad_unique_parcial_pais_depto_norm` (raw, aditiva):
   `CREATE UNIQUE INDEX ... ("paisId","departamentoId","nombreNormalizado") NULLS NOT DISTINCT WHERE "esActivo"`.
   - `WHERE "esActivo"`: el invariante es entre ACTIVAS (búsqueda/registro filtran esActivo). SPEC-580
     resuelve dups por DESACTIVACIÓN (deja la perdedora viva, inactiva, con su norm colisionante) → un unique
     TOTAL las chocaría. El parcial coexiste con 580 y mantiene el corrector NO destructivo.
   - `NULLS NOT DISTINCT` (PG15+): cierra las 69 activas con `departamentoId` NULL (medido), igualando
     null==null SOLO dentro del mismo país.
2. **Corrector** `scripts/geo/normalizar-y-dedup-ciudades.ts` (dry-run/`--confirm`): re-normaliza
   (`nombreNormalizado := normalizarNombreGeografico(nombre)` donde difiere; cubre vacíos y stale) + dedup
   soft (desactiva, no borra) PARTICIONANDO por país y reusando `calcularDesactivaciones` de 580. Atómico
   POR FILA, exit≠0 si falla alguna. Deja el catálogo activo apto para el índice.
3. **Detector/guardián B** `scripts/geo/detectar-ciudades-duplicadas.ts` BLANDO, solo-lectura: cuenta
   dups por `(paisId, departamentoId, norm-canónica)` con la semántica del índice, + stale + vacíos, +
   `nullDeptoDup` (el caso a revisar). Es el preflight. exit 0 limpio / 1 sucio / 2 infra.
4. **Guardián estructural** `scripts/verify-hnsw-indexes.ts` (`REQUIRED` + chequeo de `predicado`): CI,
   deploy-prod.sh y pi-monitor verifican que el índice EXISTA, sea UNIQUE y conserve `NULLS NOT DISTINCT` +
   `esActivo` (un unique total/sin WHERE recreado por error NO pasa).

## D-121

CON migración, **ADITIVA y NO destructiva** (solo `CREATE UNIQUE INDEX`; no borra filas, columnas ni el
índice de búsqueda). `prisma migrate dev` es CIEGO a los índices parciales (WHERE) → no lo auto-borra; el
guardián cierra el hueco de todos modos. El **DEPLOY** del índice y las **CORRIDAS contra prod** (preflight
del detector + corrector si hay sucio) las hace el responsable APARTE del PR (la sesión del CEO tiene el
acceso de escritura a prod); el `CREATE UNIQUE INDEX` falla si el preflight/corrector no dejó el catálogo
limpio — esa es la red.

## Caveat para el preflight (los 69 null-depto)

`NULLS NOT DISTINCT` trata dos activas `(paisId, NULL, norm)` del MISMO país como duplicadas. Si entre las 69
activas con depto NULL hubiera municipios LEGÍTIMAMENTE distintos de un mismo país con la misma norma, el
índice los rechazaría. El preflight (`detectar-ciudades-duplicadas.ts`, campo `nullDeptoDup`) los expone; si
aparecen, se hace backfill del departamento o se acepta el hueco con `NULLS DISTINCT`.

## Candado (muere con el defecto)

`src/lib/geo/compuerta-ciudades-duplicadas.candado.test.ts` (integración + puro):
- DB: variante tilde activa en mismo (país,depto) → RECHAZADA (muere sin el índice); control positivo —
  distinto depto/país pasa, inactiva pasa (WHERE esActivo); null-depto×2 mismo país → RECHAZADA (NND).
- Puro: corrector (re-normaliza stale/vacío; dedup país-aware que no fusiona entre países pero sí dentro) y
  detector (cuenta dups por norma canónica, separa `nullDeptoDup`, no fusiona entre países).
