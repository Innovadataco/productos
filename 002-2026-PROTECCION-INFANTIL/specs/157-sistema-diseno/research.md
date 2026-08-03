# Research: SPEC-157 — Sistema de diseño de Protección Infantil

**Fecha**: 2026-08-03 · **Spec**: [spec.md](./spec.md)

## D-R1 · Tokens de color que admiten alpha sin color crudo

**Decisión**: variables por canal RGB + `rgb(var(--canal) / <alpha>)`.

```css
:root {
  --pino-rgb: 11 110 90;   /* #0b6e5a */
  --cielo-rgb: 90 162 234; /* #5aa2ea */
  --ambar-rgb: 169 112 12; /* #a9700c */
  --rubi-rgb: 184 57 90;   /* #b8395a */
  --papel-rgb: 238 241 239;/* #eef1ef */
  --tinta-rgb: 15 24 21;   /* #0f1815 */
  /* derivados semánticos (texto, superficies, bordes) definidos sobre los anteriores */
}
.dark {
  --pino-rgb: 79 224 184;  /* #4fe0b8 */
  --cielo-rgb: 111 182 245;/* #6fb6f5 */
  --ambar-rgb: 240 180 85; /* #f0b455 */
  --rubi-rgb: 245 128 155; /* #f5809b */
  --papel-rgb: 6 11 10;    /* #060b0a */
  --tinta-rgb: 242 247 244;/* #f2f7f4 */
}
```

En `tailwind.config.ts`: `colors: { pino: "rgb(var(--pino-rgb) / <alpha-value>)" … }`
→ habilita `bg-pino/70` etc. sin escribir jamás un hex fuera de los tokens.

**Alternativa rechazada**: `color-mix()` en cada uso — mismo resultado, pero menos
soportado por la sintaxis de Tailwind 3.4 y más verboso.

## D-R2 · Mapa capa semántica → tokens (compatibilidad total)

| Clase actual | Reescritura sobre tokens (mismo nombre) |
|---|---|
| `text-body` | `rgb(var(--tinta-rgb))` |
| `text-muted` | tinta al ~72% (token `--tinta-muted-rgb` derivado) |
| `text-subtle` | tinta al ~60% (token `--tinta-subtle-rgb`) |
| `text-accent` | `rgb(var(--pino-rgb))` (unifica sky/cyan actual hacia la paleta §4.2) |
| `glass` family | superficie `papel` al 70/90% + `backdrop-filter: saturate(185%) blur(22px)` (§4.6); en oscuro, luz interior `inset 0 1px 0 rgba(255,255,255,.05)` |
| `bg-page` | campo de luz ambiental con los radiales en tokens (`pino`/`cielo`) sobre `papel` |
| `ring-accent*` | focus ring en `pino` (claro) / `pino` oscuro |
| `text-gradient`/`accent-gradient` | gradiente `pino → cielo` (tokens) |
| `theme-colegio` | se conserva como alias: sus overrides apuntan a los mismos tokens (pino ya ES el verde institucional — la capa queda como no-op semántico compatible) |

Los 9 usos de `primary-*`/`accent-*` del config: `primary` se mapea a `cielo` y
`accent` a `pino` (mismas clases, valores por token) — nadie queda roto.

## D-R3 · Fuentes (D1/D3 pendientes de ZEUS; recomendaciones)

- **Instrument Sans**: TTF variable oficial (`InstrumentSans[wght].ttf`,
  `InstrumentSans-Italic[wght].ttf`) del repo `google/fonts` (SIL OFL) →
  `next/font/local` con `variable: "--font-instrument-sans"`.
- **Instrument Serif**: TTF estáticos Regular + Italic → `--font-instrument-serif`.
- **DM Mono**: se conserva como está (`next/font/google` — Next la descarga en BUILD
  y la sirve auto-alojada; cero llamadas a Google en runtime, cumple BL-1). D1
  documenta la decisión.
- Licencia: `public/fonts/OFL.txt` con el texto SIL OFL (obligación de la licencia).
- Tailwind: `fontFamily.sans = var(--font-instrument-sans)`,
  `serif = var(--font-instrument-serif)`, `mono = var(--font-dm-mono)`.

## D-R4 · Movimiento (§4.5)

- Token `--curva: cubic-bezier(.16,1,.3,1)` expuesto como
  `transitionTimingFunction.barrido` en el config.
- Keyframes del sistema (entrada escalonada, dibujo de anillos, conteo, pulso 3,4 s)
  referencian la curva por variable; el pulso es el ÚNICO bucle.
- Apagado global: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after
  { animation: none !important; transition: none !important; } }` — sin excepción.

## D-R5 · Contrato de los primitivos (props)

```tsx
<Anillo vigilancia={0.89} reaccion={0.72} estudiantes={347}
        sinRedes={38} sinContacto={97} size={240|88} estado="pino|ambar|rubi" />
<LuzAmbiental estado="pino|ambar|rubi" />   // campo de luz detrás del vidrio
<PanelVidrio estado?="pino|ambar|rubi" tone?="default|strong"> // §4.6
<Declaracion estado="pino|ambar|rubi" palabra="tranquilos"
             titular="Todo en tu colegio está {palabra}." />
```

Reglas: cada arco codifica un número real (§4.0.2); la leyenda nombra el hueco en
personas; color solo por token; animación con la curva única; mudos con
reduced-motion.

## D-R6 · Ratchet anti color crudo (si D2=a)

Script `scripts/tokens-check.ts`: cuenta ocurrencias del patrón
`(text|bg|border|ring|from|to|via)-(slate|sky|cyan|emerald|…)-<escala>` en `src/`;
guarda el conteo de referencia en el propio script y FALLA si sube (mismo patrón que
los ratchets de max-lines/complexity del repo). Conteo base medido 2026-08-03:
~1.119 ocurrencias en ~104 archivos — solo puede bajar.

## D-R7 · Lo que NO se hace

- No se migran las ~104 pantallas con color crudo (migran por desgaste).
- No se crean los íconos hero SVG (§8 del brief): son de SPEC-143/146.
- No se instalan librerías de íconos/gráficos: lucide-react/recharts entran con las
  specs de pantalla que los usan.
- No se duplica HTML por tema: los dos temas son valores de token.
