# Plan · SPEC-455

- **A · Mapa:** `PublicDashboard.tsx` → `<MapaUbicaciones paleta="padre">`. Enhebrar `paleta` en `MapaUbicaciones.tsx`: `paisStyle`, `mouseout`, leyenda (los `borde`/`bordeHover` neutros se quedan).
- **B · Mueble «la gráfica»:** `DonutChart.tsx` (serie por token + color-mix, versalita, track token), `BarChart.tsx` (barra `cielo`, textos `fill-current`+token). Bajar el piso de `tokens:check`.
- **C · Voz:** título + subtítulo de `PublicDashboard.tsx` a la voz «tú» (copy de Diseño).
- **D (opcional, baja):** encuadre del mapa a las Américas — no incluido en este PR.
- Candado de fuente + contraprueba por mutación. Preflight D-106. Certifica Diseño tras deploy.
