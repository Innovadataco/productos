# SPEC-483 · Plan

## Enfoque

Barrido mecánico de color crudo (Ola A) sobre `src/app/dashboard/admin/**`. Sin decisión de diseño: mapa fijo de token dado por Diseño (`LOTE-2-RESIDUAL-PRIORIZADO.md`).

1. **Inventario en fuente** (candado 15 v5): enumerar cada ocurrencia de `slate/gray/sky/cyan/emerald-[0-9]` con contexto de línea. Confirmar que el conteo coincide con el verificado por el CEO (78/8/5). Confirmar que los tokens destino existen (`tinta`, `papel`, `cielo`, `pino`, `.text-*`).
2. **Mapa mecánico**:
   - `slate/gray` → borde `border-tinta/10`, velo `bg-tinta/5`, superficie `bg-papel/*`, divide `divide-tinta/10`, texto por jerarquía (`text-body/muted/subtle`). Pares light/dark → un token theme-aware (drop `dark:`).
   - `sky/cyan` → `cielo` (`text-cielo`, `bg-cielo/10`, `border-cielo`).
   - `emerald` → `pino` (`text-pino`, `bg-pino/10`).
3. **Excluir `amber`** (Ola B) y `tokens-check.ts`/PISO.
4. **Candado** de conducta que muere por mutación (0 crudo mecánico en admin).
5. **Preflight** completo (tsc, eslint, tokens:check, arch:check, generar-readme --check, unit) antes del push.

## Riesgos y mitigación

- **Regresión visual por colapsar dark:** — mitigado usando tokens theme-aware (`tinta`/`papel` voltean con el tema), idioma ya probado en Ola 1 (OnboardingModal, colegio migrado).
- **Contraste AA de texto cielo/pino** — se usa el idioma ya certificado en padre/profesional (`text-cielo` 17×). El ámbar como texto (que sí exige `-ink`) queda fuera (Ola B).
- **Tocar conducta sin querer** — solo se editan strings de `className`; sin cambios de lógica/rutas → `arch:check` inalterado. Certifica Diseño (forma) + Calidad/CEO (fondo).

## Alcance

`src/app/dashboard/admin/**` (16 archivos). Fuera: `components/modules/ia` (89) y `monitoreo/LogsTab` (2) — no en el conteo verificado; Ola B (amber + PDF).
