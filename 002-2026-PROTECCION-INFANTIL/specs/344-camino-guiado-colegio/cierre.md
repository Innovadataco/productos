# Cierre · SPEC-344 — El camino guiado del colegio (A-69 · Fase C1)

**Fecha:** 2026-09-01 · **Rama:** `work/pi-SPEC-344-camino-colegio` · **Autor:** Dev PI-2

## Qué se entregó

1. **Registro por enlace del colegio** (mockup 1.1): correo + nombre + NIT →
   enlace 24 h single-use → crear clave → aterriza en el Paso 1. El código de
   6 dígitos se retiró. **Anti-enumeración por AMBAS dimensiones** (correo Y
   NIT, matiz CEO 03:18): las 4 combinaciones responden idéntico; el aviso va
   solo al buzón (`cuenta_existente` / `nit_ya_registrado`). `TokenRegistro`
   ganó `rol` + `nombreColegio` + `nit` (aditivos); el completar fuerza el rol
   del token — un token de padre NO puede consumirse por la ruta del colegio
   (probado).
2. **Guardián del camino extendido a SCHOOL_ADMIN** sin duplicar mecanismo:
   `pasos-colegio.ts` (Edge-safe, 5 pasos), `estado-colegio.ts` (derivación
   sin columna — misma regla anti-I-211 del padre), emisor por rol,
   middleware con `destinoParaRol`, rebote fail-closed compartido, invariante
   cruzada de guardias GENERALIZADA por rol (antes hardcodeaba PARENT —
   habría dejado pasar bucles del colegio hasta producción).
3. **Paso 1 · Quién responde**: 5 campos del rector persisten en `Usuario`
   (patrón A-67) y se reflejan en `Colegio.representanteLegal*` — retro-llena
   el literal `"PENDIENTE"` del auto-registro viejo (verificado en recorrido).
4. **Paso 2 · Plan + puente D2** (matiz CEO): activar freemium (endpoint
   nuevo espejo del padre) o solicitar plan pagado ESCRIBE
   `Colegio.finServicio` (freemium = hoy + `pagos.freemium.duracion_dias`;
   pagado = según `Plan.duracion` vía `calcularFinServicio` de A-64).
   **"Gratis para siempre" muerto** para todo colegio que pase el camino
   (verificado: finServicio = hoy+30 tras freemium).
5. **Paso 3 · Profesores**: alta individual (existente, ahora sella cookie) +
   **Excel FRESCO** (parser/validator/importer escritos contra main, matiz
   CEO; `bc49277fc` solo como referencia): plantilla autoconsistente con
   test-candado, validar dry-run con token 15 min, confirmar single-use vía
   `CargaRosterSesion` con shape propio de profesores.
6. **Paso 4 · Cursos**: 11 grados sembrados al crear el colegio
   (`crearCursosPorDefecto`, idempotente, D-5) + **candado D3 en servidor**:
   materia sin profesor → 400 "Toda materia debe llevar un profesor a cargo"
   (schema + repo; el Prisma sigue nullable por el histórico) + **PATCH de
   reasignación en línea** (FR-031, antes solo DELETE+POST).
7. **Paso 5 · Estudiantes**: acudiente ganó documento OPCIONAL aditivo
   (schema + repo + create anidado del alta de estudiante); wizard unificado
   enlazado desde el paso y exento del guardián.
8. **Sellado transversal** (analyze I1): profesores/alumnos/unificado/cursos
   POST re-sellan `sesion_estado` — el paso avanza al instante (SC-004).
9. **I-245 cerrada**: plantilla oficial de alumnos ganó
   `documento_tipo_alumno`/`documento_numero_alumno` + fila de ejemplo
   válida + test-candado autoconsistente (y el mismo candado para la de
   profesores).
10. **OnboardingColegio APAGADO** (FR-041): el modal ya no se monta; modelo,
    endpoints y componente se conservan (nada-se-borra, reversible).
11. **Logout expira `sesion_estado`** (FR-044, hueco heredado de A-67).
12. **Guard del resetDatabase**: aborta si la BD no contiene "test" —
    también entregado como hotfix SPEC-352 (`b4de8a409`) por orden del CEO
    tras el triple arrasamiento de la BD dev de esta madrugada.

## Evidencia del gate (Mac local, 01-09-2026)

| Paso | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores (warnings preexistentes de complejidad) |
| `npm run test:unit` | ✅ 236 archivos · 1855 tests (incluye guardias/emitter/middleware extendidos + 2 test-candados de plantillas + guard resetDatabase) |
| `npm run test` (integración) | ✅ ver resultado en el PR (suite completa) — focalizada de lo tocado: 17 archivos · 116 tests verdes |
| `npm run build` (con `rm -rf .next`) | ✅ |
| `npm run arch:check` | ✅ VERDE tras regenerar 01-modelo-datos, 02-roles-capacidades, 03-pantallas |
| `./scripts/dev-restart.sh` | ✅ |

## Evidencia de recorrido real (payload real, 17 pasos verdes)

```
1.solicitar 202 · 2.completar 201 · 3.guardián sin consentir → /consentimiento
4.convenio 201 · 5.rector 200 (retro-llena PENDIENTE) · 6.guardián → /camino/colegio/plan
7.freemium 201 · 8.finServicio hoy+30 días · 9.profesor individual 201
10.excel validar {crear:2, omitidos:1, errores:0} · 11.excel confirmar 201
12.D3 sin profesor → 400 mensaje humano · 13.con profesor → 201 · 14.PATCH reasignar 200
15.alumno+acudiente 201 · 16.acudiente-doc CC persistido · 17.camino completo → dashboard abre
```

Además: regresión del padre verificada con flujo real (registro por enlace
PARENT intacto, guardián lo lleva a su Paso 1, token de padre rechazado en la
ruta del colegio) · móvil 390 px sin overflow horizontal en crear-clave,
consentimiento y Paso 1 (screenshots en sesión) · bugs cazados por el
recorrido y arreglados: shape del roster de profesores, create anidado de
acudientes sin documento, mensaje genérico del D3.

## Incidencia colateral (reportada al CEO en vivo)

La BD dev compartida fue **arrasada 3 veces** durante la jornada por una
suite de integración externa corrida con `DATABASE_URL` apuntando a dev
(evidencia: usuario `test-1788268359332-…` creado 08:12:39; huella de
plataformas del propio reset). El CEO identificó y frenó el proceso; el guard
(`validarBdDeTest`) viaja como hotfix SPEC-352 (`b4de8a409`) y también en
esta rama.

## Deuda técnica y pendientes (fases posteriores del brief A-69)

- Unificación profunda de la vigencia del colegio (← Suscripción en vez de
  `Colegio.finServicio`) — otra spec del brief.
- Pantalla de cursos del camino usa la ficha del curso existente para
  materias; una vista embebida más rica es C6+.
- `EstadoActivacion.ACTIVO` sigue sin escribirse en ningún flujo (heredado).
- E2E Playwright `camino-colegio.spec.ts` (T055) queda para la ronda diurna
  si el CEO lo pide — el recorrido real de payload cubrió los 17 pasos y las
  suites unit/integración cubren los guardianes; escribirlo requiere
  levantar `npm run dev` con flags E2E que pelean con la BD compartida
  mientras Dev PI-1 trabaja.
- Usuarios/colegios de prueba `dev2.*@local.test` en BD dev — datos de
  prueba locales, inocuos.

## Commits (por historia)

setup → Foundational → US1 → US2/US3 → US4 → US5 → US6 → US7 → Phase 9-bis →
I-245 → fixes de recorrido + candados + OnboardingModal → docs. Hotfix
SPEC-352 en rama aparte (`b4de8a409`).
