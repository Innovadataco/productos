# SPEC-358 · Tasks

- [X] T001 Reproducir la traza por API (login → aceptar → /api/me): 200/201/200, la sesión está sana
- [X] T002 Reproducir en navegador: botón deshabilitado con documento al 100% y casillas marcadas
- [X] T003 Aislar la causa: un IntersectionObserver nuevo con el mismo root/threshold tampoco dispara
- [X] T004 [FR-001/002] Medida directa del scroll en montaje, scroll y resize; observer como refuerzo
- [X] T005 [FR-003] Resguardo de medición vacía (clientHeight === 0 no concluye)
- [X] T006 [FR-004] 3 tests con observer mudo (llegar al final / documento corto / casi al final)
- [X] T007 Verificación en vivo: candado puesto → scroll → habilita → clic → /dashboard/padre
- [X] T008 Gate: tsc, lint, unit 1928, build, arch:check
- [X] T009 Disciplina de specs + PR aparte (tanda 1)
