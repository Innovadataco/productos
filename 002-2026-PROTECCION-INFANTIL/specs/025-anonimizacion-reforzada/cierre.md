> # Cierre — Spec 025: Anonimización reforzada + encriptación del original

## Resumen

Se implementó la Spec 025 reforzando la privacidad del denunciante y cifrando el texto original de los reportes.

## Qué se implementó

1. **Modelo de datos** (`prisma/schema.prisma` + migración `20260718100846_add_anonimizacion_validacion`):
   - Nuevos campos en `Reporte`: `anonimizacionValidadaPorId`, `anonimizacionValidadaEn` y relación con `Usuario`.
   - Nuevos valores en `AccionAudit`: `TEXTO_ORIGINAL_REVELADO`, `ANONIMIZACION_VALIDADA`, `ANONIMIZACION_RECHAZADA`.

2. **Cifrado de `textoOriginal`**:
   - En la creación del reporte (`src/app/api/reportes/route.ts`) el texto original se cifra con `encryptParameter()` antes de persistirse.
   - En el procesamiento asíncrono (`src/app/api/reportes/procesar/route.ts`) se descifra `textoOriginal` para anonimizar y se vuelve a cifrar antes de guardar.
   - En la anonimización manual admin (`src/app/api/admin/reportes/[id]/anonimizar/route.ts`) se preserva el original cifrado.

3. **Nuevos endpoints**:
   - `POST /api/admin/reportes/[id]/revelar-original` — solo `ADMIN`, descifra, registra `TEXTO_ORIGINAL_REVELADO` y no guarda contraseña ni texto en metadatos.
   - `POST /api/admin/reportes/[id]/validar-anonimizacion` — `OPERADOR` o `ADMIN`. Con `valida=true` pasa a `CLASIFICADO`, setea campos de validación, registra transición y `ANONIMIZACION_VALIDADA`. Con `valida=false` registra `ANONIMIZACION_RECHAZADA` y mantiene `REQUIERE_ANONIMIZACION`.

4. **Cierre de fugas PII**:
   - `GET /api/admin/reportes-revision/[id]` ya no retorna `textoOriginal`, `usuarioId`, `usuario` ni datos del denunciante; indica `puedeRevelarOriginal` solo para admins.
   - Revisados listado, seguimiento público y mis-reportes: no exponen datos del denunciante.

5. **Mejora de anonimización regex** (`src/lib/ai/pii-patterns.ts`):
   - Se agregó detección de auto-identificación del denunciante: nombre propio tras "yo soy / me llamo / mi nombre es", teléfono propio tras "mi celular es / puedes llamarme al", y email propio.
   - No se tocó el modelo IA, umbrales, RAG ni Presidio.

6. **UI de detalle** (`src/components/modules/AdminReporteDetalle.tsx`):
   - Ya no muestra `textoOriginal` directamente.
   - Botón "Revelar original" solo visible para admins, con área marcada como confidencial.
   - Botones para validar/rechazar anonimización cuando el reporte está en `REQUIERE_ANONIMIZACION`.

7. **Tests**:
   - Creación de reporte cifra `textoOriginal`.
   - Operador no ve `textoOriginal` ni datos del denunciante.
   - Admin revela original y genera audit log.
   - Validar anonimización cambia estado a `CLASIFICADO` y deja transición.
   - Rechazar anonimización mantiene `REQUIERE_ANONIMIZACION`.
   - Regex de auto-identificación del denunciante.

## Archivos tocados

- `prisma/schema.prisma`
- `prisma/migrations/20260718100846_add_anonimizacion_validacion/migration.sql`
- `src/app/api/reportes/route.ts`
- `src/app/api/reportes/route.test.ts`
- `src/app/api/reportes/procesar/route.ts`
- `src/app/api/reportes/procesar/route.test.ts`
- `src/app/api/admin/reportes/[id]/anonimizar/route.ts`
- `src/app/api/admin/reportes/[id]/revelar-original/route.ts` (nuevo)
- `src/app/api/admin/reportes/[id]/revelar-original/route.test.ts` (nuevo)
- `src/app/api/admin/reportes/[id]/validar-anonimizacion/route.ts` (nuevo)
- `src/app/api/admin/reportes/[id]/validar-anonimizacion/route.test.ts` (nuevo)
- `src/app/api/admin/reportes-revision/[id]/route.ts`
- `src/app/api/admin/reportes-revision/[id]/route.test.ts` (nuevo)
- `src/lib/ai/pii-patterns.ts`
- `src/lib/ai/pii-patterns.test.ts`
- `src/components/modules/AdminReporteDetalle.tsx`

## Resultados de verificación

- `npm run lint`: ✅ (1 warning preexistente en `src/lib/sms.ts`, no relacionado)
- `npx tsc --noEmit`: ✅
- `npm run build`: ✅
- `npm run test`: ✅ 307 tests en 62 archivos
- `npm run smoke-e2e`: no existe en el proyecto; no se ejecutó.

## Commits de implementación

- `056515a` — spec-025: add anonimizacionValidadaPorId, anonimizacionValidadaEn y AccionAudit values
- `3c40e89` — spec-025: cifrar textoOriginal en creación, procesamiento y anonimización manual
- `cfba151` — spec-025: endpoints revelar-original (admin) y validar-anonimización (operador/admin); cierra fugas PII en detalle
- `3da413a` — spec-025: UI de detalle protege texto original; regex de auto-identificación del denunciante
- `7bbe701` — spec-025: tests para cifrado, fugas PII, revelar original, validar anonimización y regex

> Commit base documentado: `7bbe701`

## Decisiones pendientes

- La mejora de regex cubre los casos más comunes de auto-identificación; se deja para **SPEC-050** un refinamiento más profundo (emails con dominios, nombres compuestos, contextos coloquiales adicionales) y la posible integración de **Presidio** como tercera capa bajo feature flag.
- El rol `SCHOOL_ADMIN` no puede revelar original ni validar anonimización; esto puede revisarse si la política de tenant lo requiere.

