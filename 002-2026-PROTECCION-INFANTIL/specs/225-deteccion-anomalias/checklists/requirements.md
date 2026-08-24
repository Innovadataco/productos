# Checklist de requisitos: SPEC-225

## User Stories

- [ ] US-1: Detección por reglas deterministas.
  - [ ] Mora anómala cliente puntual (MEDIA ≥15d / ALTA ≥30d).
  - [ ] Crecimiento anómalo por ciudad (BAJA).
  - [ ] Uso caído abrupto por colegio (MEDIA).
  - [ ] Cancelación de colegio grande (ALTA).
  - [ ] Caída de recaudo semanal por ciudad >30% (ALTA).
  - [ ] >5 cancelaciones en 24h (ALTA, una sola anomalía global).
  - [ ] Deduplicación por anomalía abierta (tipo+sujeto).
  - [ ] `datosContexto` solo agregados, sin PII ni texto de reportes.
- [ ] US-2: Alertas inmediatas al CEO.
  - [ ] Evento `analisis.anomalia.detectada` solo en severidad ALTA.
  - [ ] Destinatarios = usuarios ADMIN activos, canales EMAIL + IN_APP.
  - [ ] Kill-switch `analisis.anomalias.email_inmediato_habilitado`.
  - [ ] Fail-open: error de Motor Notif no impide persistir la anomalía.
  - [ ] Seed idempotente de regla + plantillas en español neutro.
- [ ] US-3: API admin.
  - [ ] `GET /api/admin/analisis/anomalias` con filtros y paginación estándar.
  - [ ] `GET /api/admin/analisis/anomalias/[id]` con `datosContexto`.
  - [ ] `PATCH /api/admin/analisis/anomalias/[id]` resuelve + `AuditLog`; `409` si ya resuelta.
  - [ ] `401`/`403` para no-ADMIN.

## Functional Requirements

- [ ] FR-001/002: modelo `Anomalia` + enums, migración aditiva, índices.
- [ ] FR-003/004: worker `worker-anomalias.mjs`, advisory lock propio, tick parametrizable, umbrales releídos en cada tick, TZ Bogotá.
- [ ] FR-005/006: umbrales de mora y base mínima de comparación respetados.
- [ ] FR-007/008: deduplicación y `datosContexto` sin PII.
- [ ] FR-009/010: publicación Motor Notif solo ALTA + fail-open.
- [ ] FR-011: seed de parámetros + regla + plantillas idempotente.
- [ ] FR-012/013/014: endpoints admin con Zod, paginación y `AuditLog`.
- [ ] FR-015: `dev-restart.sh` + servicio `pi-anomalias` en `docker-compose.prod.yml`.
- [ ] FR-016: tests de reglas, deduplicación, alertas, endpoints y frontera Bogotá.

## Success Criteria

- [ ] SC-001: un tick crea exactamente las 6 anomalías del dataset de prueba.
- [ ] SC-002: segundo tick crea 0 duplicados.
- [ ] SC-003: ALTA → 1 notificación por canal por admin; MEDIA/BAJA → 0 emails.
- [ ] SC-004: kill-switch desactiva el email sin impedir la persistencia.
- [ ] SC-005: base mínima y división por cero cubiertas.
- [ ] SC-006: endpoints y gate local verdes.
- [ ] SC-007: instancia única del worker (segundo arranque → exit 2).

## Candados y restricciones

- [ ] NO se tocó `src/lib/ai/**` ni el rate-limit del reporte público.
- [ ] NO se modificó el motor de notificaciones (solo catálogo aditivo).
- [ ] Migraciones 100% aditivas (cero DROP).
- [ ] Timestamptz(6) en timestamps nuevos.
- [ ] Sin IA en la detección: 100% reglas SQL/Prisma.
- [ ] Sin PII en `datosContexto`, logs ni `AuditLog` (Ley 1581).
- [ ] Lenguaje descriptivo/estadístico; las anomalías no emiten veredictos sobre personas.
- [ ] Textos de UI/email en español neutro, sin voseo.
- [ ] NO se implementó panel (SPEC-222), digest (SPEC-223) ni ejecución de acciones (SPEC-226).
- [ ] Un commit atómico por SPEC dentro de la rama del mega-lote.

## Dependencias externas

- [ ] SPEC-221 disponible en la rama del mega-lote (convenciones `analisis.*`).
- [ ] Verificar que SPEC-220 no creó ya el modelo `Anomalia` (si lo hizo, omitir migración).
- [ ] Verificar que el advisory lock id elegido no colisiona con workers de SPEC-236/221.
