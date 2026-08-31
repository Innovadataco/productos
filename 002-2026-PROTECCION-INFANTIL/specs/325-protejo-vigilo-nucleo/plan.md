# SPEC-325 · plan.md · A quién protejo, a quién vigilo (núcleo)

> Compuerta §4: este plan se entrega y **PARA**. Fábrica PI-1 revisa el modelo `Hijo`, el mecanismo
> compartido y el caso dos-padres-un-niño antes de `tasks`/`implement`.

## A · El mecanismo compartido (lo que NO se puede duplicar)

### A.1 · Una sola función de normalización
`src/lib/dal/identificadores/normalizar.ts` (módulo nuevo, sin dependencias de dominio):
```ts
export function normalizarIdentificador(valor: string): string {
  return valor.trim().toLowerCase();
}
```
- **Único lugar** donde se decide la forma canónica. Todo lo demás la importa.
- Regla mínima = `trim` + `toLowerCase` (cubre el defecto `TioJuan1`⟷`tiojuan1`). No se agrega regla por-plataforma en el núcleo (si más adelante hace falta, se amplía esta función, no se crea otra).

### A.2 · Puntos de escritura que la usan (todas las tablas que alimentan el cruce)
| callsite | acción |
|---|---|
| `contactos-mutaciones.ts` (guardado de `IdentificadorContacto`, hoy `:41` persiste crudo) | persistir `normalizarIdentificador(valor)` |
| escritura de `IdentificadorHijo` (nuevo) | persistir `normalizarIdentificador(valor)` |
| `identificador-reportado.ts:77` (`upsertIncrementoReporte`, ingesta del agregado) | normalizar `identificador` antes del `where`/`create` |
| creación de `Reporte.identificador` (verificar el service de creación de reporte en `tasks`) | normalizar en el mismo punto |

### A.3 · El cruce (12 callsites) compara normalizado-contra-normalizado
- Como ambos lados quedan normalizados **en escritura**, los 12 callsites del inventario (spec §mecanismo) siguen usando `whereReportesCirculo` **sin cambiar su forma** — pero los `valores` que arman salen de columnas ya normalizadas, y `identificadorReportado`/`Reporte.identificador` ya están normalizados. Se añade un test por cada familia de callsite que afirme el cruce case-insensitive.
- **Defensa en profundidad (a decidir en PARA):** además, normalizar la lista `valores` en el punto donde se construye (una sola línea `.map(normalizarIdentificador)`), por si entra un valor legacy. Propuesta: SÍ, es barato y cierra el riesgo de datos viejos.

### A.4 · Backfill de datos existentes (migración aditiva)
- Migración schema-to-schema con `UPDATE "IdentificadorContacto" SET valor = lower(trim(valor))` y el equivalente para `IdentificadorReportado.identificador` y `Reporte.identificador`. **Idempotente.** Se corre en la migración, no en runtime.
- ⚠️ **Riesgo a revisar en PARA:** el backfill puede crear colisiones que violen un unique nuevo (dos valores que solo diferían en case). Estrategia: normalizar primero, deduplicar colisiones (conservar el más reciente / mergear agregados), luego aplicar el unique. Lo detallo en `tasks` con conteo previo.

## B · Modelo `Hijo` (protejo · §3.1)

```prisma
model Hijo {
  id              String   @id @default(cuid())
  nombre          String
  apellidos       String   @default("")
  documentoTipo   String   // set cerrado en Zod: RC|TI|CC|CE|PASAPORTE|OTRO (OBLIGATORIO)
  documentoNumero String   // OBLIGATORIO
  edad            Int?
  sexo            String?  // set cerrado en Zod
  creadoEn        DateTime @default(now())
  actualizadoEn   DateTime @updatedAt

  padres          HijoPadre[]
  identificadores IdentificadorHijo[]

  @@unique([documentoTipo, documentoNumero])   // detección dos-padres-un-niño
  @@index([documentoTipo, documentoNumero])
}

model HijoPadre {
  id        String  @id @default(cuid())
  hijoId    String
  usuarioId String
  creadoEn  DateTime @default(now())
  hijo      Hijo    @relation(fields: [hijoId], references: [id], onDelete: Cascade)
  usuario   Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  @@unique([hijoId, usuarioId])
  @@index([usuarioId])
}

model IdentificadorHijo {
  id            String  @id @default(cuid())
  hijoId        String
  valor         String  // guardado normalizado (normalizarIdentificador)
  tipo          String?
  plataformaId  String?
  activo        Boolean @default(true)
  // vinculación por-padre (quitar = desvincular de la vista de quien lo quita, sin borrar)
  vinculadoPor  String? // usuarioId que lo agregó (para la regla de "quitar solo desvincula")
  creadoEn      DateTime @default(now())
  actualizadoEn DateTime @updatedAt
  hijo          Hijo        @relation(fields: [hijoId], references: [id], onDelete: Cascade)
  plataforma    Plataforma? @relation(fields: [plataformaId], references: [id])
  @@index([valor])
  @@index([hijoId, activo])
}
```
- **PII (patrón `Estudiante`):** acceso solo por padre dueño (vía `HijoPadre`), nunca por id suelto en URL, sin logs con documento en claro. Zod cierra `documentoTipo`/`sexo`.
- **Dos-padres-un-niño:** `@@unique([documentoTipo,documentoNumero])`. Al crear, si el documento existe → se crea `HijoPadre` para el 2º padre sobre el `Hijo` existente (no se duplica). Datos e identificadores del niño = compartidos. **Reportes/expediente/alertas siguen su ruta propia por `usuarioId`** (privados), salvo la alerta que va a los dos padres del `Hijo`.
- **Conflicto de edición (propuesta CEO, la implemento salvo veto en PARA):** quitar un identificador NO borra la fila; marca la desvinculación para ese `usuarioId` (campo/relación de desvinculación por-padre). Detalle exacto de la tabla de desvinculación lo cierro en `tasks` — **es punto de PARA**.

## C · `ContactoConfianza` (vigilo · §3.3)

- **Migración aditiva:** `+ nombre String?` (o requerido en Zod, columna nullable para no romper filas viejas), `+ parentesco String?`. `etiqueta` se conserva (compat) o se migra a `nombre` — **decisión de PARA**.
- **`nota`:** exponerla en la vista de detalle (lectura+edición). Propuesta: mantener la columna, hacerla visible. Alternativa (quitarla) = migración destructiva → NO en núcleo.
- **`tipo` de `IdentificadorContacto`:** definir set (misma lista de plataformas/tipo de identificador) o quitar de la UI. Propuesta: reutilizar `plataformaId` como el "tipo" real y ocultar `tipo` decorativo.
- **Gestión completa (backend ya parcial):**
  - editar contacto: existe (`contactos-mutaciones.ts` update).
  - activar/inactivar contacto e identificador suelto: backend `:167-172` ya lo soporta → **falta UI**.
  - **borrar contacto:** hoy `grep DELETE` en `src/app/api/circulo-confianza/**` = cero → agregar endpoint DELETE + service (baja lógica `activo=false` o hard-delete — propuesta: baja lógica, consistente con `AcudienteEstudiante`).
- **Unicidad ampliada:** cambiar `@@unique([contactoId,valor,plataformaId])` (`:1942`) → unicidad por **padre** (`usuarioId,valor,plataformaId`). Como `IdentificadorContacto` no tiene `usuarioId`, se resuelve con índice compuesto vía `contacto.usuarioId` (unique parcial o validación en service con warn+override). **Propuesta:** validación en service (warn+override, dice a quién pertenece) + índice no-único para performance; el unique duro a nivel BD se evalúa en PARA por el costo del backfill (A.4).

## D · Copy (§3.4) y componentes muertos (§3.5)
- Copy de padre en la sección (A-62), no literal.
- `SemaforoCirculo.tsx` + APIs semaforo/timeline: **evaluar en `tasks`** si las vistas nuevas de protejo/vigilo los consumen. Propuesta preliminar: el semáforo encaja en la vista de "vigilo"; si se conecta, se conserva; el timeline se revisa por consumidor real. Si ninguno sirve → borrar (candado: código muerto que aparenta función).

## E · Capas (orden de implementación · tras REVISO)
1. `normalizarIdentificador` + tests (US3 · el fix, primero, aislado).
2. Migración Prisma aditiva (`Hijo`, `HijoPadre`, `IdentificadorHijo`, campos `ContactoConfianza`, unique ampliado) + backfill normalizador. Schema-to-schema.
3. DAL repos/services de `Hijo` (patrón `Estudiante`) + ajustes `ContactoConfianza` (nombre/parentesco/DELETE/activar-identificador).
4. API routes `/api/padre/hijos/**` + ampliación `/api/circulo-confianza/**` (DELETE, activar identificador).
5. UI padre: sección "A quién protejo" + arreglo "A quién vigilo" (copy A-62).
6. Cablear/borrar componentes muertos.
7. Tests (candado 24 v2): unidad de normalización, cruce case-insensitive por familia de callsite, dos-padres-un-niño, warn+override, PII acceso-solo-dueño.

## F · Gate local (antes de REALIZADO)
```
TZ=America/Bogota date
npm ci                         # cliente propio, no symlink
npx prisma migrate diff ...    # schema-to-schema, NO migrate dev sobre DB compartida
npm run typecheck && npm run lint
npm run test -- <suites tocadas>
npx vitest run specs-discipline.test.ts
# + fila en specs/README.md + Status del catálogo + Impacto en arquitectura real
```
Turno de builds: 4 devs · aviso 1 línea antes de suite pesada · prod del motor PI tiene prioridad.

## G · Preguntas de diseño para PARA (las que revisa Fábrica PI-1)
1. **Desvinculación por-padre de identificador de `Hijo`** (conflicto de edición): ¿tabla puente de desvinculación (`IdentificadorHijoDesvinculado(identificadorId,usuarioId)`) o campo? Propongo tabla puente.
2. **Unique de identificador por padre**: ¿unique duro en BD (exige resolver colisiones del backfill) o validación en service con warn+override? Propongo service (más flexible con override), índice no-único.
3. **`ContactoConfianza.etiqueta` vs `nombre` nuevo**: ¿migrar `etiqueta`→`nombre` o coexistir? Propongo `nombre` nuevo requerido en Zod, `etiqueta` deprecado sin borrar (aditivo).
4. **Backfill case-insensitive**: confirmar estrategia de colisiones (A.4) antes de tocar `Reporte.identificador` (tabla grande de prod).
5. **Defensa en profundidad en el cruce** (A.3): ¿normalizar además la lista `valores` en cada callsite? Propongo sí.
