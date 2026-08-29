# Research — SPEC-114

**Date**: 2026-07-28

## Verificado en fuente antes de diseñar

- **I-38 (el segundo bloqueante)**: las páginas del área de padres (`src/app/dashboard/page.tsx`,
  `src/app/dashboard/mis-reportes/page.tsx`) NO contienen ningún enlace a `/reportar`; los
  únicos enlaces viven en la landing pública (`LandingHero.tsx:133`) y en
  `SeguimientoClient.tsx:227`. Un padre registrado no tiene camino de interfaz a la función
  central del producto. El recorrido del padre DEBE cazarlo (asertar la existencia del
  camino, no solo que `/reportar` responde).
- **Patrón de tests existente reutilizable**: `procesar/route.test.ts` (mocks de
  classifier/rubrica/embedder/pii/email), `circulo-confianza/route.test.ts` (mock de
  next/headers cookies), `proxy-sesion-roles.test.ts` (proxy real con JWT por rol).
- **Sesión/roles**: `proxy.ts` con `esRutaPermitidaSchoolAdmin`, `esDestinoPermitidoPorRol`
  (I-36), `SESION_ROUTES` (I-35/I-35b ya corregidas en SPEC-113).
- **§9**: helpers ya presentes — `param-encryption` (descifrar para verificar texto intacto),
  `reporte-normalizacion` (identificador normalizado), `ClasificacionRubricaVoto`
  (votos+preguntas canónicas), `AuditLog`, bcrypt en `auth.ts`.

## Decisiones

- **Decisión: la suite vive en `src/lib/e2e/` y corre en `npm run test`.** Misma
  infraestructura que la suite existente (BD compartida, `fileParallelism: false`): el CI
  la hereda sin cambios de pipeline.
- **Decisión: clasificación simulada con los mocks del pipeline existente** y una prueba
  lenta opt-in (`E2E_LENTA=true`) con el motor real. Un reporte real cuesta ~52 s: en el
  gate rápido es inviable (brief §6b).
- **Decisión: seed determinista parametrizado por ciclo** (`seed-ciclo.ts` con sufijo del
  número de ciclo): "datos nuevos" reales por ciclo sin aleatoriedad (determinista = suite
  estable).
- **Decisión: la aceptación se demuestra revirtiendo temporalmente SOLO la línea
  `SESION_ROUTES` de la SPEC-113** (stash local), corriendo los journeys de sesión y
  colegio (deben ir en ROJO) y restaurando.

## Deuda conocida de entrada (para la bitácora, no se decide aquí)

- **I-38**: el padre no tiene camino de interfaz a `/reportar`. El arreglo evidente (un
  enlace "Reportar" en el área del padre/header autenticado) se aplicará cuando el
  recorrido lo destape en ROJO (es defecto con respuesta evidente: falta el camino).
