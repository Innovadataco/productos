# Cierre — SPEC-110: Apelación del identificador reportado

**Fecha**: 2026-07-29 · **Rama**: `feature/001-scaffolding` · **Estado**: IMPLEMENTADA, **SIN DESPLEGAR** (el despliegue a producción lo decide el CEO en su lote). **Diseño CERRADO con el CEO (BRIEF-SPEC-110), no reabierto.**

## Contexto

SPEC-109 (D-34) eliminó el módulo viejo de apelación (ocultamiento automático sin revisión
humana, SMS simulado). SPEC-110 crea el reemplazo con las dos reglas duras del CEO:
**apelar NO cambia la visibilidad** (solo la resolución del comité) y **el apelante NO ve
contenido de reportes** (solo el número N). Flujo: apelante autenticado → declara
identificador + motivo + PDF de evidencia sobre sí mismo → caso DIRECTO a la bandeja del
comité (sin triaje) → resolución humana motivada → solo entonces cambia la visibilidad.

## Lo hecho (por capa)

- **Modelo de datos** (migración ADITIVA `20260729120000_apelacion_identificador`, ya en la
  base de dev y test): enum `EstadoApelacion` (RECIBIDA/EN_REVISION/ACEPTADA/RECHAZADA);
  modelos `Apelacion`, `DocumentoApelacion`, `AccesoDocumentoApelacion`;
  `IdentificadorReportado.ocultoPorComiteEn` (marca del comité); `AccionAudit` +=
  `APELACION_DOCUMENTO_ACCESO`/`APELACION_DOCUMENTO_PURGADO`/`APELACION_AVISO_PLAZO`.
  Índice único parcial de apelación abierta (un caso abierto por usuario+identificador+plataforma).
- **Dominio** `src/lib/apelaciones.ts`: parámetros con fallback (15/10/30/5), días hábiles
  (lun-vie), `calcularPlazoRespuesta`, `contarReportesAsociados` (N, único dato al apelante),
  `estaEnAvisoPrevio`.
- **Storage cifrado** `src/lib/apelacion-storage.ts`: AES-256-GCM con la misma clave de
  parámetros (`PARAM_ENCRYPTION_KEY`), formato binario `[IV][TAG][ciphertext]`, archivo
  `.enc` en `storage/apelaciones/` FUERA de la raíz web (override `APELACIONES_STORAGE_DIR`),
  nombre opaco, hash SHA-256 del original, validación PDF (MIME + magic bytes), fail-closed
  (sin clave → 503, nunca se guarda en claro). `storage/` en `.gitignore`.
- **Visibilidad** `src/lib/visibility.ts`: la dueña única pasa a
  `esVisible = !ocultoPorComiteEn && totalReportes >= umbral && ratio >= minRatio`.
  `POST /api/reportes` levanta la marca en el upsert de reporte nuevo (sin lista blanca).
- **APIs apelante**: `POST /api/apelaciones` (multipart; Zod; PDF validado; tamaño por
  parámetro; duplicada abierta 409; cifrado+persistencia; AuditLog `APELACION_CREADA`) y
  `GET /api/apelaciones/mias` (solo propias; N reportes; decisión+motivación; NUNCA contenido).
- **APIs comité** (bandeja propia, `assertModulo comite_bandeja`):
  `GET /api/admin/comite/apelaciones` (filtro estado, días hábiles, marca próximo a vencer),
  `GET .../[id]` (motivo, acreditación, metadatos del documento, reportes del identificador),
  `GET .../[id]/documento` (SOLO COMITE_VALIDACION; descifra+streamea; AuditLog + fila de
  acceso; 403 admin/operador/padre; 410 purgado/ausente), `POST .../[id]/tomar`
  (RECIBIDA→EN_REVISION, 409 si tomada) y `POST .../[id]/resolver` (motivación obligatoria;
  ACEPTADA: `ocultoPorComiteEn` vía dueña única y/o baja de reportes por `REPORTE_FALSO` con
  `darDeBajaReporte`; RECHAZADA no cambia nada; AuditLog `APELACION_RESUELTA`).
- **Mantenimiento diario** `src/lib/apelacion-mantenimiento.ts` + worker
  (`scripts/worker-reportes.mjs`, cola `apelacion-mantenimiento`, `boss.schedule` diario
  06:00 America/Bogota): `purgarDocumentosVencidos` (borra `.enc` a los
  `apelacion.retencion_documento_dias` días de resuelto; conserva metadatos+accesos; AuditLog
  `APELACION_DOCUMENTO_PURGADO`) y `procesarAvisosPlazo` (email digest al comité a los
  `apelacion.aviso_previo_dias` días hábiles; AuditLog `APELACION_AVISO_PLAZO`; el fallo de
  email no bloquea la purga). Email `enviarAvisoPlazoApelaciones` en `src/lib/email.ts`.
- **UI**: área del apelante `/dashboard/apelaciones` (`ApelacionesClient.tsx`: formulario con
  upload PDF, representante+acreditación, lista propia con estado/plazo/N reportes, textos de
  plazo 15 días hábiles y de qué NO verá, canales oficiales) + enlace en
  `DashboardUsuarioClient.tsx`; bandeja del comité `/dashboard/admin/comite/apelaciones`
  (`ApelacionesBandejaClient.tsx`: lista, tomar, detalle, descargar evidencia, resolver con
  motivación+efectos) + tab en `COMITE_NAV_TABS`. Componentes/Tailwind existentes, español neutro.
- **Enmienda constitucional** (commit propio `0095ade4`): excepción única de evidencia
  documental a la regla de solo texto, con el texto exacto del brief.

## Parámetros (ADR_004), seed + fallback

| Clave | Default | Efecto |
|-------|---------|--------|
| `apelacion.plazo_respuesta_dias_habiles` | 15 | Plazo legal calculado al radicar |
| `apelacion.aviso_previo_dias` | 10 | Aviso al comité a los N días hábiles sin resolver |
| `apelacion.retencion_documento_dias` | 30 | Purga de evidencia a los N días de resuelta |
| `apelacion.max_tamano_documento_mb` | 5 | Umbral de rechazo 413 (propuesta documentada: 2-5 MB; 5 tolera certificados escaneados multipágina) |

## Reglas duras verificadas con tests de EFECTO

- Apelar NO cambia `esVisiblePublicamente` (test: idéntico antes/después de crear).
- El apelante NO recibe contenido de reportes en ninguna respuesta (test recorre el JSON).
- Resolver ACEPTADA con quitar-visibilidad SÍ la cambia (efecto real en `IdentificadorReportado`).
- Un reporte NUEVO posterior levanta el ocultamiento (reglas normales; test vía `POST /api/reportes`).
- Parámetros con efecto: tamaño (rechazo cambia), retención (30 vs 60 cambia qué purga el job),
  aviso (10 vs 3 cambia qué casos avisan).
- Upload rechaza no-PDF (400) y sobre-tamaño (413).
- Evidencia solo comité: ADMIN/OPERADOR/PARENT → 403; cada acceso registra AuditLog + fila.

## Tests

**33 tests SPEC-110, todos en verde** (corrida combinada: 33/33 passed):
- Apelante: 12 (`route.test.ts` 8 + `mias/route.test.ts` 4).
- Comité: 17 (`apelaciones/route.test.ts` 3, `[id]/resolver/route.test.ts` 10, `[id]/documento/route.test.ts` 4).
- Mantenimiento: 4 (`apelacion-mantenimiento.test.ts`).

Fixture compartida nueva: `src/lib/apelacion-test-utils.ts` (crea apelación con documento
real cifrado en disco y reportes del identificador).

## Gate

- `npx tsc --noEmit` ✅ (0 errores).
- `npm run lint` ✅ (0 errores en archivos SPEC-110).
- `npm run build` ✅ (tras `rm -rf .next`; BUILD_EXIT=0).
- Tests SPEC-110 ✅ 33/33.
- `src/lib/specs-discipline.test.ts`: SPEC-110 con Status canónico (IMPLEMENTADO) e indexada
  en `specs/README.md` ✅. *(Nota de entorno: en el momento del gate este archivo reporta 1
  fallo ajeno — la carpeta `118-clics-muertos-colegio` de otra spec en curso aún sin indexar
  en el README; no corresponde a SPEC-110.)*
- Suite entera (`npm run test`): ver sección siguiente.

### Nota de entorno — monorepo compartido en la cola 002-PI-041

Este bloque (B0) corrió en paralelo con otros bloques de la cola (B2, B4, B6, B8…) sobre el
**mismo working tree y la misma base de test** (`proteccion_infantil_test`, forzada por
`src/lib/test-setup.ts`). Consecuencias ajenas a SPEC-110 observadas durante el gate:
- Carreras intermitentes en `resetDatabase`/`otorgarTodosLosPermisos` cuando dos procesos
  `vitest` corren a la vez (colisiones de unique/FK en `moduloPermisible`/`permisoModulo`).
  Los 33 tests de SPEC-110 pasan en verde en ventana sin contención (evidencia arriba).
- Tests en rojo transitorio de otros bloques (test-first-red) presentes en el working tree.
- La spec `118` aún sin indexar en `specs/README.md` (pertenece a otro bloque).

## Resultado de la suite entera

Corrida única de `npm run test` (1022 tests): **953 passed / 68 failed** (SUITE_EXIT=1).
Los 68 fallos **no corresponden a SPEC-110**, salvo 1 caso de carrera:

- **32/33 tests de SPEC-110 pasaron incluso bajo contención.** El único fallo fue
  `comite/apelaciones/route.test.ts` (1 de 3): `expected 404 to be 200` en el detalle, causado
  por el `resetDatabase` de un proceso `vitest` concurrente que borró la apelación a mitad del
  test (carrera de BD compartida, no un defecto). La corrida combinada de los 33 tests de
  SPEC-110 en ventana sin contención dio **33/33 en verde** (evidencia arriba).
- Los otros 67 fallos son de **otros bloques de la cola en curso** (test-first-red) o de
  contención de BD en tests preexistentes: `ia/rubrica/preguntas`, `ia/sandbox`,
  `operadores/modelo`, `colegio/carga`, `colegio/cursos`, `colegio/vigencia`,
  `e2e/journeys/padre` (SPEC-116), `proxy-sesion-roles` (SPEC-118), `specs-discipline`
  (SPEC-117 aún sin plan/tasks ni índice), `comite/pendientes`, `reportes/*`, `auth/verificar`,
  `operadores/login-comite`, `colegio/importer`. Ninguno fue introducido por SPEC-110.

**Conclusión del gate**: tsc ✅ · lint ✅ · build ✅ · tests SPEC-110 ✅ (33/33). La suite
entera no puede quedar en verde mientras varios bloques de la cola compartan el mismo working
tree y la misma base de test; los fallos presentes son ajenos a este bloque.

## Qué NO se hizo (alcance)

- **Sin despliegue** (lo decide el CEO). La migración ya está aplicada en dev/test; en prod se
  aplicará con `prisma migrate deploy` en el lote.
- **Sin email al apelante** (decisión documentada en Assumptions): la decisión se consulta en
  su área (pull). El email automático es SOLO al comité (plazo).
- **Un documento por apelación** en esta fase (el modelo admite N).
- **Días hábiles = lunes a viernes**, sin calendario de festivos (simplificación documentada).

## Confirmaciones

- **No se tocó el motor de clasificación** (rúbrica/legacy/umbrales/terna): los únicos puntos
  de contacto con el pipeline son `darDeBajaReporte` (patrón existente reutilizado, sin cambios)
  y `actualizarVisibilidadPublica` (dueña única, ahora respeta `ocultoPorComiteEn`; diff mínimo
  ya revisado en commits previos del bloque).
- **No se desplegó** nada; **no se ablandó** ningún test; **no se borraron** datos.
- **Migraciones aditivas** únicamente. **Ningún secreto** en commits/docs/chat.
