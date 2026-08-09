# Cierre: SPEC-143 — Home operativo del rector

**Fecha**: 2026-08-03 · **Radicado**: 002-PI-058 (MODO DESARROLLO) · **Spec**: [spec.md](./spec.md)

## Evidencia

- Compuerta §4: spec+plan `262721f7` → ZEUS REVISO → **CUMPLE** (D1 ámbar 72 h +
  condición de copy · D2 `COUNT(DISTINCT reporteId)` · D3 dos hechos + franja solo
  verdades).
- Implementación en `work/002-pi-058` (lote, sin PR por spec): `ade55116` datos ·
  `28964d4c` componentes + página · `314ac381` deps + stack + spec.
- Checks de día (todos exit 0): `tsc` · `lint` · `tokens:check` (1166 = piso, el
  código nuevo es 100% tokens) · `arch:check` VERDE (`06-stack.md` regenerado con
  recharts 3.10.1 + lucide-react 1.28.0) · tests del área: 140/140 (repo, lib, home,
  api/health) + 208/208 (ui + dal).
- Suite completa + E2E + build + Lighthouse: **pendiente del lote nocturno** (MODO
  DESARROLLO §3) — T011/T012 quedan abiertos en `tasks.md` hasta esa validación.

## Qué se entregó (FR → evidencia)

- FR-001/002: `/dashboard/colegio` reemplazada — server component, UNA llamada a
  `ColegioResumenRepository.homeRector`, auth solo en el layout. **C2/C3 de
  SPEC-129 SUPERADA** (home = consulta pública + stats públicas → home propia del
  colegio). ConsultaPublica/PublicDashboard siguen en `/`.
- FR-003/004: KPIs solo activos (variantes `contarActivos` aditivas — semántica
  existente intacta); semáforo D1 con copy ámbar "ya lo atendiste" (función pura
  `resolverEstado` + test).
- FR-005: anillos con cobertura exacta (test A/B: 70%/50%, huecos en personas, 0
  estudiantes sin NaN; acudiente solo vía estudiante acotado).
- FR-006: tendencia Recharts con toggle 12sem/12m/3a sin refetch (client component,
  series desde el repo con DISTINCT reporteId).
- FR-007/008: cursos que merecen mirada (top 3 por 30d + titular) · franja con los
  DOS hechos D3 (última señal del colegio + heartbeat del worker vía
  `worker-heartbeat.ts`, refactor de la ruta health con comportamiento idéntico).
- FR-009/011: empty state §5.2, acciones rápidas a rutas existentes (Profesores →
  cursos hasta SPEC-148), CanalesOficiales, terminología §3 (grep = 0 prohibidas en
  textos UI), tap targets ≥ 48px.
- FR-013: solo conteos agregados (I-29).

## Hallazgos (ambientales, no de la SPEC)

1. **Cliente Prisma stale en `node_modules`** (jul 22) causaba FK fantasma
   `Usuario_colegioId_fkey` en tests de integración → resuelto con
   `prisma generate` + limpiar caché `.vite`.
2. **Contención en la BD de test compartida**: otro proceso vitest corre contra
   `proteccion_infantil_test` (existe un worktree `/private/tmp/spec143-base`) y sus
   `resetDatabase` provocaban fallos FK intermitentes. Los tests del área se
   verificaron contra `proteccion_infantil_test3` (BD nueva en el mismo contenedor,
   64 migraciones aplicadas). Colateral: `proteccion_infantil_test2` tiene una
   migración fallida registrada (de ese otro proceso) — no se tocó.
3. Los fallos iniciales en tests preexistentes (`alertas.test.ts`,
   `importer.test.ts`) eran 100% ambientales (1+2): verdes tras el fix, sin tocar
   ningún test.

## Deuda técnica

- Validación nocturna pendiente (suite completa, build, Lighthouse ≥90) — T011/T012.
- Acción "Profesores" apunta a cursos hasta que SPEC-148 cree su ruta.
- `CanalesOficiales` conserva colores crudos internos (tokenización por desgaste;
  ya están en el piso 1166).
