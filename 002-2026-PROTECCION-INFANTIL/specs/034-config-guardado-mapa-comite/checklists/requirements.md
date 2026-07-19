# Requirements Checklist — Spec 034

## User Story 1 — Redirect y protección del rol Comité
- [x] `src/app/login/page.tsx` incluye `COMITE_VALIDACION` en redirect post-login.
- [x] Tras login, `COMITE_VALIDACION` va a `/dashboard/admin/comite`.
- [x] `src/app/mis-reportes/page.tsx` redirige roles internos a su área.
- [x] `src/app/dashboard/circulo-confianza/page.tsx` redirige roles internos a su área.
- [x] `PARENT` accede normalmente a `/mis-reportes` y `/dashboard/circulo-confianza`.
- [x] `ADMIN`/`SCHOOL_ADMIN`/`OPERADOR` redirigen a `/dashboard/admin`.
- [x] No se muestra error 403 visible al acceder como rol interno.

## User Story 2 — Guardado explícito con UPSERT
- [x] `PATCH /api/config/parametros/[clave]` soporta UPSERT.
- [x] El endpoint acepta `tipo`, `categoria`, `esPublico`, `esSecreto`, `descripcion` en el body.
- [x] Se registra audit log `PARAM_UPDATE` en creación y actualización.
- [x] `CategoriaGruposEditor.tsx` no usa autosave.
- [x] `CategoriaGruposEditor.tsx` muestra botón "Guardar cambios".
- [x] El botón se habilita solo cuando hay cambios.
- [x] Se muestra mensaje de confirmación al guardar.
- [x] Se muestra mensaje de error si falla.
- [x] Se advierte con `beforeunload` si hay cambios sin guardar.
- [x] El fallback se carga en silencio sin mostrar "Parámetro no encontrado".
- [x] `ConfigPanel.tsx` advierte con `beforeunload` si hay cambios sin guardar.
- [x] `ConfigPanel.tsx` muestra indicador visual de campos editados.

## User Story 3 — Rediseño visual del mapa
- [x] El mapa carga centrado en Colombia/LATAM por defecto.
- [x] Existe leyenda visible con escala rojo/naranja/verde.
- [x] Los países se colorean según cantidad de reportes.
- [x] Se mapean nombres de países español→inglés al menos para los países con reportes.
- [x] Hover resalta el país.
- [x] Popup muestra nombre y conteo.
- [x] Burbujas de ciudad muestran número y nombre.
- [x] Popup de ciudad muestra ciudad, país y conteo.
- [x] El mapa funciona sin acceso a internet (datos locales).
- [x] Diseño sigue el Design System existente (colores, sin emojis, transiciones).

## General
- [x] Todos los artefactos Spec-Kit están creados.
- [x] `npm run lint` pasa sin errores.
- [x] `npx tsc --noEmit` pasa sin errores.
- [x] `npm run test` pasa.
- [x] `npm run build` compila exitosamente.
- [x] `./scripts/dev-restart.sh` levanta la app en `:5005` con un solo worker.
- [x] Se completó el `quickstart.md` manualmente.
- [x] Se generó `cierre.md` y se actualizó la sección Implementación en `spec.md`.
- [x] Se registró deuda técnica si aplica.
- [x] Se hicieron commits: uno por User Story + uno de docs.
- [x] Se hizo push a `feature/001-scaffolding`.
