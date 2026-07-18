# Plan — Spec 025: Anonimización reforzada + encriptación del original

## Modelos y campos de BD (schema.prisma)

**Modelos existentes:**
- `Reporte`: campos `texto` (String @db.Text, anonimizado) y `textoOriginal` (String? @db.Text).
- `ClasificacionIA`: campo `contienePii` (Boolean) y `piiDetectada` (String[]).

**Sin nuevos modelos obligatorios.**

**Posible nuevo campo:**
- `Reporte.anonimizacionValidadaPorId` (String?) + relación con `Usuario` (operador que validó).
- `Reporte.anonimizacionValidadaEn` (DateTime?).

**Migración:** `2026xxxxxx_add_anonimizacion_validacion` (si se agregan campos).

## Herramientas

- **Reutilizar**:
  - `src/lib/ai/pii-detector.ts` + `src/lib/ai/pii-patterns.ts` (doble capa existente).
  - `src/lib/param-encryption.ts` (AES-256-GCM) para cifrar `textoOriginal`.
  - `ParametroSistema` para flags/habilitación.
- **Evaluar**:
  - `.venv-presidio` (Presidio) para mejorar detección de PII. Si la cobertura actual es suficiente, no se suma Presidio; si no, se integra como capa adicional sin reemplazar.
- **Nueva**: ninguna a priori.

## Dependencias

- Requiere **Spec 022** para registrar transiciones por anonimización.
- Bloquea parcialmente **Spec 024** (el comité debe trabajar sobre texto anonimizado).

## Fases

1. Auditar endpoints/pantallas que exponen PII del denunciante:
   - `src/app/api/reportes/[id]/...`
   - `src/app/api/admin/reportes-revision/[id]/...`
   - UI de detalle del caso.
2. Cifrar `textoOriginal` al crear reporte; descifrar solo con permiso explícito y loggear `AccionAudit` nuevo `TEXTO_ORIGINAL_REVELADO`.
3. Mejorar anonimización de víctima y denunciante (regex + IA + posible Presidio).
4. Endpoint de validación de anonimización por operador.
5. UI de validación en detalle del caso.
6. Tests: ningún rol interno puede ver email/identidad del denunciante; original se descifra solo bajo permiso.
