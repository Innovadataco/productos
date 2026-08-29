# Quickstart: SPEC-140 — denuncia formal + panel forense

## Generar una denuncia formal (F2)

1. Entra como ADMIN o COMITE_VALIDACION (con el módulo `denuncia_formal` otorgado).
2. Abre el expediente de un reporte en estado CLASIFICADO/CORREGIDO/REVISION_MANUAL.
3. Botón "Llevar a denuncia formal" → elige canal (Línea 141 ICBF, CAI Virtual, Te
   Protejo) → confirma → se descarga el PDF.
4. Verifica: el PDF usa lenguaje descriptivo (nunca veredictos) y muestra los canales
   oficiales; en `AuditLog` hay UNA fila `DENUNCIA_FORMAL_GENERADA` con
   `{ reporteId, canalDestino, usuarioId, fecha }` — sin contenido; el PDF no queda en
   ningún lado del servidor.

## Panel forense (N-4)

- Vista: `GET /api/admin/reportes/[id]/forense` — JSON con los campos autorizados
  (identificador, plataforma, fechas, ubicación, conductas, traza de estados). Nunca
  `usuarioId`, email, IP ni huella del denunciante.
- Exportación: `GET /api/admin/reportes/[id]/forense/pdf` — descarga el PDF y registra
  `EXPEDIENTE_FORENSE_EXPORTADO`.

## Probar

```bash
# migración aditiva del enum
npx prisma migrate dev
# tests del área
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run \
  src/lib/expediente/pdf-denuncia.test.ts \
  src/app/api/admin/reportes/[id]/denuncia-formal/route.test.ts \
  src/app/api/admin/reportes/[id]/forense/route.test.ts
# gates
npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run arch:check
./scripts/dev-restart.sh
```
