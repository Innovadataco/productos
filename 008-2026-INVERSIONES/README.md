# 008 · INVERSIONES

Seguimiento personal de un portafolio de inversiones: posiciones, costo, dividendos, rentabilidad, reportes por Telegram y web con gráficas. Solo lectura.

- Reglas del repo para las sesiones: [AGENTS.md](AGENTS.md).
- CI: [`.github/workflows/inv.yml`](../.github/workflows/inv.yml) (check `inv-gate`).

## Arranque local
```bash
cd 008-2026-INVERSIONES
cp .env.example .env
npm ci
npm run db:up          # PostgreSQL 16 en el puerto 5438 (docker compose)
npx prisma migrate deploy
npm run dev            # http://localhost:5008 · salud en /api/salud
```

## Cargar los CSV de Trii (INV-SPEC-8)
```bash
npm run importar:trii -- --email <su-correo> movimientos.csv ordenes.csv dividendos.csv
```
- La primera vez, con la base vacía, agregue `--crear-dueno`. Solo funciona si todavía no hay ningún dueño: un error de tipeo en el correo nunca crea otro.
- Registre los eventos de escisión antes de cargar los dividendos (INV-SPEC-10). Si no, un pago de fracción queda como dividendo ordinario y habrá que revertir esa carga:
  ```bash
  npm run escision:registrar -- --origen <NEMO> --destino <NEMO> --fecha AAAA-MM-DD [--razon 0.5] [--pago-fraccion AAAA-MM-DD] [--monto-fraccion 100.5] [--nota "por confirmar"] [--crear-destino]
  ```
  El origen debe existir (se crea al importar las órdenes); un nemotécnico mal escrito se rechaza. Si la especie destino solo le llegó por la escisión (no está en ninguna orden), agregue `--crear-destino`.
  Un evento registrado no se corrige con el comando: revise los datos antes. El mismo evento o un mismo pago de fracción en dos eventos se rechazan (`EVENTO_DUPLICADO`, `PAGO_FRACCION_DUPLICADO`). La salida 3 indica que el evento quedó registrado, pero hay dividendos ya cargados como ordinarios que hay que revertir.
- Montos con más decimales de los que guarda la base se rechazan (`NUMERO_PRECISION`) en vez de redondearse.
- Reconoce cada archivo por su encabezado. Reimportar o cargar exportaciones que se solapan no duplica.
- Si una fila no se puede leer, **ese archivo no se carga** y el comando dice la fila, la columna y el código del error (nunca el valor).
- Lo ya cargado no se edita: si Trii cambia una fila ya importada (otro estado u otra comisión), el archivo se rechaza con `CONFLICTO_*`.
- Las órdenes necesitan el calendario de la BVC del año (sembrado 2025-2026) para calcular la liquidación T+2.

## Lotes, ventas y posiciones (INV-SPEC-12)
```bash
npm run lotes:construir     # un lote por compra aprobada; ventas asignadas FIFO (idempotente)
npm run lote:escision -- --destino <NEMO> --fecha-evento AAAA-MM-DD --cantidad <N> --costo-unitario <precio de compra del portal>
```
- Corra `lotes:construir` después de cada importación de órdenes. Si avisa `VENTA_SIN_LOTES`, a una especie le falta un lote (p. ej. el de una escisión); sus ventas quedan sin asignar hasta registrarlo.
- El lote de escisión toma su costo del portal de Acciones & Valores y se enlaza al evento y al lote vivo más antiguo de la especie origen. El lote madre no se ajusta (se sigue al portal).

Este repo es público: aquí no hay datos reales. Los datos de prueba están inventados y marcados `.ficticio.`.
