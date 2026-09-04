# SPEC-440 · Tasks

## Hecho (este PR — punto 1 del radicado)

- [x] Helper `src/lib/padre/borrador-consulta.ts` (sessionStorage tolerante a fallos).
- [x] `PresentacionUrgenciaForm` — guarda borrador y navega sin `?u=&pres=`. Prellena si vuelve.
- [x] `SolicitarCitaPanel` — lee borrador al montar (no en reasignación); limpia tras POST exitoso.
- [x] `DirectorioProfesionales` — sin props ni queryString con PII; hereda solo IDs opacos.
- [x] `ProfesionalPerfil` — retirados props `presentacionDelPadre`/`urgencia`.
- [x] Pages server (`profesionales/page.tsx`, `directorio/page.tsx`, `[id]/page.tsx`) — `searchParams` sin `u` ni `pres`.
- [x] Candado permanente `borrador-consulta.candado.test.ts` (2/2). Regresión verificada muriendo con el defecto puesto.
- [x] `arch:check` VERDE, `tokens:check` piso 1079, `npm run lint` 0 errors.

## Seguimiento (fuera de este PR — puntos 2 a 5 del radicado)

- [ ] P2 · El círculo de confianza dibuja solo 4 personas cuando hay 5+. Definir cómo se ve con 10 y con 20 sin volverse ilegible (tope 20 del brief).
- [ ] P3 · `/mis-reportes` sin barra lateral «Mi protección». Mismo componente que las otras pantallas del padre.
- [ ] P4 · Pantalla `/dashboard/padre/perfil` que muestre y permita editar los campos de BRIEF A-67 §59: nombres, apellidos, tipo y número de documento, teléfono, país, ciudad. Ya están en `Usuario` (SPEC-334); falta la pantalla.
- [ ] P5 · Guardar presentación y urgencia en el perfil del padre; el flujo `/dashboard/padre/profesionales` la prellena y la deja editar. Cuando esto entre, el helper sessionStorage sigue como caché rápida.

## Ola 2 (PR apilado sobre este — puntos 2/4/5, P3 esperando decisión CEO)

- [x] **P2** · `IlustracionCirculo.tsx` — antes hacía `slice(0, 4)` siempre. Ahora `puestosParaN(n)` distribuye N personas en anillo (equidistantes, tope brief 20); radio del avatar y font adaptativos (menos legible que 4, pero completo). Con N ≤ 4 conserva la doble diagonal actual + lugares libres. Nuevo `IlustracionCirculo.test.tsx` (7 tests, unit) — cuenta puestos dibujados con 0/3/4/5/10/20 + aria-label reporta el total. Verificado por mutación: volver a `slice(0, 4)` mata 4 tests.
- [x] **P4** · La pantalla `/dashboard/padre/perfil` ya existía completa desde SPEC-334 (formulario con los 7 campos del brief A-67 §59). El bug real era que SPEC-317 la había RETIRADO del nav lateral por hueco temporal — el padre no podía llegar. Fix quirúrgico: reincorporar `"/dashboard/padre/perfil"` a `PADRE_NAV_ITEMS`; `PadreSideNav.test.tsx` actualizado (10 items, incluye "Mi perfil").
- [x] **P5** · Campos aditivos `Usuario.presentacionEstandar` + `Usuario.urgenciaEstandar` (`String?`, migración con `IF NOT EXISTS` — sin enum para no atascar `bi_replica`). `UsuarioRepository.obtenerPerfilPadre` y `actualizarPerfilPadre` los incluyen. Endpoint `PATCH /api/padre/perfil` acepta ambos con validación Zod (mín 10 max 500; enum "ESTA_SEMANA"|"SIN_APURO"). `PresentacionUrgenciaForm` prellena desde perfil cuando sessionStorage está vacío (el borrador GANA — es lo más fresco), y al enviar hace PATCH fire-and-forget al perfil. Nuevo `PresentacionUrgenciaForm.test.tsx` (4 tests unit). Verificado por mutación: quitar el PATCH mata el test «guarda al perfil al enviar».
- [x] **P3** · CEO 17:1x decidió opción (B) — se AGREGA `PadreSideNav` a `/mis-reportes` reusando el shell del padre; no se le quita al resto. `src/app/mis-reportes/layout.tsx` copia la estructura de `/dashboard/padre/layout.tsx` (SideNav + NavMovil + banner de vigencia). Preserva la guarda SPEC-119 (padre vencido → `ServicioVencidoScreen`). Anónimos y roles internos entran sin shell (backwards compat). Candado `src/app/mis-reportes/layout.candado.test.ts` (unit, 4 tests) verifica que el layout monta `PadreSideNav` + `PadreNavMovil` + `theme-padre` + guarda de vigencia. Verificado por conducta: retirar el import de `PadreSideNav` mata el candado.
