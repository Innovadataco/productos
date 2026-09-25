# Tasks · SPEC-730

## Extracción de la rejilla (sin cambio de conducta)
- [x] `components/modules/calendario/fechas.ts` (movida + `estiloBloque` + `posicionBogota`)
- [x] `components/modules/calendario/Rejilla.tsx` (`RejillaCalendario` presentacional genérica + `BellIcon`)
- [x] `components/modules/calendario/NavCalendario.tsx` + `useCalendarioNav.ts`
- [x] `profesional/calendario/Rejilla.tsx` → solo `BloqueFranja` + `OverlayDiaProfesional`
- [x] `CalendarioProfesional.tsx` compone `RejillaCalendario` (conserva `instanteDesdeHoraBogota` + literales de API)
- [x] Candados 714 verdes: calendario (API + hora), voz usted, materializar, dashboard-profesional-forma

## Padre — elegir franja
- [x] `RejillaElegirFranja.tsx` (mapea franjas libres → rejilla; botón que selecciona)
- [x] `SolicitarCitaPanel` usa la rejilla; fuera lista/chip/`finDeSemana`
- [x] `spec712-pedir-cita` §3 actualizado (lista→rejilla); §1/§2/§4/§5 intactos

## Padre — «Mis citas»
- [x] `RejillaMisCitas.tsx` (citas → rejilla; bloque = enlace al detalle existente)
- [x] `citas/page.tsx` usa la rejilla; `MisCitasList.tsx` eliminado
- [x] `boton-frontera` (deuda del tile movida) + `superficie-invertida-i381` (marca → `RejillaMisCitas`) al día

## Candado + preflight
- [x] `calendario-padre.candado.test.tsx` (mutación-verificado: sin `[data-col]` → rojo)
- [x] `tsc --noEmit` (0) · `eslint` (0 errores)
- [ ] `arch:check` verde (a–i)
- [ ] `specs-discipline` verde
- [ ] CI por rollup completo (lo verifica el CEO antes de mergear)

## Verificación en vivo (post-deploy, tras merge del CEO)
- [ ] Pedir cita: elegir franja en la rejilla; se crea la solicitud
- [ ] «Mis citas»: ver las citas en la rejilla; entrar al detalle
- [ ] Profesional: publicar/responder sin cambios (rejilla igual)
