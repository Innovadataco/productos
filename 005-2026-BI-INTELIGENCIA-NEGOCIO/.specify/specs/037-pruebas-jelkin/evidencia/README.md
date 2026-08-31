# SPEC-037 · Evidencia §6 (candado 14 · verificación en vivo)

Verificación contra el **build standalone de PRODUCCIÓN** (`node server.js`, no `next dev`),
con **sesión ADMIN real** (JWT firmado con `JWT_SECRET` de entorno de evidencia local ·
NO es un secreto de prod) y el **fixture** que ya trae `pruebasJelkin` con J-01/J-02.

Método (candado 15): además de las capturas del browser-pane, se adjunta la verificación
**dura por `curl` HTTP + grep server-side + DOM JS**, porque el browser-pane de este entorno
(RAM compartida con el Ollama de PI) es inestable: se oculta y el scroll por rueda expira.
Las salidas de abajo son **verbatim** de la corrida real · reproducibles con:

```bash
# build ya presente en .next/standalone
OPERACION_JSON_PATH=<fixture> JWT_SECRET=x PORT=3001 HOSTNAME=127.0.0.1 \
  node .next/standalone/.../server.js
curl -s -H "Authorization: Bearer <jwt-admin>" http://127.0.0.1:3001/operacion
```

## Archivos de esta carpeta
- `caso-a-con-datos.txt` — curl HTTP 200 + grep del bloque con J-01/J-02 (verbatim).
- `caso-a-mapeo-colores.txt` — J-01 (Cumple)→clase `ok` (verde) · J-02 (Parcial)→clase `mid` (ámbar).
- `caso-a-fragmento-html.txt` — fragmento HTML renderizado del bloque (server-side).
- `caso-b-array-ausente.txt` — fixture sin `pruebasJelkin` → bloque NO se pinta (grep 0) · resto del tablero intacto.

## Resumen

### (a) Fixture CON `pruebasJelkin` → bloque debajo de recorridos, con colores
- `GET /operacion` → **HTTP 200**.
- El HTML server-rendered contiene: `Pruebas de Jelkin` (×1), `J-01` (×1), `J-02` (×1),
  `Ciclo completo de colegio`, `Rol padre`, `16 · → A-53, I-33`, `2 rojos · → I-33`.
- Mapeo de colores (candado del contrato §7): **J-01 `Cumple` → `tag ok` (verde)** ·
  **J-02 `Parcial` → `tag mid` (ámbar)**.
- Captura del browser-pane (viewport alto): el panel **PRUEBAS DE JELKIN** aparece
  **debajo** de RECORRIDOS DE CALIDAD, misma línea visual, header `2 pruebas · 18 hallazgos`,
  columnas `# · PRUEBA · FECHA · HALLAZGOS · ESTADO`, fila J-01 con tag verde `Cumple`.
- DOM (browser JS) en vivo confirmó: `panel.innerText` =
  `PRUEBAS DE JELKIN / 2 pruebas · 18 hallazgos / # PRUEBA FECHA HALLAZGOS ESTADO /
  J-01 Ciclo completo de colegio 30-08-2026 14:00 16 · → A-53, I-33 Cumple /
  J-02 Rol padre 30-08-2026 16:30 2 rojos · → I-33 Parcial`;
  `getBoundingClientRect` → panel visible (top 541, height 115, dentro del viewport).

### (b) Fixture SIN `pruebasJelkin` (array ausente) → bloque NO se pinta (candado 9)
- `GET /operacion` → **HTTP 200**.
- `grep -c 'Pruebas de Jelkin'` → **0** (el bloque NO aparece · sin error, sin hueco).
- Resto del tablero **intacto**: barra `Operación · Protección Infantil` (×1),
  `Recorridos de calidad` (×1), `Funcionalidades` (×1), footer `Tablero mantenido por el CEO` (×1).
- Captura del browser-pane: la tabla de recorridos (R-01…R-11) termina **directo en el footer**,
  sin bloque intermedio.
- DOM (browser JS) en vivo confirmó: `{ bloqueJelkinPresente: false, recorridosPresente: true,
  footer: "Producción 90b08980 · BI congelado · Fechas en hora de Colombia · Tablero mantenido por el CEO." }`.

## Nota sobre las capturas PNG
El browser-pane devolvió capturas legibles del caso (a) (bloque con datos, tags de color)
y del caso (b) (recorridos → footer sin bloque), pero el pane es inestable en este Mac de
RAM compartida (se oculta entre acciones · el scroll por rueda expira). Las capturas se
verificaron en pantalla durante la corrida; la evidencia **auditable y reproducible** queda
en los `.txt` verbatim de esta carpeta (curl HTTP + grep server-side + DOM), que no dependen
del pane. Si Fábrica requiere los PNG adjuntos y el pane sigue inestable, se re-capturan
cuando el Mac esté más holgado de RAM.
