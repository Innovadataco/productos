# Research: Oportunidades (evolución de Licitaciones)

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Fecha**: 2026-07-23
(redactado a posteriori el 2026-07-24, D-066)

Las decisiones de esta spec estaban argumentadas **dentro del plan** —que es inusualmente
explícito— pero sin artefacto propio. Este documento las extrae y añade las alternativas
descartadas, para que se puedan revisar sin leer el plan entero.

---

## D1 · Se conserva el identificador técnico `Licitacion`

La decisión de mayor consecuencia de la spec, y está **autorizada por SC-011**.

El negocio pidió renombrar "Licitación" → "Oportunidad". Se renombró **todo lo que ve el
usuario** y **nada** de lo interno: el modelo Prisma sigue siendo `Licitacion`, la tabla
`licitaciones`, las rutas `/api/licitaciones`.

| Alternativa | Por qué se descartó |
|---|---|
| Renombrar modelo, tabla y rutas | El foco del turno era **cero pérdida de datos** sobre una tabla viva con semilla. Renombrar multiplicaba el diff (cada `prisma.licitacion`, cada consumidor de la ruta) y el riesgo de migración, a cambio de una coherencia de nombres que **no ve nadie**. |
| **Renombrar solo lo visible** | El renombre que pidió el negocio es conceptual y de cara al usuario; eso se cumple entero. |

**Deuda asumida y declarada**: el vocabulario interno y el del negocio divergen. Quien lea el
código por primera vez verá "licitación" donde el producto dice "oportunidad". Es un coste de
comprensión permanente, aceptado a cambio de una migración segura.

## D2 · La obligatoriedad de campos es una propiedad del tipo, no un `if`

`numero` y `fechaApertura` dejan de ser obligatorios siempre. Su exigencia la fijan dos
banderas del catálogo (`exigeNumero`, `exigeFechaApertura`).

**Alternativa descartada**: `if (tipo.key === "licitacion-publica")`. Habría sido más corto y
habría violado §0.7 de la constitución: añadir un tipo nuevo exigiría tocar código. Con
banderas, el administrador crea un tipo y decide qué exige, sin desarrollo.

## D3 · Orden de la migración: crear → sembrar → backfill → relajar

Sobre datos vivos el orden **es** el diseño:

1. crear tablas y columnas (nullable o con default);
2. sembrar los 3 tipos;
3. `UPDATE licitaciones SET tipoId = <licitación pública>` donde faltara;
4. **después** relajar los `NOT NULL`.

Relajar antes del backfill habría dejado oportunidades sin tipo, sin señal de qué era
obligatorio. Ensayado en BD desechable con conteo antes/después (D-039).

## D4 · El `@@unique([numero, fechaApertura])` se conserva

Con ambas columnas nullable, Postgres permite múltiples `NULL`, así que la unicidad solo ata a
las oportunidades que tienen ambos —las licitaciones públicas—. Es exactamente el
comportamiento que se quiere, pero **por un detalle de Postgres, no por diseño explícito**: por
eso se documentó en el esquema (FR-006) en vez de dejarlo como coincidencia afortunada.

## D5 · El expediente NO pasa por el RAG

Los adjuntos de una oportunidad (PDF/Excel) **no** se extraen, ni se trocean, ni se vectorizan.
No son fuentes normativas: son papeles de un proceso comercial. Meterlos en Base Oficial
contaminaría el corpus del que salen las respuestas.

La frontera se blinda con un test: la ruta del expediente no puede tocar `DocumentoChunk`.

## D6 · La validación de subida se escribió bien aquí… y solo aquí

El expediente valida tipo, tamaño (413) y **sanea el nombre**. El plan anotó que
`POST /api/documents` —la puerta de Base Oficial— **no lo hacía**.

Ese apunte quedó como observación y no como tarea, y el hueco sobrevivió hasta que la auditoría
de la SPEC-009 lo encontró convertido en un riesgo de escritura fuera de `uploads/`. **Lección
para el proceso**: un hallazgo anotado en un plan y no convertido en tarea es un hallazgo
perdido.

---

## Lo que sigue abierto

- **Divergencia de vocabulario** (D1): interno `Licitacion`, negocio "Oportunidad".
- **Reglas de transición entre estados**: fuera de alcance aquí y en SPEC-007.
