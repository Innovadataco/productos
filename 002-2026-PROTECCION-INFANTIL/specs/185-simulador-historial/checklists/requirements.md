# Requirements Checklist: SPEC-185 — Historial y sugerencias del simulador de abusos

**Purpose**: Verificar que todos los requerimientos funcionales y candados de SPEC-185 se cumplen antes del cierre.
**Feature**: [spec.md](../spec.md)

## Backend

- [ ] CHK001 `GET /api/admin/anti-abuso/simular` devuelve listado paginado (25/pag) ordenado por `creadoEn desc`
- [ ] CHK002 Listado soporta filtros `estado` y `escenario`
- [ ] CHK003 DTO del listado incluye conteos agregados desde `resultadosJson`
- [ ] CHK004 `SimulacionAbusoRepository.listar` implementa frontera DAL
- [ ] CHK005 `GET /api/admin/anti-abuso/simular/sugerencias?escenario=` devuelve configuración fresca
- [ ] CHK006 Sugerencia de "Robot inundando" usa IP de `192.0.2.0/24` no usada en 2h, identificador aleatorio, N=50, plataforma=whatsapp
- [ ] CHK007 Sugerencia de "Ataque coordinado" usa rango de 30 IPs de `192.0.2.0/24`, mismo identificador, N=30
- [ ] CHK008 Sugerencia de "Bot IPs rotativas" usa `198.51.100.0/24`, identificadores distintos, N=20, plataforma=telegram
- [ ] CHK009 Sugerencia de "Denunciante spam" devuelve N=15, plataforma=instagram y usuarioId configurable o null
- [ ] CHK010 Sugerencia de "Personalizado" devuelve campos vacíos/null
- [ ] CHK011 Endpoint de detalle incluye descripción en criollo, configuración, resultados y detalles por reporte
- [ ] CHK012 Worker guarda detalles por reporte y percentiles p50/p95 en `resultadosJson`

## Frontend

- [ ] CHK013 Tab "Simulador" tiene sub-tabs "Nueva corrida" e "Historial"
- [ ] CHK014 Cambiar escenario en "Nueva corrida" llama sugerencias y rellena el form
- [ ] CHK015 Se muestra hint de sugerencia y botón "Refrescar sugerencia"
- [ ] CHK016 "Personalizado" no dispara autofill
- [ ] CHK017 "Historial" muestra tabla paginada con filtros estado/escenario
- [ ] CHK018 Clic en fila abre detalle (modal o página según decisión ZEUS)
- [ ] CHK019 Detalle muestra descripción del escenario en criollo
- [ ] CHK020 Detalle muestra configuración usada y resultados agregados
- [ ] CHK021 Detalle muestra tabla colapsable por reporte con status, latencia y motivo 429
- [ ] CHK022 Botón "Repetir con nueva sugerencia" funciona para escenarios predefinidos
- [ ] CHK023 Botón "Cancelar" visible solo para corridas `PENDIENTE`/`EN_PROGRESO`

## Bugfix I-64

- [ ] CHK024 Worker no intenta escribir `fechaFin`
- [ ] CHK025 Corrida que termina todos sus reportes queda `COMPLETADA`
- [ ] CHK026 Backfill `scripts/reparar-simulaciones-fechafin.mjs` es idempotente
- [ ] CHK027 Backfill solo afecta `estado=FALLIDA AND progreso=totalReportes AND creadoEn > '2026-08-20T15:00:00Z'`

## Candados

- [ ] CHK028 No se toca `src/lib/ai/**`
- [ ] CHK029 No se modifica lógica de rate-limit real
- [ ] CHK030 IPs inyectables siguen restringidas a rangos RFC 5737
- [ ] CHK031 No se añade migración de base de datos (salvo decisión contraria de ZEUS)
- [ ] CHK032 Todo acceso a `SimulacionAbusoRun` pasa por su repositorio DAL
- [ ] CHK033 No se expone PII en historial/detalle
- [ ] CHK034 Se usan tokens de diseño y componentes existentes

## Gate

- [ ] CHK035 `npx tsc --noEmit` pasa
- [ ] CHK036 `npm run lint -- --no-cache` pasa
- [ ] CHK037 `npm run test:unit` pasa
- [ ] CHK038 `npm run test:integration` pasa
- [ ] CHK039 `npm run build` pasa
- [ ] CHK040 `./scripts/dev-restart.sh` levanta app + worker + simulador
