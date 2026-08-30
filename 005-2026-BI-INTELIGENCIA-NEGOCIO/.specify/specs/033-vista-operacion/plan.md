# PLAN-033 · Vista `/operacion`

## Fases

### F1 · Lector + tipos · `src/lib/bi/operacion.ts`

- Tipos derivados del contrato: `Persona`, `Equipo`, `FuncionalidadFila`, `RecorridoFila`, `Operacion`.
- `leerOperacion(): Promise<ResultadoOperacion>` con `readFile(RUTA,"utf8")` + `JSON.parse` en try/catch.
  - `ENOENT` → `{ ok:false, motivo:"ausente" }`.
  - parse error → `{ ok:false, motivo:"invalido" }`.
- Ruta: `process.env.OPERACION_JSON_PATH ?? "/data/operacion.json"`.
- Normalizadores puros (testeable sin FS):
  - `claseEstadoPersona(estado): "libre"|"proceso"|"ocupado"|"off"` (desconocido→`"off"`).
  - `claseTag(label): "ok"|"mid"|"bad"|"neutro"` (Cumple→ok · Parcial→mid · Sin probar/Bloqueado→bad · otro→neutro · null→null para render `—`).
  - `anchoBarra({hechos,total}): number` = `total>0 ? Math.round(hechos/total*100) : 0`.
  - `mostrar(v): string` = `v==null||v===""` ? `"—"` : `String(v)`.

### F2 · Estilos del artefacto

- `src/app/operacion/operacion.css` con las variables CSS (light `:root` + dark `@media prefers-color-scheme` y `[data-theme="dark"]`) y clases (`.wrap`, `.bar`, `.crew`, `.grp`, `.who`, `.key`, `.panel`, `.ph`, `.scroll`, `table/th/td`, `.id`, `.d`, `.ref`, `.dash`, `.b`, `.tag`, `.need`, `.prog`, `.alert`, `footer`), copiadas verbatim del artefacto. Responsive `@media (max-width:640px)`.
- Import del CSS en `page.tsx` (scoped a la ruta · no toca layout root).

### F3 · Fuentes IBM Plex

- `next/font/google`: `IBM_Plex_Sans` (400/500/600/700) + `IBM_Plex_Mono` (400/500/600), expuestas como CSS variables `--font-plex-sans`/`--font-plex-mono` en un wrapper de la ruta. Auto-hosteadas por Next → compatibles con CSP `font-src 'self'` (no depende de Google Fonts en runtime). El `operacion.css` referencia `"IBM Plex Sans"/"IBM Plex Mono"` con fallback.

### F4 · Componentes de presentación · `src/components/bi/operacion/`

- `RelojColombia.tsx` (`"use client"`) · `Intl.DateTimeFormat("en-GB",{timeZone:"America/Bogota",...})` · `useEffect` + `setInterval(1000)` · formato `DD-MM-YYYY HH:MM:SS` · fallback local si Intl falla (igual que el artefacto).
- `BarraOperacion.tsx` · título + `<RelojColombia/>` + actualizado + prod.
- `EquiposChips.tsx` · `.crew` + `.key` · mapa de estado.
- `TablaFuncionalidades.tsx` · 11 columnas · celdas según contrato · banner `.alert`.
- `TablaRecorridos.tsx` · 9 columnas · barra `.prog` · `.need`/`.need.hard`.
- `AvisoSinDatos.tsx` · aviso claro (motivo ausente/inválido) · se muestra con la barra (reloj sigue).

### F5 · Página · `src/app/operacion/page.tsx`

```tsx
import "./operacion.css";
export const dynamic = "force-dynamic";
export default async function OperacionPage() {
  const r = await leerOperacion();
  return (
    <FuentesPlex>
      <div className="wrap">
        <BarraOperacion titulo={...} actualizado={...} commit={...} />
        {r.ok ? (
          <>
            <EquiposChips equipos={r.data.equipos} />
            <TablaFuncionalidades f={r.data.funcionalidades} />
            <TablaRecorridos r={r.data.recorridos} />
            <footer>{r.data.notaPie ?? DEFAULT_PIE}</footer>
          </>
        ) : (
          <AvisoSinDatos motivo={r.motivo} />
        )}
      </div>
    </FuentesPlex>
  );
}
```
Cuando `ok:false`, la barra igual necesita `actualizado`/`commit` → se muestran `—` (no hay data). El reloj es cliente y sigue.

### F6 · docker-compose.bi.yml

Agregar a `bi-next`:
```yaml
    volumes:
      - /opt/proteccion-infantil/bi-operacion:/data:ro
    environment:
      OPERACION_JSON_PATH: /data/operacion.json
```
(sumado a lo que ya tenga el servicio · no se crea el archivo real · lo escribe el CEO).

**Nota de deploy (no es implementación · aprendizaje I-31):** al desplegar se verifica el montaje desde ADENTRO del contenedor con `docker exec <bi-next> cat /data/operacion.json`, no por la pantalla. Lo hace quien despliega, no este SPEC. Se documenta en el PR para que no se salte.

### F7 · Tests unitarios

- `tests/unit/bi-operacion-lector.test.ts` (`@vitest-environment node`):
  - fixture presente (via `OPERACION_JSON_PATH` apuntando a `tests/fixtures/operacion.sample.json`) → `ok:true` con 3 equipos / 17 func / 13 recorridos.
  - ruta inexistente → `ok:false, motivo:"ausente"`.
  - archivo con JSON corrupto (fixture temporal) → `ok:false, motivo:"invalido"`.
- `tests/unit/bi-operacion-normalizadores.test.ts`:
  - `claseEstadoPersona` los 4 enums + desconocido→off.
  - `claseTag` Cumple/Parcial/Sin probar/Bloqueado/desconocido/null.
  - `anchoBarra` total>0, total=0 (sin división por cero), 100%.
  - `mostrar` null/""/valor.
- `tests/unit/bi-operacion-render.test.tsx`:
  - `TablaRecorridos` respeta el orden del array (R-01,R-02,... del fixture).
  - `teNecesita` critico → clase `.need.hard`.
  - `EquiposChips` estado desconocido → `.off` + texto crudo.
  - `AvisoSinDatos` motivo ausente/inválido → mensajes distintos, nunca vacío.

### F8 · Gate local (PASO 6)

- `rm -rf .next && npm run build` · `npm run typecheck` · `npx vitest run` · ratchets 4/5.

### F9 · Evidencia §6 (candado 25 · PESA MÁS QUE EL CÓDIGO)

Con `OPERACION_JSON_PATH` → `tests/fixtures/operacion.sample.json` y `next build && next start` (NO `next dev`):

- **(a)** Abrir `/operacion` en el navegador · captura de los 3 bloques con data real (colores distinguibles light + dark).
- **(b)** Quitar el archivo (mover el fixture) · recargar · captura del `AvisoSinDatos` (no blanco, no stack).
- **(c)** Confirmar reloj Colombia corriendo + fechas `DD-MM-AAAA HH:MM`.
- **(d)** Viewport móvil · captura o nota de que no rompe (scroll horizontal en tablas, no overflow del body).
- **(e) TABLERO VIVO (addendum CEO · brief §5.4 · el que más se salta):** con el server corriendo, **editar el fixture** (cambiar un estado, un avance, agregar una fila), **recargar SIN reconstruir ni reiniciar**, y adjuntar DOS capturas **antes/después** mostrando que la pantalla reflejó el cambio. Prueba que la vista re-lee el archivo en cada request (no es foto del build). Si al recargar no cambia → hay caché → se arregla antes del CUMPLE.

Uso el navegador (Playwright + Chromium local, como en SPEC-029) para las capturas reales.

### F10 · Push + PR (PASO 7)

- `git add src/app/operacion src/components/bi/operacion src/lib/bi/operacion.ts docker-compose.bi.yml tests/ .specify/specs/033-vista-operacion/`
- `git commit -m "feat(bi): SPEC-033 vista /operacion · tablero de operación PI (lee JSON del VPS)"`
- `git push origin work/bi-SPEC-033-vista-operacion && gh pr create --base main`

---

## Dependencias

- Contrato `CONTRATO-JSON-A55` (shape) · artefacto `b8f502f1` (diseño) · fixture `operacion.sample.json` (data real · ya copiado a `tests/fixtures/`).
- `next/font/google` (ya usado en el proyecto).
- Ninguna ruta prohibida.

**Bloqueado por:** REVISO de Fábrica antes de PASO 4 (compuerta real).

---

## Mapeo campo-JSON → celda (referencia rápida · contrato §3)

| Campo | Bloque | Celda / render |
|---|---|---|
| `titulo` | barra | `<h1>` (default si falta) |
| `actualizado` | barra | "Actualizado <b>" verbatim (null→—) |
| `commitProduccion` | barra + pie | "Prod <b>" · `<code>` en pie |
| `notaPie` | pie | `<footer>` (default si falta) |
| `equipos[].equipo` | equipos | `.gl` label |
| `equipos[].personas[].{nombre,estado,nota}` | equipos | `.who` clase por estado · `<b>`nombre · `<span>`nota |
| `funcionalidades.resumen` | func header | `.meta` verbatim |
| `funcionalidades.alerta` | func | banner `.alert` (si no vacío) |
| `funcionalidades.filas[].{id,nombre,brief,instructivo,spec,inicio,estimada,fin,desplegado,calidad,tuOk}` | func tabla | 11 columnas (ver spec) |
| `recorridos.resumen` | rec header | `.meta` verbatim |
| `recorridos.filas[].{id,nombre,avance,inicio,estimada,fin,resultado,estado,teNecesita}` | rec tabla | 9 columnas (ver spec) |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 16:5x COT |
| **Autor** | Dev BI-2 |
