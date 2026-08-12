# Tasks: SPEC-168 — Comité de Convivencia por colegio

**Orden**: por dependencias. TDD donde aplica.

## T001 — Schema y migración aditiva
- [ ] Añadir `COMITE_CONVIVENCIA` al enum `RolUsuario` en `prisma/schema.prisma`.
- [ ] Añadir `cargo` a `IntegranteComite` en `prisma/schema.prisma`.
- [ ] Añadir `colegioId`, `alertaColegioId` y `creadoPorId` a `SolicitudComite` con sus índices y unique de `alertaColegioId`.
- [ ] Añadir `comiteColegioId` a `Usuario` con `@unique` y relación inversa en `Colegio`.
- [ ] Añadir acciones `COLEGIO_COMITE_*` y `COLEGIO_CASO_*` al enum `AccionAudit`.
- [ ] Generar migración aditiva; asegurar que `Curso` y `Estudiante` NO se modifican.
- [ ] Ejecutar `npx prisma migrate dev` y `npx prisma generate`.

## T002 — Catálogo de permisos y grants
- [ ] Añadir módulos `colegios_comite` y `colegios_comite_bandeja` a `src/lib/permisos-catalogo.ts`.
- [ ] Actualizar `prisma/seed-modulos-grants.ts` con grants por defecto:
  - `SCHOOL_ADMIN`: `colegios_comite` (+ padre `colegios`).
  - `COMITE_CONVIVENCIA`: `colegios_comite_bandeja`.
- [ ] Ejecutar `npx prisma db seed` o `scripts/sync-modulos-grants.ts` y verificar que los grants se crean.

## T003 — Proxy, layout y navegación por rol
- [ ] Actualizar `src/lib/proxy.ts`: reconocer `COMITE_CONVIVENCIA`, redirigir home a `/dashboard/colegio/comite/casos`, permitir rutas `/dashboard/colegio/comite/**`, `/api/colegio/comite/**` y rutas de sesión.
- [ ] Actualizar `src/app/dashboard/colegio/layout.tsx` para aceptar `SCHOOL_ADMIN` o `COMITE_CONVIVENCIA` y mantener el control de vigencia del colegio.
- [ ] Actualizar `src/lib/nav-items.ts`: añadir `COLEGIO_COMITE_NAV_ITEMS` para el rol comité.
- [ ] Actualizar `src/components/modules/colegio/ColegioSideNav.tsx` para filtrar ítems según el rol y los módulos permitidos.

## T004 — Repositorio y servicio de cuenta del comité
- [ ] Crear `src/lib/dal/repositories/comite-convivencia.ts` (crear cuenta, obtener por colegio, regenerar password).
- [ ] Crear `src/lib/dal/services/comite-convivencia.ts` (lógica de negocio + generación de password temporal).
- [ ] Aislamiento por `colegioId` en todas las operaciones.
- [ ] Test `src/lib/dal/repositories/comite-convivencia.test.ts`: crear, duplicado, regenerar, A/B.

## T005 — Endpoints de gestión de la cuenta
- [ ] `GET /api/colegio/comite/cuenta`.
- [ ] `POST /api/colegio/comite/cuenta`.
- [ ] `POST /api/colegio/comite/cuenta/regenerar-password`.
- [ ] Tests de API con A/B, duplicados y regeneración.

## T006 — Repositorio y servicio de integrantes del comité
- [ ] Crear `src/lib/dal/repositories/comite-convivencia-integrantes.ts`.
- [ ] Crear `src/lib/dal/services/comite-convivencia-integrantes.ts` con cifrado/descifrado de `numeroIdentificacion` vía `param-encryption`.
- [ ] Validar que `comiteId` sea `COMITE_CONVIVENCIA` del mismo colegio.
- [ ] Test `src/lib/dal/repositories/comite-convivencia-integrantes.test.ts`: CRUD + A/B + cifrado + duplicados.

## T007 — Endpoints de integrantes del comité
- [ ] `GET /api/colegio/comite/integrantes`.
- [ ] `POST /api/colegio/comite/integrantes`.
- [ ] `PATCH /api/colegio/comite/integrantes/[id]`.
- [ ] `PATCH /api/colegio/comite/integrantes/[id]/estado`.
- [ ] Tests de API con A/B, validaciones y cifrado.

## T008 — Repositorio y servicio de solicitudes del comité
- [ ] Crear `src/lib/dal/repositories/comite-convivencia-solicitudes.ts` (bandeja colegio-scoped, detalle, crear, resolver).
- [ ] Crear `src/lib/dal/services/comite-convivencia-bandeja.ts` (escalar, detalle, resolver, agregar nota).
- [ ] Validar siempre `colegioId` del comité autenticado.
- [ ] Test `src/lib/dal/repositories/comite-convivencia-solicitudes.test.ts`: CRUD + A/B.

## T009 — Endpoint de escalamiento desde alertas
- [ ] `POST /api/colegio/alertas/[id]/escalar` (rector escala al comité).
- [ ] Validar que exista la cuenta del comité del colegio.
- [ ] Crear `SolicitudComite` con `colegioId`, `alertaColegioId`, `creadoPorId`.
- [ ] Auditar `COLEGIO_CASO_ESCALADO_A_COMITE`.
- [ ] Test de API: escalamiento, duplicado, alerta ajena, falta de cuenta.

## T010 — Endpoints de bandeja y resolución del comité
- [ ] `GET /api/colegio/comite/solicitudes`.
- [ ] `GET /api/colegio/comite/solicitudes/[id]`.
- [ ] `POST /api/colegio/comite/solicitudes/[id]/resolver`.
- [ ] `POST /api/colegio/comite/solicitudes/[id]/notas`.
- [ ] Tests de API: A/B, resolución, bitácora, privacidad.

## T011 — Frontend de gestión del comité (rector)
- [ ] Crear `/dashboard/colegio/comite/page.tsx`.
- [ ] Crear componentes `ComiteCuentaCard`, `IntegranteForm`, `IntegrantesList`.
- [ ] Integrar endpoints de cuenta e integrantes.
- [ ] Tests de componente con mocked handlers.

## T012 — Frontend de bandeja del comité
- [ ] Crear `/dashboard/colegio/comite/casos/page.tsx`.
- [ ] Crear `/dashboard/colegio/comite/casos/[id]/page.tsx`.
- [ ] Crear componentes `SolicitudesBandeja` y `CasoDetalle`.
- [ ] Mostrar resumen, timeline, bitácora y formulario de resolución sin exponer contenido/denunciante.
- [ ] Tests de componente.

## T013 — Auditoría y arquitectura
- [ ] Asegurar que cada mutación emita `AuditLog` con la acción correcta y metadatos sin PII.
- [ ] Verificar que no se fugue texto de reporte en logs ni auditoría.
- [ ] Regenerar artefactos de arquitectura (`npm run arch:check` en verde).

## T014 — Gate y cierre
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run tokens:check`, `npm run arch:check`, `npm run test:coverage`, `npm run build` verdes.
- [ ] Actualizar `specs/README.md` **solo si el protocolo lo exige al cerrar** (no en este entregable).
- [ ] Commit, push a `work/002-pi-068`, PR a `feature/001-scaffolding`.
- [ ] CI-PUSH verde.
