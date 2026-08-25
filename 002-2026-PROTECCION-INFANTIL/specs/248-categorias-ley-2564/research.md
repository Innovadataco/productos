# Research: SPEC-248 — Categorías Ley 2564 completas + Definiciones legales editables

Sin incógnitas técnicas abiertas: la SPEC replica un patrón ya probado en producción (SPEC-195/199). Este documento deja constancia de lo verificado, no de una exploración de alternativas.

## 1. Migración aditiva de enum en Postgres 16

**Decisión**: `ALTER TYPE "CategoriaConducta" ADD VALUE IF NOT EXISTS '<valor>';` (una sentencia por valor), sin `DROP TYPE` ni `CREATE TYPE`.

**Verificado**: `docker-compose.yml` usa `pgvector/pgvector:pg16` → Postgres 16. Desde Postgres 12, `ALTER TYPE ... ADD VALUE` corre sin bloquear lecturas/escrituras concurrentes sobre tablas que usan el tipo (antes de la 12 requería estar fuera de una transacción explícita y sí generaba más fricción). Riesgo residual: `ADD VALUE` no puede ejecutarse dentro de la misma transacción que luego usa el valor nuevo en un `INSERT`/`UPDATE` — no aplica aquí porque el seed corre en un paso posterior (migración y seed son procesos separados en este proyecto).

**Alternativas descartadas**: tabla de catálogo (`CategoriaConducta` como tabla FK en vez de enum) — reescribiría el modelo de datos completo, fuera de alcance y contradice "todo aditivo" / D-72.

## 2. Dónde vive la lógica de "leer `ia.rubrica.definiciones` con fallback"

**Decisión**: inline en cada route handler (`GET /rubrica`, `GET /rubrica/definiciones`, `PATCH /rubrica/definiciones/[categoria]`), usando `getParametroSistema()` (ya existe en `src/lib/parametros.ts`, fuera del candado de motor IA) + fallback a `DEFINICIONES_CATEGORIA` (constante en `rubrica-semilla.ts`).

**Por qué no en `src/lib/ai/rubrica.ts`**: es el único archivo del motor IA marcado INTOCABLE además de `rubrica-semilla.ts`. Tocarlo dispararía el candado ("cualquier otro archivo bajo `src/lib/ai/**` sigue INTOCABLE... si detectas la necesidad de tocar otro → HALLAZGO + PARA"). Se confirmó que es evitable: `cargarConfigRubrica()` no necesita saber de `definiciones` porque el motor de clasificación (embudo + voto) no las usa — son metadata para el editor admin, no entran al prompt.

**Por qué no un archivo nuevo bajo `src/lib/ai/`**: el candado autoriza "esta SPEC está autorizada a modificar `rubrica-semilla.ts` y SOLO ese archivo del motor IA" — un archivo nuevo en la misma carpeta es la letra, no solo el espíritu, de lo que el candado restringe.

## 3. Precedente para el nuevo valor de `AccionAudit`

**Verificado**: SPEC-239 (`ContactoEmergencia`, ya `IMPLEMENTADO`) agregó 4 valores nuevos a `AccionAudit` (`CONTACTO_EMERGENCIA_CREADO/_ACTUALIZADO/_ELIMINADO/_FALLBACK_USADO`) en su propia migración aditiva, sin que el instructivo original de esa SPEC lo mencionara como candado explícito — es la convención vigente del proyecto para acciones de dominio genuinamente nuevas. `PATCH /api/config/parametros/[clave]` y `PATCH /api/admin/ia/rubrica/preguntas` (edición de la rúbrica de preguntas, ya existente) sí reutilizan el valor genérico `PARAM_UPDATE`. Se prefiere un valor específico (`RUBRICA_DEFINICION_UPDATE`) siguiendo el pedido explícito del instructivo y el precedente SPEC-239, documentado como Decisión 2 en `plan.md` para que ZEUS lo audite en la compuerta.

## 4. Seed idempotente con excepción documentada (SPEC-199)

**Verificado en `prisma/seed.ts` línea ~2367**: el bloque `rubricaParams` ya implementa el patrón exacto: `upsert` con `update` condicional — si la clave es `ia.rubrica.preguntas`, fuerza `{ valor, descripcion }` (comentario inline citando SPEC-199); para el resto, `update: {}`. Este mismo `if` se extiende con el bloque de `ia.rubrica.definiciones` (idempotente-respetuoso, NO forzado — a diferencia de `preguntas`, las definiciones legales editadas por el CEO/comité no deben perderse en cada deploy).

## 5. Grupos comerciales (`ui.grupos_categoria`)

**Verificado**: el parámetro ya existe en producción con una agrupación propia del CEO (5 grupos), distinta de la propuesta en el brief §5.6 (9 grupos estilo Ley 2564). El seed actual usa `update: {}` (crea solo si falta). Se mantiene ese comportamiento sin modificarlo — las 3 categorías nuevas no aparecen automáticamente en ningún grupo comercial existente; el CEO las asigna manualmente desde `/admin/configuracion` si lo desea (fuera de alcance de esta SPEC, documentado en plan.md Decisión 3).
