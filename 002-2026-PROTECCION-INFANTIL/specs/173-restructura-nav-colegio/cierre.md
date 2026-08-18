# Cierre: SPEC-173 — Módulo Colegio: restructura nav por rol + fixes H01-H06

**Fecha**: 2026-08-17/18 · **Rama**: `work/002-pi-071` (integrada en `work/002-pi-nocturno-20260817`) · **Compuerta §4**: APROBADA por ZEUS con candados A/B.

## Qué se implementó

### Bloque A — Navegación por rol

- **Rector (SCHOOL_ADMIN)**: `COLEGIO_NAV_ITEMS` quedó en los 8 items exactos del CEO (Inicio · Estadísticas · Alertas · Cursos · Casos comité · Usuarios[Profesores, Comité de convivencia] · Configuración · Auditoría). Retirados Onboarding/Materias/Subir lista del menú (rutas siguen accesibles por URL). Nodo "Usuarios" expandible nuevo en `ColegioSideNav` (useState + ARIA, auto-expandido por ruta activa) — patrón inexistente en el codebase (el de SPEC-129 fue reemplazado).
- **Comité (COMITE_CONVIVENCIA)**: menú propio de 3 items (`COMITE_COLEGIO_NAV_ITEMS`, todos con módulo `colegios_comite_bandeja` — cero claves nuevas, cero seed). Home nueva `/dashboard/colegio/comite` (casos abiertos, mis asignados, próximos SLA) y `/dashboard/colegio/comite/estadisticas` (casos por estado, tiempo medio de resolución, top categorías) — solo agregados, sin texto de reporte ni denunciante.
- **Admin del comité movida**: de `/comite` a `/comite/integrantes` (rector). `/comite` redirige al rector a integrantes; el comité aterriza en su home.
- **Proxy**: `homeForRole` comité → `/dashboard/colegio/comite`; `/comite/integrantes` (página y API) excluido del predicado del comité (candado B).

### Bloque B — Fixes H01-H06

- **H01**: la raíz del 500 batch estaba en `aplicarAccionEnLote` (`src/lib/colegio/alertas.ts`): auditaba con la acción dinámica `COLEGIO_ALERTA_LOTE_${accion}`, inexistente en el enum `AccionAudit` → Prisma rechazaba y el endpoint 500 para TODA acción batch. Se audita con `COLEGIO_ALERTA_ESTADO` (canónica) y el detalle queda en `valorNuevo`. Además: `alertaBatchSchema.accion` → solo `"vista"`; UI individual escala con `EscalarAlertaModal` (motivo obligatorio, POST con `{"motivo"}` — el botón viejo hacía POST sin body contra `escalarAlertaSchema`, 400 siempre).
- **H02** (candado A): `materiaIdSchema = z.union([cuidIdSchema, z.string().uuid()])` — la migración `20260812052407` sembró Materia con `gen_random_uuid()` y la app crea con `@default(cuid())`; uuid-only habría roto las materias nuevas. **Corrección de auditoría ZEUS (candado B)**: `materiaIdParamsSchema.id` también pasa a `materiaIdSchema` — los endpoints `/materias/[id]` y `/materias/[id]/estado` daban 400 sobre las materias sembradas (UUID). `materiaIdSchema` quedó definido junto a `cuidIdSchema` (orden de declaración).
- **H03**: `ProfesorDetallePageClient` — el fetch a `/api/plataformas` existía pero con `catch(() => {})` silencioso; ahora valida `res.ok`, muestra error con Reintentar y deshabilita Guardar hasta tener plataformas.
- **H04**: `alertasPorTipoSujeto { ESTUDIANTE, PROFESOR, ACUDIENTE }` en el DTO de inteligencia (nuevo `AlertaColegioRepository.contarPorTipoSujeto` con groupBy) + sección visible en Estadísticas.
- **H05**: onboarding `completado` → el payload incluye `resumen {estudiantes, cursos, profesores}` y la página muestra tarjeta amable + CTA a Inicio (era `<OnboardingModal forceOpen>` sin caso especial).
- **H06**: tarjeta de alerta con exactamente 3 acciones (Revisar · Resolver aquí · Escalar al Comité), batch solo "Revisar en lote", chips con tooltip en criollo, retirados Asignar/Reasignar/Desasignar/Cerrar del rector. `ResolverAlertaModal` escribe la nota en la bitácora (`/notas`) y luego marca `gestionada`.

## Evidencia

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ (0 errores) · `npm run arch:check` ✅ (260 rutas × 6 roles; 94 hrefs)
- `npm run test:unit` ✅ 118 archivos / 811 tests (incluye `ColegioSideNav.test.tsx` y `AlertasColegioPageClient.test.tsx` nuevos)
- Integration targeted ✅ 5 archivos / 46 tests (materias UUID+CUID, batch vista + 400 acciones retiradas, comité estadísticas con aislamiento y sin PII, estadísticas con `alertasPorTipoSujeto`, onboarding resumen)
- `npm run test:journeys` ✅ 47/47 · `npm run build` ✅ · arranque `next start` ✅ (home 200, colegio/comite 307 sin 500s)
- Suite integration completa: ver log de la corrida final (anexa al commit).

## Archivos tocados

- Modificados: 27 (schemas, nav-items, proxy, ColegioSideNav, AlertasColegioPageClient, alertas.ts, inteligencia.ts, alerta-colegio.ts, estadisticas page client, onboarding route/page/lib, profesor detalle, tests, docs/architecture regenerada, specs/README.md).
- Nuevos: 9 (integrantes/page, comite/estadisticas page+api+test, ComiteHome, ComiteEstadisticas, EscalarAlertaModal, ResolverAlertaModal, 2 tests de componente).

## Deuda técnica

- `aplicarAccionEnLote` conserva ramas internas para acciones fuera de la superficie batch del rector (inalcanzables vía API; se dejan por si el comité las necesita después — decidir en su momento si se podan).
- El test de `AlertasColegioPageClient` es de superficie de botones; los flujos de modal quedan cubiertos por tests de API + smoke manual del quickstart.
- Email de recuperación de incidentes y smoke Ollama con modelo tiny: decisiones de SPEC-171 pendientes de compuerta (no de esta spec).

## Smoke manual pendiente (quickstart.md)

Las 11 verificaciones del `quickstart.md` quedan para el CEO tras deploy (nav por rol, H01-H06 uno a uno).
