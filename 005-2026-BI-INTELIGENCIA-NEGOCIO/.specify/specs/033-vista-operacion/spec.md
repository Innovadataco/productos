# SPEC-033 · Vista `/operacion` · Tablero de operación PI

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 033 |
| **Nombre** | vista-operacion |
| **Origen** | BI · INSTRUCTIVO-018 · F3C 2026-08-30 16:40 COT · Brief A-55 · orden directa de Jelkin |
| **Diseño (fuente de verdad)** | Artefacto aprobado `b8f502f1-4e21-490b-904b-a5034aed2424` (Jelkin lo depuró en 3 iteraciones · NO rediseñar) |
| **Contrato del JSON** | `CONTRATO-JSON-A55-operacion.md` (candado 22 v2 · cerrado con CEO) |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Publicar `/operacion`: un tablero de una sola pantalla que le muestra a Jelkin el estado de la operación PI (equipos, funcionalidades, recorridos de calidad), leyendo un JSON que el CEO escribe por SSH en el VPS. La vista **lee el archivo en cada request**: el CEO edita el archivo y al recargar la página se ve el cambio, sin redeploy.

El diseño se **copia** del artefacto aprobado — no se reinventa. Cualquier "mejora" es rebote.

---

## Alcance

### Rutas y archivos que este SPEC produce

| Ruta | Qué contiene |
|---|---|
| `src/app/operacion/page.tsx` (nuevo) | Server Component · `force-dynamic` · lee el JSON, lo pasa a los componentes de presentación |
| `src/lib/bi/operacion.ts` (nuevo) | Lector con fallback: ruta desde env, `readFile` + `JSON.parse` en try/catch, tipos del contrato, normalizadores |
| `src/components/bi/operacion/*` (nuevos) | Presentación: `BarraOperacion` (título + reloj), `EquiposChips`, `TablaFuncionalidades`, `TablaRecorridos`, `RelojColombia` (client), `AvisoSinDatos` |
| `src/app/operacion/operacion.css` o estilos co-ubicados | Las variables CSS y clases del artefacto (light + dark) |
| `docker-compose.bi.yml` (modificado) | Volumen `ro` + env `OPERACION_JSON_PATH` en `bi-next` |
| `tests/fixtures/operacion.sample.json` | Data real del artefacto (ya copiada · 3 equipos · 17 funcionalidades · 13 recorridos · 9 personas) |
| `tests/unit/bi-operacion-*.test.*` | Tests del lector (fallbacks) y de los normalizadores de celda |

### Lector · `src/lib/bi/operacion.ts`

```ts
const RUTA = process.env.OPERACION_JSON_PATH ?? "/data/operacion.json";
// leerOperacion(): Promise<{ ok: true; data: Operacion } | { ok: false; motivo: "ausente" | "invalido" }>
```

- `readFile(RUTA, "utf8")` + `JSON.parse` en try/catch.
- Archivo ausente (`ENOENT`) → `{ ok: false, motivo: "ausente" }`.
- JSON corrupto → `{ ok: false, motivo: "invalido" }`.
- Nunca lanza al render · nunca stack trace al usuario.

### Página · `src/app/operacion/page.tsx`

- `export const dynamic = "force-dynamic";` (lee en cada request · candado del INSTRUCTIVO).
- Llama `leerOperacion()`.
- Si `ok:false` → renderiza la barra (con reloj vivo) + `AvisoSinDatos` (aviso claro, nunca pantalla en blanco). El reloj sigue corriendo.
- Si `ok:true` → renderiza los 3 bloques.
- **No construye ninguna URL** (es lectura de archivo · candado 22 v3 no aplica porque no hay URLs).

### 3 bloques (según contrato + artefacto)

**1 · Barra superior** (`.bar`)
- `titulo` (default "Operación · Protección Infantil") · reloj vivo Colombia · `Actualizado <actualizado>` · `Prod <commitProduccion>`.
- **Reloj:** Client Component con `Intl.DateTimeFormat("en-GB", {timeZone:"America/Bogota", ...})`, formato `DD-MM-YYYY HH:MM:SS`, `setInterval` 1 s. Copiado del `<script>` del artefacto. NO sale del archivo.

**2 · Equipos** (`.crew`) + leyenda (`.key`)
- Un `.grp` por equipo (`equipo` + personas). Cada persona `.who` con clase por estado.
- Mapa de estado → clase/color: `libre`→`.libre` (verde) · `en_proceso`→`.proceso` (ámbar) · `ocupado`→`.ocupado` (rojo) · `sin_sesion`→`.off` (gris).
- Estado **desconocido** → clase neutra (`.off`) + se muestra el texto crudo del estado.
- `nota` opcional → `<span>` tenue.
- Leyenda fija (4 colores) copiada del artefacto.

**3 · Funcionalidades** (`.panel` · tabla 11 columnas)
- Header: `Funcionalidades` + `resumen` verbatim (si falta, solo título).
- Columnas (exactas del artefacto): `#` · `Funcionalidad` · `Brief` · `Instr.` · `Spec` · `Inicio` · `Estimada` · `Fin` · `Despl.` · `Calidad` · `Tu OK`.
- Celdas: `id`→`.id` mono azul · `nombre`→`.nm` · `brief/instructivo/spec`→`.ref` (null→`—`) · fechas verbatim `.d` (`estimada`→`.d.est` ámbar · null→`—`) · `desplegado` bool→`✓`(`.b.y`) / `—`(`.b.n`) · `calidad`→tag (`Cumple`→`.ok` · `Parcial`→`.mid` · `Sin probar`/`Bloqueado`→`.bad` · desconocido→tag neutro texto crudo · null→`—`) · `tuOk` (`ok`→`✓` · `pendiente`→`·` ámbar `.b.w` · null→`—`).
- `alerta` (si presente y no vacía) → banner `.alert` rojo bajo la tabla.

**4 · Recorridos de calidad** (`.panel` · tabla 9 columnas)
- Header: `Recorridos de calidad` + `resumen` verbatim.
- Columnas: `#` · `Recorrido` · `Avance` · `Inicio` · `Estimada` · `Fin` · `Resultado` · `Estado` · `¿Te necesita?`.
- `avance` `{hechos,total}` → `hechos/total` + barra `.prog` con ancho `total>0 ? round(hechos/total*100) : 0` %.
- `resultado`→tag (mismo mapa que `calidad`) · `estado`→texto `.d` verbatim.
- `teNecesita`: `necesita:false`→"No" tenue (`.dash`) · `necesita:true`→"Sí · "+`pasos` en `.need` ámbar · **rojo** (`.need.hard`) si `critico:true`.
- **Orden de filas = orden del array. NO reordenar.**

### Degradación (contrato §4 · candado 9/25)

| Situación | Comportamiento |
|---|---|
| Archivo ausente | `AvisoSinDatos` claro · reloj sigue · nunca blanco/stack |
| JSON inválido | Mismo aviso claro |
| Sección top-level ausente | Panel rotulado pero vacío · los demás renderizan |
| Fila con campos faltantes | Presentes se muestran · ausentes → `—` |
| Enum desconocido | Texto crudo en color neutro · no rompe |

---

## Fuera de alcance

- No se crea el archivo de producción (`/opt/proteccion-infantil/bi-operacion/operacion.json`) — lo escribe el CEO por SSH. Solo se deja el montaje del volumen.
- No se toca nada de las rutas prohibidas (dashboard, layout, motor, api/bi, auth, superset, scripts, lo congelado).
- No se agrega navegación desde el dashboard hacia `/operacion` (fuera de alcance · dashboard congelado).

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| 22 v2 | Contrato del payload cerrado antes de implementar | Se implementa contra el shape exacto de `CONTRATO-JSON-A55` |
| 22 v3 | Helper para URLs · nunca request.url | No aplica (no se construyen URLs · lectura de archivo) |
| 9 | Sin datos → aviso claro, nunca inventa | `AvisoSinDatos` en ausente/inválido · `—` en campos faltantes |
| 25 | Evidencia pesa más que el código | PASO 5 · capturas obligatorias (render real · archivo ausente · reloj · móvil) |
| 15 | Fechas verbatim · nunca parsear | `estimada` puede ser `"3 h"` · todas las fechas son string de display |
| 17 | spec+plan commiteado antes de implementar | Aplicado (compuerta §4 real · espera REVISO) |

---

## Riesgos

- **Reloj en Server Component:** el reloj DEBE ser Client Component (`"use client"`) porque usa `Date` vivo + `setInterval`. El resto es Server. Documentado.
- **Fuentes IBM Plex:** el artefacto las trae de Google Fonts. En BI ya se usa `next/font` (Inter/DM_Mono en el layout root). Para `/operacion` cargo IBM Plex vía `next/font/google` local a la ruta, sin tocar el layout root (candado · no toco layout). Alternativa: `<link>` a Google Fonts en la propia página. Decido en implementación según CSP; documentado en research.
- **CSP:** el proyecto tiene CSP estricta (`font-src 'self'`). Si Google Fonts se bloquea, uso `next/font` que auto-hostea las fuentes. Verificado en research.
- **Layout root aplica `bg-page`/ThemeProvider:** `/operacion` vive fuera de `/dashboard`, hereda el `<body>` del layout root. El artefacto define su propio `--ground`/`--ink`; los aplico scoped a la vista para no chocar con el ThemeProvider. Documentado.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 16:5x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
