# TASKS-033 · Vista `/operacion`

## F1 · Lector + tipos
- [ ] `src/lib/bi/operacion.ts` · tipos del contrato · `leerOperacion()` con try/catch (ausente/invalido) · ruta desde env
- [ ] Normalizadores puros: `claseEstadoPersona` · `claseTag` · `anchoBarra` (sin div/0) · `mostrar`

## F2 · Estilos
- [ ] `src/app/operacion/operacion.css` · variables light+dark + clases del artefacto (verbatim) · responsive 640px

## F3 · Fuentes IBM Plex
- [ ] `next/font/google` IBM Plex Sans + Mono · auto-hosteadas (CSP font-src 'self') · variables CSS

## F4 · Componentes
- [ ] `RelojColombia.tsx` (client · Intl America/Bogota · setInterval 1s · fallback)
- [ ] `BarraOperacion.tsx`
- [ ] `EquiposChips.tsx` (+ leyenda · estado desconocido→off+crudo)
- [ ] `TablaFuncionalidades.tsx` (11 col + banner alerta)
- [ ] `TablaRecorridos.tsx` (9 col + barra + need/hard · orden del array)
- [ ] `AvisoSinDatos.tsx`

## F5 · Página
- [ ] `src/app/operacion/page.tsx` · `force-dynamic` · leerOperacion · ok→3 bloques / !ok→aviso · sin URLs

## F6 · docker-compose
- [ ] Volumen `ro` `/opt/proteccion-infantil/bi-operacion:/data:ro` + env `OPERACION_JSON_PATH` en bi-next (no crea el archivo)
- [ ] Nota de deploy en PR: verificar con `docker exec <bi-next> cat /data/operacion.json` (I-31)

## F7 · Tests unitarios
- [ ] `bi-operacion-lector.test.ts` · presente / ausente / inválido
- [ ] `bi-operacion-normalizadores.test.ts` · enums · tags · ancho barra · mostrar
- [ ] `bi-operacion-render.test.tsx` · orden array · teNecesita hard · estado desconocido · aviso motivos

## F8 · Gate local
- [ ] `rm -rf .next && npm run build` verde
- [ ] `npm run typecheck` verde
- [ ] `npx vitest run` verde
- [ ] Ratchets 4/5 verdes

## F9 · Evidencia §6 (candado 25 · sin esto NO hay CUMPLE)
- [ ] (a) captura render 3 bloques data real (light + dark)
- [ ] (b) captura archivo ausente → aviso claro
- [ ] (c) reloj Colombia corriendo + fechas DD-MM-AAAA HH:MM
- [ ] (d) móvil no rompe (captura/nota)
- [ ] (e) TABLERO VIVO: editar fixture → recargar sin rebuild → 2 capturas antes/después con el cambio reflejado

## F10 · Push + PR
- [ ] commit + push + `gh pr create --base main`
- [ ] Señal: `desarrollo-bi-2: BI-SPEC-033 · REALIZADO · <hash> · gh pr checks OK + capturas §6`

## Reglas duras
- [ ] Diseño copiado del artefacto · NO rediseñar
- [ ] Solo rutas permitidas (operacion, components/bi/operacion, docker-compose, tests, fixture)
- [ ] NO tocar dashboard/layout/motor/api-bi/auth/superset/scripts ni lo congelado
- [ ] Fechas verbatim · nunca parsear
- [ ] Sin capturas §6 → no CUMPLE
