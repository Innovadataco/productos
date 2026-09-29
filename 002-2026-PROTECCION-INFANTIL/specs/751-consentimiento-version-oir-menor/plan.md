# Plan — SPEC-751 · Consentimiento por versión + «oír al menor» per-menor

> Compuerta §4: PARO tras spec+plan+tasks para aprobación del CEO + respuesta de abogado (FR-007/FR-008). Implementación DESPUÉS.

## Punto de partida (verificado en el código, no supuesto)

- Mecanismo de consentimiento por versión: **ya existe** (SPEC-241). No se toca su núcleo.
  - `Usuario.consentimiento{AceptadoEn,Version,DocumentoHash,IP}` + `AuditConsentimiento` (inmutable, por versión).
  - `ConsentimientoService.versionEstaActual` + guard `requiereConsentimientoActual` + `/consentimiento` + `POST /api/consentimiento/aceptar`.
  - `consentimiento.version_actual` en `ParametroSistema` (`prisma/seed.ts:219`).
- `Hijo` (SPEC-339): ficha del menor con DUEÑO (`usuarioId`), estado activo/inactivo. **Sin ningún campo de audiencia.**

## Diseño (contrato — lo que aprueba el CEO)

### Datos (aditivo)
1. `Hijo`: `oidoEn DateTime?`, `oidoVersion String?` (denormalizado, para el gate rápido; espeja `Usuario.consentimientoVersion`).
2. Nueva tabla `AudienciaMenor` (inmutable, probatoria):
   - `id`, `hijoId` (FK Cascade), `usuarioId` (FK Cascade, el representante que declara), `version`, `declaradoEn @default(now())`, `ip`, `userAgent String?`, `declaracion String` (texto/di­gest del enunciado legal declarado).
   - índices `(hijoId, declaradoEn)`, `(version)`. `@@map("audiencias_menor")`.
   - Migración **aditiva** escrita a mano (patrón de las de consentimiento); nada destructivo.

### Servicio / puerta
3. `AudienciaMenorService` (espejo de `ConsentimientoService`): `menorEstaAlDia(hijoId)`, `menoresPendientes(usuarioId)`, `declarar({hijoId, usuarioId, ip, userAgent})` en `withUnitOfWork` (crea `AudienciaMenor` + sella `Hijo.oidoEn/oidoVersion` en la MISMA tx). DAL: repos, sin `@/lib/prisma` directo (Q-3).
4. Extender el predicado de la puerta: «al día» = consentimiento de cuenta vigente **Y** `menoresPendientes(usuarioId).length === 0` (solo ACTIVOS). Reusar `esTitularDelDato`. La decisión vive en la MISMA fuente para página y endpoint (dos superficies, un predicado — como SPEC-756).

### Superficie
5. Endpoint `POST /api/audiencia-menor/declarar` (autentica, 403 si no titular, idempotente por versión como `aceptar`, `AuditLog`).
6. UI: paso/modal per-menor. Ubicación a confirmar con Diseño/CEO (candidato: paso del camino guiado SPEC-339 o modal análogo a `ModalConsentimiento`). **El TEXTO es [ABOGADO]** — placeholder marcado, no copy inventado.

### Parametrización
7. `audiencia_menor.reoir_en_cambio_de_version` (bool) — FR-008/D-4, para no cablear la política. Sembrado idempotente con default de FORMA (re-oír), a confirmar por abogado.
8. `audiencia_menor.documento_ruta` o clave de texto legal — FR-007, cuando llegue de abogado.

## Candados (fase implementación)
- C-puerta per-menor (mock consentimiento de cuenta vigente; forzar menor sin versión → pide; con versión → pasa; control positivo).
- C-per-menor-no-global (dos menores, remoción del discriminador `hijoId`).
- C-inmutable/versión, C-activos, C-no-romper-cuenta (regresión SPEC-241).
- D-121: `AudienciaMenor` clasificada (PRESERVADOS/orden de borrado) + FK Cascade verificadas; candado de inserción si hay CHECK/índice parcial crudo.

## Gates (antes de cerrar)
`tsc --noEmit` + `npm run lint` + `npm run arch:check` + `npm run test:unit` COMPLETO (specs-discipline exige la línea «Impacto en arquitectura:», que ya está) + migración aditiva verificada.

## Orden / dependencias
- Sin dependencia de despliegue con otras SPECs de la cola (a diferencia de 754↔752). Independiente.
- FR-007 y FR-008 BLOQUEAN la implementación de su parte hasta respuesta de abogado; el resto (datos + puerta + per-menor) puede avanzar con el texto como placeholder marcado.

## Riesgos
- Debilitar la puerta de cuenta al extender el predicado → mitigado por C-no-romper-cuenta (regresión de SPEC-241).
- Fijar en código una política legal (re-oír por versión) → mitigado por parámetro (FR-008).
- Inventar el texto de la declaración → prohibido; placeholder [ABOGADO].
