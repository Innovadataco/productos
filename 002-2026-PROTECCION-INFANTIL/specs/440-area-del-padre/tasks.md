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
