# SPEC-483 · Tasks

## Hecho (este PR)
- [x] Verificar cada archivo en fuente antes de tocar (candado 15 v5) — inventario de 16 archivos con contexto.
- [x] `slate/gray` → neutros por jerarquía (borde `--linea`, velo tinta/5, superficie papel, divide tinta/10); pares light/dark colapsados a token theme-aware.
- [x] `sky/cyan` → cielo; `emerald` → pino.
- [x] `amber` intacto (30, Ola B); `tokens-check.ts`/PISO intactos.
- [x] Candado `admin-residual-barrido.candado.test.ts` (0 crudo mecánico en admin). Verificado por mutación.
- [x] Registrar el candado en `vitest.unit.includes.ts` (estático, sin BD).
- [x] Preflight: tsc + eslint (0 errores) + tokens:check (750<841) + arch:check + generar-readme --check + suite unit.

## Pendiente
- [ ] Commit + push + PR + reportar al CEO. Al verde, el CEO mergea.

## Fuera de alcance (reportado al CEO)
- Residual en `src/components/modules/ia/**` (89) y `monitoreo/LogsTab` (2): no están en el conteo admin verificado; candidato a spec propia.
- Ola B: `amber` (30) + plantillas PDF — criterio fino de Diseño.
