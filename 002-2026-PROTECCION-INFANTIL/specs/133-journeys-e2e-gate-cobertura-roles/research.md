# Research: SPEC-133 — gap analysis rol × capacidades (2026-08-01)

Cruce de `docs/architecture/02-roles-capacidades.md` + `src/lib/proxy.ts` con los 8
journeys de `src/lib/e2e/journeys/`. Fuente del diseño de la spec.

## Hecho estructural clave

El proxy es GRUESO: blinda `/dashboard/admin`+`/api/admin` (roles internos), el área de
padres y el módulo colegio. Consecuencias verificadas:

- OPERADOR y COMITE_VALIDACION pasan el proxy a todo `/api/admin/**` — el 403 fino vive
  en los handlers.
- PARENT pasa el proxy a `/api/colegio/**` — igual.
- Los negativos actuales (`aislamiento.test.ts`, 18 casos) son a nivel proxy; los 403 de
  handler casi no tienen tests. De ahí US3.

## Lo que ya cubre cada journey (resumen)

- **admin**: lecturas del panel (bandeja, estadísticas, operadores, colegios, dataset,
  spam, audit-logs), `ia/modelos` degradado, alta real de OPERADOR (§9).
- **colegio**: alta real de colegio por admin, primer ingreso + cambio obligatorio (I-35),
  cursos/alumnos básicos, estadísticas.
- **padre**: registro completo, reportar (auth y anónimo), mis-reportes, círculo
  (alta+lista), seguimiento, cambio de contraseña, D-11.
- **operador-comite**: bandeja, confirmar (§9: CLASIFICADO + transiciones + corrección),
  escalar; comité: pendientes/asignar/resolver (§9: CORREGIDO).
- **publico-agregacion**: consulta idéntica para anónimo y 4 roles, sin score/riesgo,
  SPAM/OTRO no suman (D-08), umbrales gobiernan visibilidad.
- **aislamiento**: 18 bloqueos a nivel proxy + menú ≡ proxy + D-37.
- **sesion-roles**: los 5 roles login → home → menú propio → logout; homes cruzados.
- **cola-041**: detalle mis-reportes del padre (SPEC-116), ciudades, gestión de padres
  (vigencia/restablecer), D-37.

## Gaps que cierra esta spec (selección de la spec, no la lista completa)

Críticos (→ US2/US3):

- **PARENT**: apelaciones (`POST /api/apelaciones`, `GET /mias`) — obligación Ley 1581;
  alertas (`/api/alertas*`); recuperar contraseña (nadie lo cubre).
- **SCHOOL_ADMIN**: carga masiva (plantilla/validar/confirmar — cero cobertura);
  alertas del colegio (cero); auditoría. **Multi-tenant A/B**: no existe ningún test de
  que un colegio no vea al otro — el negativo central del SaaS.
- **OPERADOR**: anonimización (`REQUIERE_ANONIMIZACION` → anonimizar → validar).
- **COMITE**: apelaciones (`/api/admin/comite/apelaciones*` — cero cobertura).
- **ADMIN**: `GET/PATCH /api/config/parametros` (¡los umbrales de visibilidad viven
  aquí!), `spam/[id]/resolver`, `correcciones` (alimenta el RAG).
- **Negativos handler-level**: OPERADOR/COMITE → admin-only (403); PARENT →
  `/api/colegio/**` (403); asignación estricta (operador/comité no asignado);
  cross-parent (`mis-reportes/[id]` ajeno).

Queda FUERA (backlog, no crítico para el gate): Centro IA en profundidad (rúbrica,
sandbox, evals, experimentos, simulaciones), CRUD fino de operadores/colegios/padres,
`consulta/detalle`, `reportes/fallback`, pipeline asíncrono del worker punta a punta
(tiene sus propias evals y tests de procesar).

## Decisión: estados del motor se siembran

CI no tiene Ollama. Para llegar a `REQUIERE_ANONIMIZACION` o a una apelación sobre un
identificador público se siembra el estado directamente en BD (transición controlada).
Lo que se prueba es el flujo humano de revisión, no la clasificación (cubierta por las
evals del clasificador y `procesar/*.test.ts`).
