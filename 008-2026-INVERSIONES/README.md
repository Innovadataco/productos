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
- Salidas de `escision:registrar`: 0 registrado (con su id y el siguiente paso) · 1 rechazado, con el código y qué significa (`INSTRUMENTO_DESCONOCIDO` dice si es el origen o el destino) · 2 datos inválidos, sin tocar la base · 3 registrado, con dividendos ordinarios que revertir.
- En producción va por la vía B (`cargar-prod.sh registrar-escision`, runbook §11). Ante cualquier salida distinta de 0 dice «pare la carga y avise al CEO de 008».
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
- Salidas de `lote:escision`: 0 registrado (con el siguiente paso: `lotes:construir`; en producción, `cargar-prod.sh construir-lotes`) · 1 rechazado, con el código (`EVENTO_NO_ENCONTRADO`, `EVENTO_AMBIGUO`, `LOTE_YA_REGISTRADO` o `SIN_LOTE_MADRE`, cada uno dice qué falta) · 2 datos inválidos (`DATOS_INVALIDOS`), sin tocar la base.

## Constitución del fondo (unidades y aporte)
```bash
npx tsx scripts/registrar-movimiento-fondo.ts --email <su-correo> --fondo <código del fondo en la SFC> \
  --fecha AAAA-MM-DD --unidades <n> --monto <n>             # ensayo: no escribe
npx tsx scripts/registrar-movimiento-fondo.ts … --aplicar   # registra
```
- Las unidades y el aporte salen del extracto del FIC: ningún archivo los trae. Tal cual el extracto, con punto decimal y sin miles; nada se redondea (`NUMERO_PRECISION`).
- Antes: el fondo registrado y el valor de unidad de la SFC **de ese día** cargado. El monto debe ser unidades × ese valor (±0,5 %); si no cuadra o falta, se niega sin escribir y dice qué revisar en el extracto.
- Es una sola por fondo y no se edita: repetirla con los mismos datos no escribe nada; con otros, `CONSTITUCION_DISTINTA`.
- Después, `conciliar-certificacion`: el fondo deja `fondo_sin_unidades` y el efectivo, `aporte_fic_sin_registrar`.
- En producción va por la vía B (`cargar-prod.sh registrar-movimiento-fondo`, [runbook §11](docs/despliegue/produccion.md)).

## Precios de cierre (INV-SPEC-13)
```bash
npm run precios:actualizar                       # últimos 10 días de las especies con lotes
npm run precios:actualizar -- --desde 2025-01-01 # carga histórica
```
- Fuente: Yahoo Finance `<NEMO>.CL` (no oficial), cierre sin ajustar en COP. Un cierre revisado reemplaza al anterior, que queda como historia.
- Verificación: si hay certificación de A&V vigente de ese día, el cierre debe quedar a ±1 % de su precio de valoración (`VERIFICADO`). Si no hay referencia oficial, queda `NO_VERIFICADO`. Una certificación retirada (corte equivocado, abajo) ya no es referencia.
- Si Yahoo falla, no se guarda nada de esa especie y el comando lo informa (salida 3).

## Certificación de A&V: el corte real
```bash
npx tsx scripts/importar-certificacion.ts --email <su-correo> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>
npx tsx scripts/corregir-corte-certificacion.ts --email <su-correo> --fecha-corte AAAA-MM-DD --nueva-fecha-corte AAAA-MM-DD <certificacion.pdf>
```
El PDF no trae la fecha de corte en el texto: usted la da. Un PDF bajado durante la rueda es la foto del cierre del **día hábil anterior**, no la del día en que lo bajó. El sistema lo detecta de tres formas y nunca corrige la fecha solo:
- **`FECHA_CORTE_ANTES_DEL_CIERRE`** (al importar): el PDF se generó ese mismo día antes de que el cierre fuera definitivo (17:00, la hora de los precios). Con una fecha posterior a la del PDF sale `FECHA_CORTE_POSTERIOR_AL_PDF`. Sin fecha de creación en el PDF, esta señal no bloquea.
- **`CORTE_NO_COINCIDE`** (al importar): ya hay cierres guardados del día y del día hábil anterior, y los precios de valoración cuadran (±1 %) con los del día anterior y no con los del día pedido. Solo cuentan las especies con cierre en los dos días (al menos 2); si faltan cierres, no se puede saber y no bloquea.
- **`fecha_corte_dudosa`** (al conciliar): la misma regla, con la fecha sugerida en el detalle del control.

**Qué hacer.** El mensaje dice el día que sugiere y el comando exacto:
- Si la certificación no está cargada, impórtela de nuevo con `--fecha-corte <día sugerido>` (la nueva corrida vuelve a validar la fecha).
- Si ya está cargada con la fecha equivocada, corríjala con `corregir-corte-certificacion` y el **mismo PDF**. En una sola transacción: retira la certificación vieja (no se borra: queda como historia, con su carga en `REVERTIDO` y sus conciliaciones), la importa con el corte real y re-verifica los cierres de los dos días (los del corte viejo quedan sin referencia). Se rechaza sin cambiar nada si el PDF es otro archivo (`ARCHIVO_DISTINTO`), si el corte nuevo está ocupado (`CORTE_OCUPADO`) o no pasa la validación, o si ya se corrigió (`CORTE_RETIRADO`). Con `CONFLICTO_CONCURRENTE`, repita el mismo comando.
- Después, concilie el corte nuevo: `npx tsx scripts/conciliar-certificacion.ts --fecha-corte <corte real>`. Conciliar el corte viejo da `CERTIFICACION_RETIRADA` con la fecha que lo reemplazó.
- La fecha de una certificación retirada queda ocupada por su historia: otra certificación con esa fecha se rechaza con `CORTE_RETIRADO`.

Este repo es público: aquí no hay datos reales. Los datos de prueba están inventados y marcados `.ficticio.`.

## Proyecciones (motor, sin pantalla)
- Módulo de dominio puro en `src/proyecciones/`, con su lector de solo lectura en el servidor. No tiene comando ni pantalla: en `main` todavía no hay pantalla de proyecciones. Su punto de entrada es `proyectar(db, entrada)`.
- Entrada: el portafolio vigente, los cierres vigentes de los últimos 10 años como máximo, los dividendos, los decretos y los parámetros del escenario (que no se guardan).
- Salida: JSON con percentiles por mes, la probabilidad de terminar bajo lo aportado, la caída máxima mediana, los supuestos y el aviso «Escenario ilustrativo, no es recomendación ni promesa.».
- Pruebas: `npx vitest run tests/unit/proyecciones` (incluye `rendimiento.test.ts`).

---
> v1.2 · 2026-11-21 · 23:28 (-05) · INV · Fábrica Inversiones (frente docs-tanda-21nov) · salidas de `escision:registrar` y `lote:escision` con el siguiente paso; sección de proyecciones (motor, sin pantalla) (v1.2 sobre la v1.1)
> v1.1 · 2026-11-21 · 20:26 (-05) · INV · Fábrica Inversiones (frente certificacion-corte-real) · primer pie de versión · certificación de A&V: el corte real (FECHA_CORTE_ANTES_DEL_CIERRE, CORTE_NO_COINCIDE, fecha_corte_dudosa) y su corrección con `corregir-corte-certificacion`
