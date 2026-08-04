# Cierre — SPEC-146 · Wizard unificado curso + estudiantes + identificadores

**Fecha**: 2026-08-04 · **Rama**: `work/002-pi-058` · **Estado**: IMPLEMENTADO

## Qué se entregó

Wizard de UNA pantalla (`/dashboard/colegio/cursos/unificado`, mockup §5.3/§5.4
del brief) que crea curso + estudiantes (con acudientes) + identificadores con
un solo guardado atómico, dry-run de Excel con "guardar solo los correctos",
primitivo `Accordion` nuevo con test de accesibilidad, y redirects permanentes
de `cursos/nuevo` y `cursos/carga` (nav → "Subir lista").

## Commits

| Commit | Contenido |
|---|---|
| `525a3170` | Schema Zod + endpoint unificado atómico + dry-run/plantilla (T001–T003) |
| `40c5e19e` | Primitivo Accordion + componentes del wizard (T004–T005) |
| (este) | Redirects, nav, CTAs, oráculo arch, docs de spec (T006–T007) |

Archivos por área:

- **Datos/endpoints**: `src/lib/schemas/index.ts` (+`payloadUnificadoSchema`),
  `src/lib/schemas/unificado.test.ts`,
  `src/app/api/colegio/cursos/unificado/route.ts` + `route.test.ts`,
  `.../unificado/validar/route.ts` + `route.test.ts`,
  `.../unificado/plantilla/route.ts`, `src/lib/colegio/unificado/validar-lista.ts`,
  `src/lib/colegio/carga/parser.ts` (aditivo: columnas opcionales de acudiente).
- **UI**: `src/components/ui/Accordion.tsx` + test,
  `src/components/modules/colegio/unificado/` (`WizardUnificado`, `SeccionCurso`,
  `TablaEstudiantes`, `ImportExcel`, `SeccionIdentificadores`, `tipos.ts` + 5 tests).
- **Rutas/nav**: `src/app/dashboard/colegio/cursos/unificado/page.tsx`,
  `nuevo/page.tsx` y `carga/page.tsx` (redirects 308; PageClients viejos
  eliminados), `src/lib/nav-items.ts` ("Subir lista" → wizard),
  `ColegioSideNav.tsx` (ícono del nuevo href), CTAs de home
  (`AccionesRapidas`, `EmptyStateColegio`, `AnillosProteccion` + sus tests) y
  botones de `CursosPageClient` ("Subir lista", nunca "carga masiva").
- **Arquitectura**: `docs/architecture/02-roles-capacidades.md` y
  `03-pantallas.md` regenerados; oráculo de páginas 52→53 en
  `scripts/arch/rutas-app.test.ts` (actualización intencional, patrón SPEC-126);
  piso de `tokens:check` 1166→1135 (ratchet a la baja).

## Evidencia

- **Atomicidad (SC-001)**: test "fallo en la última entidad (identificador
  duplicado en el payload) ⇒ 0 filas persistidas" — la segunda inserción
  detecta la primera DENTRO de la transacción y el rollback deja cursos,
  estudiantes, identificadores, acudientes y audit en cero.
- **A/B tenant (SC-003)**: profesor de otro colegio en el payload → 404 y nada
  persiste; el colegio B crea el mismo nombre de curso en SU tenant sin tocar A.
- **Dry-run (SC-002)**: Excel de 5 filas (4 buenas, 1 sin apellidos) → 4
  válidas + 1 problema ("Falta el apellido del estudiante"), sin persistir
  nada (ni sesión roster — conteos antes/después idénticos); la fila sin
  identificador es válida.
- **Redirects/nav (SC-004)**: `permanentRedirect` (308) en ambas páginas;
  aserción B de `arch:check` VERDE (87 hrefs evaluados, todos alcanzables).
- **Tests del área (SC-005)**: 50 archivos / 360 tests verdes — nuevos +
  `src/app/api/colegio/**` + `src/lib/colegio/**` + journeys colegio +
  componentes home + scripts/arch. Cero tests existentes modificados salvo los
  3 de home (SPEC-143) que fijaban los hrefs viejos y el oráculo de páginas.
- **Checks de día**: `tsc --noEmit` 0 errores · `lint` 0 errores ·
  `tokens:check` 1135 ≤ piso · `arch:check` VERDE (a–d).
- **Terminología §3**: los textos de UI nuevos no contienen "alumno", "carga
  masiva" ni "gestión de" (assert en `WizardUnificado.test.tsx`).

## Desviaciones y hallazgos

1. **Oráculo de páginas** (`scripts/arch/rutas-app.test.ts`): 52→53, cambio
   intencional con comentario (la regla del propio oráculo: prevalece el
   conteo real).
2. **Tests de home (SPEC-143)**: solo cambian los hrefs esperados al wizard
   (los CTAs eran el requisito FR-005); ninguna aserción de comportamiento
   tocada.
3. **`CursosPageClient`**: sus botones "Nuevo curso"/"Carga masiva" apuntaban
   a rutas redirigidas y uno usaba el término prohibido; ahora apuntan al
   wizard y dicen "Subir lista". Sin test propio.
4. **Piso de tokens** baja a 1135 (los PageClients eliminados sumaban 31
   ocurrencias de color crudo).
5. **Validator viejo intacto**: sigue exigiendo identificador por fila (su
   test lo fija); la opcionalidad del wizard vive en el wrapper
   `validarFilasUnificado`.
6. No se corrió `./scripts/dev-restart.sh` (entorno compartido con otros
   frentes en esta máquina); la verificación fue la batería de checks + tests.

## Deuda técnica

Ninguna nueva. `cursos/[id]` y `alumnos/[id]` siguen sobre los endpoints viejos
(`/api/colegio/cursos`, `/alumnos/*`, `/carga/*`) hasta SPEC-147 (decisión de
alcance documentada en el encabezado de la spec).
