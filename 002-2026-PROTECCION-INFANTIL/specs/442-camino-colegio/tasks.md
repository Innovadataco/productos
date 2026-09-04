# SPEC-442 · Tasks

## Hecho (este PR)

- [x] Grep de callers de `Colegio.create` en `src/` y reporte al CEO ANTES de codificar.
- [x] `src/lib/colegio/semilla-colegio.ts` — helper `sembrarSemillaColegio` (materias + cursos + onboarding). Idempotente.
- [x] 3 callers pasan por el helper: admin, registro público, smoke-prod-safe.
- [x] `admin/colegios/route.ts` — retirado el `OnboardingColegioRepository.crear` separado (lo hace el helper).
- [x] `registro-colegio.ts` — colapsadas 3 llamadas en 1.
- [x] `smoke-prod-safe.ts` — llama al helper después del create; el borrado FK-safe elimina cursos + materias + onboarding antes del colegio.
- [x] Pantalla paso 4 (`cursos/page.tsx`) — conteo real, título dinámico, CTA «Crear un curso», botón «Atrás».
- [x] Pantalla paso 3 (`profesores/page.tsx`) — formulario individual in-place. Ya NO expulsa al panel.
- [x] Botón «Atrás» en pasos plan, profesores, cursos y estudiantes.
- [x] `ProfesoresPageClient.tsx` — año nacimiento con `min/max` + `RANGO_ANIO_NACIMIENTO`.
- [x] `schemas/identidad.ts` — rango real 18–80 años.
- [x] `carga-profesores/validator.ts` — mismo rango en la carga Excel.
- [x] `camino/layout.tsx` — cuando el pathname es de colegio, se colapsa (footer duplicado eliminado).
- [x] `camino/colegio/layout.tsx` — ancho `max-w-4xl` exclusivo para el paso plan.
- [x] Candado por conducta `semilla-colegio.test.ts` (2/2) + regresión verificada.
- [x] `scripts/spec-442-reparar-colegios-sin-cursos.ts` — idempotente, con `--dry-run`.
- [x] `arch:check` VERDE.
- [x] `tokens:check` piso 1079.
- [x] `npm run lint` 0 errors.

## Seguimiento (fuera de este PR)

- [ ] Convertir «Cargar lista desde Excel» y «Agregar uno a uno» del paso estudiantes en flujos in-place (radicado nombró solo profesores; hoy siguen expulsando al panel).
- [ ] Ratchet estático que enumere `prisma.colegio.create` en `src/` + `scripts/` y verifique que TODO callsite productivo tiene una llamada a `sembrarSemillaColegio` en el mismo archivo — cierra la clase incluso ante un cuarto camino.
- [ ] E2E Playwright del camino colegio completo con seed determinístico (rector → plan → profesores → cursos → estudiantes → listo).
