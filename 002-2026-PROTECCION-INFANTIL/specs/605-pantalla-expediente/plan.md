# Plan · SPEC-605 — Pantalla madre del EXPEDIENTE

**Status**: IMPLEMENTADO · **Spec**: [spec.md](./spec.md) · **Rama**: `work/pi-SPEC-605-pantalla-expediente`

## Contexto

SPEC-604 dejó el modelo: toda cadena del padre nace con expediente (`expediente-automatico.ts`), `Reporte.hijoId`, paso 0 en reportar. El diseño aprobado (`design/expediente-final-mockup.html` §1–§2) fija la pantalla madre con 5 bloques y la lista por urgencia. Sobre `main` ya existen las piezas de datos: «otros reportes» blindados en `cadenas-padre.ts` (SPEC-543 · I-330), la severidad por categoría en `riesgo-consulta.ts`, la lectura de hechos en `expediente-vivo.ts`, `TextoSensible` (tapado + step-up), `AgregarEvento` y el flujo `?expedienteId=` de profesionales (SPEC-428). Esta spec los compone en la pantalla definitiva.

## Decisiones

1. **Un solo servicio DAL nuevo** (`expediente-detalle.ts`) con tres lecturas del mismo modelo (lista por urgencia · detalle de 5 bloques · estado fresco). El identificador canónico es `Expediente.identificadorReportado`; los contadores mezclan propios (`eliminado: false`) y ajenos (aprobados + DUPLICADO, nunca SPAM/OTRO — mismo filtro que cadenas-padre).
2. **El «no míos» como OR explícito** (`usuarioId: null` o `≠ padre`): `NOT: { usuarioId }` sobre la columna nullable excluiría al anónimo por la lógica trivaluada de SQL — hallazgo cazado por el propio test de la spec (el anónimo ES señal, I-330).
3. **Urgencia = severidad de la categoría dominante** con la tabla `SEVERIDAD_CATEGORIA` (exportada de `riesgo-consulta.ts`: una sola fuente con la consulta pública). No se usa `scoreGravedadActual` (otro motor, otros insumos).
4. **Ajenos agrupados por (día Bogotá, categoría)** en la línea de tiempo: «2 familias más · Bogotá y Cali · contados como un solo evento agregado» (mockup). Propios individuales. Orden descendente por `fechaIncidente`; tendencia por `creadoEn` (últimos 7 días vs 7 previos).
5. **Menor resuelto en el servidor**: reporte propio más reciente con `hijoId`; fallback `IdentificadorHijo` activo (criterio de `lecturaDelExpediente`). Edad = año en curso − `anioNacimiento` (SPEC-604 US2).
6. **«Consultar estado» como subruta ligera** (`.../estado`), no como revival del `GET [id]` (borrado y candado por SPEC-340: devolvía texto). Solo estados y fechas.
7. **Pantalla vieja preservada en disco**: `ExpedienteVivo.tsx` deja de renderizarse; sus endpoints (`lectura`/`analisis`/`pdf`) y su test unitario siguen vivos. Reubicar mapa/informes es decisión de la siguiente ola (el mockup §2 no los incluye).
8. **Plataforma desde el reporte que abrió la cadena** (misma fuente que cadenas-padre): `Expediente.plataformaId` no tiene relación Prisma y convive como clave o id según el origen.

## Pasos (ver tasks.md)

1. DAL `expediente-detalle.ts` + export de `SEVERIDAD_CATEGORIA`.
2. Endpoint `GET /api/padre/expedientes/[id]/estado`.
3. `ExpedienteMadreClient.tsx` (5 bloques) + página `[id]` reescrita.
4. `ExpedientesListClient.tsx` reescrita (urgencia) + página lista reescrita.
5. Tests DTO (9) + endpoint (2).
6. Artefactos + README + gate.

## Riesgos y mitigaciones

- **Fuga de texto** → el DTO nunca selecciona contenido; candado en test: `JSON.stringify(detalle)` no contiene los textos sembrados (propio ni ajeno), igual que SPEC-543.
- **Contar de más a la comunidad** → `familias` deduplica `usuarioId` y suma 1 por anónimo; SPAM/OTRO fuera por el `isNot` de categoría (test de contraprueba).
- **`TextoSensible` tocado de más** → no se modificó una línea; SPEC-606 le cambia el step-up.
- **Candado SPEC-340 (`route.ts` de `[id]` inexistente)** → la subruta `estado/route.ts` no lo viola; el test del candado corre en el gate.
