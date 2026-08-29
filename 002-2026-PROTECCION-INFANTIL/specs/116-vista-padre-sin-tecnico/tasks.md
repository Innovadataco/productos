# Tasks — Spec 116: Vista del padre sin traza técnica del motor

- [x] T001 [P] Test (rojo) `src/lib/expediente/mensaje-padre.test.ts`: describe `construirExplicacionPadre` — mismas plantillas, sin borrador/canales, sin score/modelos/%; genérica e institucional neutro.
- [x] T002 [P] Test (rojo) `src/app/api/reportes/mis-reportes/[id]/route.test.ts`: nuevo contrato (conductas confirmadas + mensaje), ausencia de `votosModelos`/`porcentajes`/`analisis`/`confianza`/scores, barrido JSON sin modelos ni categoría descartada; SPAM/OTRO filtrados; OTRO puro → mensaje neutro; 401/403/404/null intactos.
- [x] T003 [P] Test (rojo) `src/components/modules/MisReporteDetalle.test.tsx`: muestra conductas + "Qué significa esto" + canales oficiales; NO muestra modelos/%/votos/umbrales/"Evaluación por categoría"; sin conductas → neutro; en proceso intacto.
- [x] T004 FR-5: `construirExplicacionPadre` en `src/lib/expediente/mensaje-padre.ts` (refactor puro de helpers compartidos, salida de `construirMensajePadre` intacta).
- [x] T005 FR-3/FR-4: reescribir `src/app/api/reportes/mis-reportes/[id]/route.ts` al nuevo contrato (sin include de `rubricaVotos`, sin umbral, sin análisis).
- [x] T006 FR-1/FR-2: reescribir `src/components/modules/MisReporteDetalle.tsx` (chips confirmadas + mensaje + `<CanalesOficiales />`; tabla y análisis eliminados).
- [x] T007 Verde: tests tocados (`mensaje-padre`, route, componente) bajo candado `/tmp/pi-gate-lock`.
- [x] T008 Gate completo bajo candado: `npx tsc --noEmit` + `npm run lint` + `npm run test` + `npm run build`. (Suite 998/1018: 19 fallos ajenos de agentes en paralelo + specs-discipline por carpeta sin indexar → coordinador.)
- [x] T009 `cierre.md` + commits selectivos (sin push, sin tocar `specs/README.md` — lo indexa el coordinador).
