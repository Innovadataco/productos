# Plan de implementación — SPEC-234 · Padre v2 · Compilación técnica + Señal + Patrones N1 + Kit evidencia

## Objetivo

Entregar la capa de compilación técnica de expedientes padre: modelos de datos, servicio de compilación 100% SQL, detección de patrones N1, score parametrizado, generación de informe markdown/PDF con hash verificable, caché de señal comunitaria y worker de refresco, respetando DAL Q-3 y Ley 1581.

---

## Decisiones de diseño verificadas en fuente

### 1. Librería de PDF

**Decisión**: usar `pdfmake` (^0.3.11), ya dependencia del proyecto y usada en SPEC-140/SPEC-151.

**Justificación**: no se requiere nueva librería; `pdfmake` genera buffers deterministas si el contenido y metadatos son fijos. `@react-pdf/renderer` también está en `package.json`, pero `pdfmake` ya cubre PDFs institucionales y no requiere JSX en servidor.

**Ratificación ZEUS**: confirmar si prefiere `pdfmake` o desea evaluar `@react-pdf/renderer`.

### 2. Determinismo del hash SHA256

**Decisión**: el PDF incluye un timestamp de generación truncado a segundos (formato ISO Bogotá). En tests se inyecta el timestamp para garantizar reproducibilidad.

**Justificación**: si el timestamp cambia en cada generación, el hash cambia y no es reproducible. Truncar a segundos y pasarlo explícitamente en tests permite verificar el hash sin sacrificar la trazabilidad temporal.

**Alternativa descartada**: omitir timestamp del PDF; se descarta porque el kit evidencia N2 requiere constancia de cuándo se generó.

### 3. Worker de señal comunitaria

**Decisión**: servicio Docker separado `pi-senal-comunitaria` que hace polling simple contra una tabla de invalidaciones (`SenalComunitariaCache.invalidado = true` o `expiraEn < NOW()`), con advisory lock en PostgreSQL para evitar duplicados.

**Justificación**: la SPEC pide "event-based simple". Un polling con advisory lock es suficiente, no depende de pg-boss ni de notificaciones push, y se alinea con `pi-monitor` y `pi-simulador-abuso`.

**Alternativa descartada**: usar pg-boss para invalidación; se deja para SPEC-236 (Motor Notif) para no introducir acoplamiento.

### 4. Invalidación de caché

**Decisión**: la compilación, tras agregar un evento a un expediente, marcará como `invalidado = true` las filas de `SenalComunitariaCache` cuyo `identificadorHash` coincida con el del expediente. El worker detecta esas filas, recalcula y actualiza.

**Justificación**: mantiene la caché eventualmente consistente sin bloquear la escritura del evento. El worker usa `refresh_min` para limitar frecuencia de recálculo.

### 5. Cálculo de score

**Decisión**: fórmula lineal ponderada:

```
score = (numEventos * peso_num_reportes)
      + (peso_categorias_graves)
      + (aceleracionDetectada ? peso_aceleracion : 0)
      + (senalComunitaria.scoreComunitario * peso_senal_comunitaria)
```

Donde `peso_categorias_graves` suma `peso_categoria_grave` por cada evento cuya categoría esté en `padre.categorias_graves_json`.

**Justificación**: es parametrizable, reproducible y no requiere IA. Los umbrales `umbral_amarillo` y `umbral_rojo` definen el semáforo.

**Ratificación ZEUS**: validar si la fórmula debe incluir términos adicionales (por ejemplo, peso por progresión o multiplataforma) o si los patrones N1 solo aportan al informe textual.

### 6. Señal comunitaria: raw identifier vs hash

**Decisión**: `SenalComunitariaCache` almacena `identificadorHash` (SHA-256) en lugar del identificador en claro.

**Justificación**: cumple Ley 1581 y el candado de "solo agregados". La compilación calcula el hash a partir de `Expediente.identificadorReportado` y consulta la caché.

**Nota**: si ZEUS considera que el hash dificulta demasiado la query, se puede usar un identificador normalizado (teléfono E.164, nick lower-case); esto almacenaría PII en caché y requeriría revisión legal.

### 7. Almacenamiento de PDFs

**Decisión**: filesystem local en `/data/informes/[expedienteId]-v[version].pdf` dentro del contenedor `pi-app`.

**Justificación**: el instructivo especifica esa ruta. Se monta un volumen Docker (`pi_informes_storage`) para persistir entre deploys.

**Cambio en infraestructura**: añadir en `docker-compose.prod.yml`:

```yaml
volumes:
  - pi_informes_storage:/data/informes
```

y declarar el volumen global `pi_informes_storage`.

### 8. Relaciones inversas en `Expediente`

**Decisión**: añadir `informes InformeConsolidado[]` y `patrones PatronExpediente[]` en el modelo `Expediente` si ZEUS ratifica; de lo contrario consultar por FK.

**Justificación**: las relaciones inversas facilitan Prisma pero no son obligatorias para cumplir el alcance.

### 9. Endpoint `/api/publico/verificar-pdf/[hash]`

**Decisión**: ruta pública sin autenticación; aplica rate-limit `verificar_pdf` (30 req/min/IP). Devuelve 200 con `{ expedienteId, version, fechaGeneracion, vigenteHasta }` o 404.

**Justificación**: verificación pública de integridad sin exponer contenido sensible. Rate-limit evita enumeración.

### 10. Seed de parámetros

**Decisión**: añadir `seedParametrosSenalComunitaria()` en `prisma/seed.ts` con un único upsert de `padre.senal_comunitaria.refresh_min`.

**Justificación**: mantiene separado del seed de SPEC-230 y es idempotente. Si SPEC-230 ya mergeó, se puede integrar en `seedParametrosPadre()`.

---

## Fases de implementación

### Fase 1: Schema y migración aditiva

1. Añadir `enum TipoPatronExpediente`.
2. Añadir modelos `InformeConsolidado`, `SenalComunitariaCache`, `PatronExpediente`.
3. Añadir relaciones inversas en `Expediente` (si se ratifica).
4. Generar migración `npx prisma migrate dev --create-only --name padre_v2_compilacion_senal_patrones`.
5. Verificar que el SQL contiene solo `CREATE TYPE`, `CREATE TABLE`, `CREATE INDEX`; no `DROP` ni `RENAME`.

### Fase 2: Seed de parámetros

1. Añadir `seedParametrosSenalComunitaria()` en `prisma/seed.ts`.
2. Test idempotente en `src/lib/seed-senal-comunitaria.test.ts`.

### Fase 3: Repositorios DAL

1. `src/lib/dal/repositories/informe-consolidado-repository.ts`
   - `crearInforme(data)`
   - `listarPorExpediente(expedienteId, paginacion)`
   - `obtenerPorHash(hashSha256)`
2. `src/lib/dal/repositories/senal-comunitaria-repository.ts`
   - `obtenerORecalcular(identificadorHash, plataformaId, periodo)`
   - `invalidar(identificadorHash, plataformaId?)`
   - `obtenerPendientesDeRefresco(limite)`
   - `guardarCache(data)`
3. `src/lib/dal/repositories/patron-expediente-repository.ts`
   - `guardarPatrones(expedienteId, patrones[])`
   - `listarPorExpediente(expedienteId)`

### Fase 4: Servicio de compilación

1. `src/lib/expediente/compilacion/queries/agregar-categorias.ts`: query SQL que, dado un `expedienteId`, devuelve conteos de categorías y confianza promedio.
2. `src/lib/expediente/compilacion/queries/senal-comunitaria.ts`: consulta `SenalComunitariaCache` o la rellena inline si no existe/no es válida.
3. `src/lib/expediente/compilacion/reglas/`:
   - `aceleracion.ts`
   - `progresion.ts`
   - `perpetrador-serial.ts`
   - `multiplataforma.ts`
4. `src/lib/expediente/compilacion/score/calcular-score.ts`: fórmula parametrizada.
5. `src/lib/expediente/compilacion/template/renderizar-markdown.ts`: genera markdown §9.
6. `src/lib/expediente/compilacion/compilar-expediente.ts`: orquestador.

### Fase 5: Kit evidencia PDF

1. `src/lib/expediente/pdf/generar-pdf.ts`: recibe `InformeConsolidado` y devuelve `{ buffer, hashSha256 }`.
2. Persistencia en `/data/informes/[expedienteId]-v[version].pdf`.
3. Endpoint `GET /api/publico/verificar-pdf/[hash]/route.ts`.

### Fase 6: Worker

1. `scripts/worker-senal-comunitaria.mjs` con advisory lock.
2. Servicio `pi-senal-comunitaria` en `docker-compose.prod.yml` con `TZ=America/Bogota`.
3. Función `recalcularSenalComunitaria(identificadorHash, plataformaId, periodo)`.

### Fase 7: Tests

1. Tests de cada regla N1 con datasets sintéticos.
2. Tests de score VERDE/AMARILLO/ROJO.
3. Test idempotencia del seed.
4. Test query señal comunitaria.
5. Test snapshot del template markdown.
6. Test PDF hash reproducible.
7. Test esquema sin PII en `SenalComunitariaCache` y `PatronExpediente`.
8. Test endpoint `/api/publico/verificar-pdf/[hash]`.

### Fase 8: Documentación de cierre

1. Actualizar `spec.md` sección Implementación.
2. Crear `cierre.md` con evidencia de commits, gate y deuda técnica.
3. Actualizar `docs/architecture/01-modelo-datos.md` via `npm run arch:check`.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| SPEC-230 no mergeado en `feature/001-scaffolding` al hacer rebase | Documentar dependencia; si ocurre, coordinar con ZEUS/Fábrica 4 antes de continuar. |
| `pdfmake` no genera buffers idénticos por metadatos internos | Fijar metadatos (`creationDate`, `modDate`) al timestamp inyectado; validar con test de hash. |
| Query de señal comunitaria lenta | Límite de `periodo` mensual o `ALL` con índices; worker precalcula. |
| Almacenamiento de PDF no persistido en prod | Añadir volumen Docker antes del deploy. |
| Hash del identificador dificulta debugging | Logs nunca incluyen identificador ni hash; se usa solo para consulta interna. |

---

## Criterios de aceptación del plan

- [ ] ZEUS aprueba modelos, fórmula de score, estrategia de caché/invalidación y librería PDF.
- [ ] La migración es aditiva y no contiene `DROP`/`RENAME`.
- [ ] Los repositorios DAL respetan Q-3.
- [ ] No se toca `src/lib/ai/**`.
- [ ] No se implementa UI ni endpoints de padre/comité fuera del alcance.
