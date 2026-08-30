# TASKS-033 · Vista `/operacion`

## F1 · Lector + tipos
- [x] `src/lib/bi/operacion.ts` · tipos del contrato · `leerOperacion()` con try/catch (ausente/invalido) · ruta desde env
- [x] Normalizadores puros: `claseEstadoPersona` · `claseTag` · `anchoBarra` (sin div/0) · `mostrar`

## F2 · Estilos
- [x] `src/app/operacion/operacion.css` · variables light+dark + clases del artefacto (verbatim) · responsive 640px

## F3 · Fuentes IBM Plex
- [x] `next/font/google` IBM Plex Sans + Mono · auto-hosteadas (CSP font-src 'self') · variables CSS

## F4 · Componentes
- [x] `RelojColombia.tsx` (client · Intl America/Bogota · setInterval 1s · fallback)
- [x] `BarraOperacion.tsx`
- [x] `EquiposChips.tsx` (+ leyenda · estado desconocido→off+crudo)
- [x] `TablaFuncionalidades.tsx` (11 col + banner alerta)
- [x] `TablaRecorridos.tsx` (9 col + barra + need/hard · orden del array)
- [x] `AvisoSinDatos.tsx`

## F5 · Página
- [x] `src/app/operacion/page.tsx` · `force-dynamic` · leerOperacion · ok→3 bloques / !ok→aviso · sin URLs

## F6 · docker-compose
- [x] Volumen `ro` `/opt/proteccion-infantil/bi-operacion:/data:ro` + env `OPERACION_JSON_PATH` en bi-next (no crea el archivo)
- [x] Nota de deploy en PR: verificar con `docker exec <bi-next> cat /data/operacion.json` (I-31)

## F7 · Tests unitarios
- [x] `bi-operacion-lector.test.ts` · presente / ausente / inválido
- [x] `bi-operacion-normalizadores.test.ts` · enums · tags · ancho barra · mostrar
- [x] `bi-operacion-render.test.tsx` · orden array · teNecesita hard · estado desconocido · aviso motivos

## F8 · Gate local
- [x] `rm -rf .next && npm run build` verde
- [x] `npm run typecheck` verde
- [x] `npx vitest run` verde
- [x] Ratchets 4/5 verdes

## F9 · Evidencia §6 (candado 25 · sin esto NO hay CUMPLE)
- [x] (a) captura render 3 bloques data real (light + dark)
- [x] (b) captura archivo ausente → aviso claro
- [x] (c) reloj Colombia corriendo + fechas DD-MM-AAAA HH:MM
- [x] (d) móvil no rompe (captura/nota)
- [x] (e) TABLERO VIVO: editar fixture → recargar sin rebuild → 2 capturas antes/después con el cambio reflejado

## F10 · Push + PR
- [x] commit + push (PR #173 ya abierto en spec+plan · se actualiza con el código)
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-033 · REALIZADO · <hash> · gh pr checks OK + capturas §6`

## Reglas duras
- [x] Diseño copiado del artefacto · NO rediseñar
- [x] Solo rutas permitidas (operacion, components/bi/operacion, docker-compose, tests, fixture)
- [x] NO tocar dashboard/layout/motor/api-bi/auth/superset/scripts ni lo congelado
- [x] Fechas verbatim · nunca parsear
- [x] Sin capturas §6 → no CUMPLE
