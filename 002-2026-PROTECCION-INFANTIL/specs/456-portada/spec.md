# SPEC-456 · «Cara» del rediseño: la portada (la puerta de entrada)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: paquete de Diseño (idc-04) · orden de Jelkin (activar Diseño hoy) · **Autoridad de diseño**: Diseño (certifica directo contra producción)

**Impacto en arquitectura:** ninguno de API/modelo/datos. Piel + copy + orden. No toca la lógica de consulta ni de reporte.

---

## El defecto

La portada es lo primero que ve un padre asustado y se veía como software genérico: azul de catálogo (`from-sky-500 to-cyan-600`), voz de inversionista («identificadores asociados a conductas de riesgo»), y los **canales oficiales (141, ICBF…) enterrados** antes del pie — en celular, pasado el 70% de la página.

## Qué se hizo (subset «cablear/reordenar» del paquete de Diseño)

1. **Canales oficiales arriba (P-5, la palanca más alta).** `HomePageClient` monta `<CanalesOficiales>` **antes** del hero+consulta — visibles sin scroll en 375px (aceptación §4.3: «mover arriba»).
2. **Hero a la marca (P-1).** Fuera el gradiente crudo y los ~27 `sky/cyan` del hero → tokens `cielo`/`pino`. El rojo del error → `rubi`. Baja `tokens:check`.
3. **Voz serif, en «tú» (P-2/P-3).** Titular en Instrument Serif con la voz de Diseño; bajada sin jerga («identificadores»/«conductas de riesgo» fuera).
4. **Botones ≥48px (P-4).** Área táctil en los CTA y la re-consulta.

## Fuera de alcance en este PR (Diseño, pase de certificación)

La **lámpara** (luz ambiental que sigue al puntero), la **órbita** del botón primario y el **squircle** del catálogo son «rediseñar», no «cablear» — el CEO acotó este PR a lo barato de alto impacto. Los crudos de subcomponentes (`ConsultaForm`, `CanalesOficiales`) se migran con su mueble.

## Candados

- `tokens:check`: piso **1079 → 1052** (~27 clases crudas menos en el hero; ratchet bajado).
- `portada-sin-alarma.candado.test.ts` (fuente, sin BD): canales antes del hero; hero sin color crudo; titular serif y bajada sin jerga. Contraprueba por mutación en 3 direcciones, cada una con rojo distinto.

## Certificación (la da DISEÑO)

Diseño certifica directo contra la portada desplegada (es pública, no hace falta login). Calidad valida el fondo (los enlaces a 141/ICBF funcionan, la portada carga). Hasta esa certificación, la portada no se marca cerrada en el inventario.
