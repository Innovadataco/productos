# SPEC-483b · Tasks

## Hecho (este PR)
- [x] Inventario + triaje data-viz de `ia/**` + `monitoreo/LogsTab` (candado 15 v5).
- [x] Mecánico: sky/cyan→cielo, emerald/green→pino/text-estado-pino, slate/gray→neutros, red→rubi/text-estado-rubi, amber→text-estado-ambar. Pares light/dark → token theme-aware.
- [x] `IaDocsPanel`: chrome migrado (tabs, skeleton); medidor de confianza envuelto en región `data-viz:inicio/fin` y dejado para Diseño.
- [x] Candado `ia-residual-barrido.candado.test.ts` (2 tests: 0 crudo fuera de data-viz + gauge marcado). Muere por mutación.
- [x] Registrar candado en `vitest.unit.includes.ts`.
- [x] Preflight: tsc + eslint + tokens:check + arch:check + generar-readme --check + suite unit.

## Pendiente
- [ ] Commit + push + PR + reportar al CEO. Al verde, el CEO mergea por run-id.

## Fuera de alcance
- Medidor de confianza de `IaDocsPanel` (data-viz) → pasada dedicada de Diseño.
