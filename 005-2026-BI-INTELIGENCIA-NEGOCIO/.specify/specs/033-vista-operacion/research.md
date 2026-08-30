# RESEARCH-033 · Vista `/operacion`

## Fuentes verificadas

### Artefacto de diseño `b8f502f1` (fuente de verdad · leído completo)
Estructura confirmada: `.wrap` > `.bar` (h1 + `.clock`) · `.crew` (`.grp` por equipo, `.who` por persona) · `.key` (leyenda 4 colores) · `.panel` Funcionalidades (11 col) · `.alert` · `.panel` Recorridos (9 col) · `footer`. Variables CSS light en `:root`, dark en `@media (prefers-color-scheme:dark)` y `[data-theme="dark"]`. Reloj: `Intl.DateTimeFormat("en-GB",{timeZone:"America/Bogota",...})` cada 1s, con fallback local. Responsive `@media (max-width:640px)`.

**Columnas Funcionalidades (11):** `#` · Funcionalidad · Brief · Instr. · Spec · Inicio · Estimada · Fin · Despl. · Calidad · Tu OK.
**Columnas Recorridos (9):** `#` · Recorrido · Avance · Inicio · Estimada · Fin · Resultado · Estado · ¿Te necesita?

**Mapa de color de celda (del artefacto):**
- Estado persona: `.libre`(verde) `.proceso`(ámbar) `.ocupado`(rojo) `.off`(gris).
- `desplegado`: `.b.y`=`✓` verde · `.b.n`=`—` tenue.
- `tuOk`: `.b.w`=`·` ámbar (pendiente) · `✓` (ok) · `—` (null).
- tag: `.ok`(Cumple) `.mid`(Parcial) `.bad`(Sin probar/Bloqueado).
- `.need` ámbar (necesita) · `.need.hard` rojo (critico).
- `.prog .track i` ancho % de la barra.

### Contrato `CONTRATO-JSON-A55` (shape · candado 22 v2)
Todos los campos y reglas de degradación documentados en spec.md. Cerrado con el CEO. Fechas verbatim (incluye `estimada` que puede ser `"3 h"`/`"3,5 h"`). Orden de filas = orden del array (no reordenar). Enums de estado libres con fallback neutro.

### Fixture `operacion.sample.json` (data real · copiado a `tests/fixtures/`)
Verificado: 3 equipos · 17 funcionalidades · 13 recorridos · estados persona observados `{en_proceso, libre, ocupado, sin_sesion}`. Orden recorridos: `R-01,R-02,R-03,R-12,R-13,R-04,...` (R-12/R-13 adelantados por el CEO porque "te necesitan" — confirma que el orden es del array, no ordenado por id).

---

## Decisiones de diseño

### D-033.1 · `force-dynamic` para lectura en cada request
El brief exige que editar el archivo + recargar refleje el cambio sin redeploy. `export const dynamic = "force-dynamic"` desactiva el caché de ruta; `readFile` corre en cada request. Alternativa `revalidate = 0` es equivalente; uso `force-dynamic` por ser explícito. **La evidencia §6(e) (tablero vivo) prueba esto empíricamente.**

### D-033.2 · Reloj = Client Component aislado
El reloj usa `Date` vivo + `setInterval`, imposible en Server Component. Es el ÚNICO client component; todo lo demás es Server (lee archivo, renderiza HTML estático). Copiado del `<script>` del artefacto (mismo `Intl.DateTimeFormat("en-GB",...)`, mismo fallback).

### D-033.3 · IBM Plex vía `next/font/google`, no `<link>` a Google Fonts
El proyecto tiene CSP `font-src 'self'` (verificado en las cabeceras vistas en SPEC-029). Un `<link>` a `fonts.gstatic.com` se bloquearía. `next/font/google` descarga y auto-hostea las fuentes en build → servidas desde el propio origen → compatibles con la CSP. Se exponen como CSS variables scoped a la ruta, sin tocar el layout root (que ya define Inter/DM_Mono · candado: no lo toco).

### D-033.4 · CSS scoped a la ruta, no global
El `operacion.css` se importa en `src/app/operacion/page.tsx`. Las variables `--ground`/`--ink`/etc del artefacto se aplican dentro de `.wrap`. El layout root aplica `bg-page`/`ThemeProvider`; para que `/operacion` se vea como el artefacto (no como el resto del BI), la vista pinta su propio fondo en `.wrap` con `background: var(--ground)` y `min-height`. El `[data-theme="dark"]` del ThemeProvider del root sigue funcionando (el artefacto ya lo contempla en su bloque dark).

### D-033.5 · Lector con FS, testeable con `OPERACION_JSON_PATH`
`leerOperacion()` usa `node:fs/promises`. Para tests y evidencia, `OPERACION_JSON_PATH` apunta al fixture (`tests/fixtures/operacion.sample.json`). En prod apunta a `/data/operacion.json` (volumen). Sin FS mockeado en los tests del lector: se usan fixtures reales en disco (presente, ausente, corrupto temporal) con `@vitest-environment node`.

### D-033.6 · Sin URLs → candado 22 v3 no aplica
La vista solo lee un archivo local; no construye ninguna URL absoluta. El helper `resolveBiBaseUrl` (SPEC-030) no se usa aquí. Documentado para el auditor: no es un olvido, es que no hay URLs.

---

## Riesgos y mitigaciones

- **Caché accidental** (rompería el tablero vivo): mitigado con `force-dynamic` + evidencia §6(e) que lo prueba en vivo.
- **CSP bloquea fuentes**: mitigado con `next/font` auto-hosteado.
- **Body del layout root** con su propio fondo: la vista pinta `.wrap` con `var(--ground)` y `min-height:100vh` para cubrir.
- **Enums nuevos que el CEO escriba** (estado/calidad no listados): fallback neutro + texto crudo (contrato §4) · no rompe.

---

## Fuentes consultadas

- Artefacto `b8f502f1-4e21-490b-904b-a5034aed2424` (diseño completo · CSS + HTML + reloj)
- `CONTRATO-JSON-A55-operacion.md` (shape · reglas de campo · degradación)
- `operacion.sample.json` (data real · 17 func · 13 recorridos)
- INSTRUCTIVO-018 (e5c7b68 · addendum evidencia §6(e) + nota deploy I-31)
- Cabeceras CSP del proyecto (verificadas en SPEC-029)

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 16:5x COT |
| **Autor** | Dev BI-2 |
