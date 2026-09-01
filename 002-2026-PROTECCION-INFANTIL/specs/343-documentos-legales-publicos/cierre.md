# Cierre · SPEC-343 — Documentos legales públicos limpios (I-232)

**Fecha:** 2026-09-01 · **Rama:** `work/pi-SPEC-343-documentos-legales-publicos` · **Autor:** Dev PI-2

## Qué se entregó

1. **Documentos públicos limpios** (criterio A de Jelkin, sin línea de revisión jurídica):
   - `public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` — secciones 1–14 +
     Aviso de Privacidad; 0 marcadores internos; fecha real (1 de septiembre de 2026)
     y URL real (https://pi.innovadataco.com/politica-datos).
   - `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md` — cláusulas
     1–14 continuas; plazos resueltos (72 horas / 30 días calendario / 2 años);
     campos de plantilla del colegio conservados.
2. **Borradores internos fuera de la web**: `git mv` puro a `docs/legal/` (contenido
   intacto, byte a byte). La URL antigua `/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md`
   responde 404 (verificado en navegador).
3. **Render markdown real y seguro** en `ModalConsentimiento.tsx`: react-markdown +
   remark-gfm sin rehype-raw (HTML escapado por construcción); tablas envueltas en
   `overflow-x-auto`; plugin @tailwindcss/typography registrado (las clases `prose`
   del modal estaban muertas desde SPEC-241 — hallazgo 15v5 corregido aquí).
4. **Parámetros**: seed apunta a los dos públicos nuevos; `consentimiento.version_actual`
   queda en `v0.4` (nadie re-firma). Test-utils y test de route actualizados.
5. **Test-candado** `src/lib/legal/documentos-servidos.test.ts`: lee las rutas que
   siembra el seed y falla si lo servido contiene `[ABOGADO`, `CERRADO internamente`
   o `BORRADOR`; además exige rutas bajo `public/legal/` y versión intacta.

## Evidencia del gate (Mac local, 01-09-2026)

| Paso | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores (60 warnings preexistentes de complejidad en archivos ajenos) |
| `npm run test:unit` | ✅ 234 archivos · 1850 tests |
| `npm run test` (integración) | ⚠️→✅ 2507/2524 en la corrida larga con 6 fallos en 5 archivos AJENOS al diff (email.migracion, queue-reconciliacion, admin/padres DELETE, seed-freemium, probe-indices) — re-corridos aislados: 47/47 verdes ⇒ interferencia de la corrida larga (BD test compartida bajo carga), no regresión de esta spec. Árbitro final: CI del PR |
| `npm run build` (con `rm -rf .next`) | ✅ |
| `npm run arch:check` | ✅ VERDE tras regenerar `06-stack.md` (deps nuevas de render) |
| `./scripts/dev-restart.sh` | ✅ app + workers arriba |

## Evidencia de recorrido real (navegador, app local)

- Login PARENT de prueba → camino guiado «Paso 1 de 4 · Permiso» → política
  renderizada como documento (títulos, negritas, tabla real «Período de retención»);
  cero `#`/`**`/`|` crudos; cero marcadores internos (captura en la sesión).
- Aceptación con payload real → 201; `audit_consentimientos.documentoHash` =
  SHA-256 exacto del archivo público nuevo (`60638486aa47…bea8b4`); versión `v0.4`.
- El usuario aceptado NO vuelve a ver el modal (pasa al Paso 2 «Cuéntanos de ti»).
- Móvil 375 px: página sin scroll horizontal (`document.scrollWidth == clientWidth`),
  tabla desplazándose dentro de su contenedor `overflow-x-auto`.
- `/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` → 404 · los dos públicos nuevos sirven.
- Nota de entorno: el candado de scroll-hasta-el-final no se pudo disparar por
  interacción en el pane embebido (página `visibilityState: hidden` ⇒ los
  IntersectionObserver no corren); el mecanismo NO se tocó en esta spec y queda
  cubierto por los tests unitarios (habilitación al intersecar el sentinel) y por
  el recorrido post-deploy del CEO.

## Para el deploy (acción del CEO, pegada al deploy)

UPDATE en BD de producción — ruta vieja → ruta nueva (ventana de segundos asumida
por el CEO, decisión 01-09-2026 01:00):

| Parámetro | Viejo | Nuevo |
|---|---|---|
| `consentimiento.padre.documento_ruta` | `public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md` | `public/legal/POLITICA-TRATAMIENTO-DATOS-v1.0-publica.md` |
| `consentimiento.colegio.documento_ruta` | `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md` | `public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS-v1.0-publico.md` |

`consentimiento.version_actual` NO se toca.

## Deuda técnica y pendientes

- **Cláusula de Responsabilidad del convenio**: pendiente de la ronda jurídica
  (era 100 % un bloque `[ABOGADO]`); cuando el abogado la redacte se restituye al
  convenio público con su renumeración. Registrado también en la spec.
- Los `.docx` que los borradores mencionan no existen en el repo (solo los `.md`);
  si aparecen en otra parte, la versión Word habrá quedado desactualizada respecto
  a la v1.0 pública.
- Usuario de prueba `dev2.spec343@local.test` (PARENT) quedó en la BD dev con
  consentimiento anulado — dato de prueba local, inocuo.

## Commits (uno por historia + docs)

Setup (deps+tailwind) · US1 (política) · US2 (convenio) · US3 (modal+tests) ·
US4 (mudanza) · US5 (seed+candado) · línea base 06-stack.md · docs (specs/343 + README).
