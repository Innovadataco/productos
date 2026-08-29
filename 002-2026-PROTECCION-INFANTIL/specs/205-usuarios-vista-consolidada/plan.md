# Plan de implementación: SPEC-205 — Usuarios · Vista consolidada por rol (002-PI-102)

## Resumen

Rediseño de `/dashboard/admin/usuarios` como tablero operativo consolidado por rol. Trabajo dividido en: backend de agregados (KPI + listados), backend de detalle, frontend de dashboard/sub-tabs, frontend de detalle por rol y tests. Todo es solo lectura + UI. Cero cambios en motor `src/lib/ai/**`.

## Contexto técnico

- **Framework**: Next.js 16.2.10 App Router, React 19 Server Components por defecto.
- **Lenguaje**: TypeScript 5 con `strict: true`.
- **ORM**: Prisma 5.22.0 sobre PostgreSQL 16.
- **Auth**: JWT manual (`jose` + `bcryptjs`) + cookie `httpOnly`.
- **UI**: Tailwind CSS 3.4, componentes en `src/components/ui/**` y `src/components/modules/**`.
- **Testing**: Vitest + jsdom + Testing Library.

## Constitution Check

- ✅ Sin multimedia (solo texto + agregados numéricos).
- ✅ Presunción de inocencia (lenguaje estadístico, nunca veredictos).
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados (no es flujo de reporte).
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/205-usuarios-vista-consolidada/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── endpoints.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
src/app/dashboard/admin/usuarios/page.tsx
src/app/dashboard/admin/usuarios/UsuariosAdminClient.tsx
src/app/dashboard/admin/usuarios/[id]/page.tsx
src/app/dashboard/admin/usuarios/[id]/UsuarioDetalleClient.tsx
src/app/dashboard/admin/usuarios/[id]/components/
    ├── DetallePadre.tsx
    ├── DetalleRector.tsx
    ├── DetalleOperador.tsx
    ├── DetalleComiteConvivencia.tsx
    ├── DetalleComiteValidacion.tsx
    └── DetalleAdmin.tsx
src/app/api/admin/usuarios/route.ts
src/app/api/admin/usuarios/route.test.ts
src/app/api/admin/usuarios/dashboard/route.ts
src/app/api/admin/usuarios/dashboard/route.test.ts
src/app/api/admin/usuarios/[id]/route.ts
src/app/api/admin/usuarios/[id]/route.test.ts
src/lib/dal/services/usuarios-consolidado.ts
src/lib/dal/types/usuarios-consolidado.ts
src/components/modules/admin/UsuariosSubNav.tsx
src/components/modules/admin/UsuariosKpiCards.tsx
src/components/modules/admin/tables/
    ├── PadresTable.tsx
    ├── RectoresTable.tsx
    ├── OperadoresTable.tsx
    ├── ComiteConvivenciaTable.tsx
    ├── ComiteValidacionTable.tsx
    └── AdminsTable.tsx
```

## Cambios de código

### 1. Backend — KPI dashboard
- Crear `src/lib/dal/services/usuarios-consolidado.ts`:
  - `resumenPorRol()`: un solo query SQL/Prisma que devuelve totales por rol y estado para Padres, Rectores, Operadores, Comité (convivencia + validación) y Admins.
  - `alertasDashboard()`: alertas derivadas (operadores sobrecargados, comité sin miembros, colegios sin rector).
- Crear `GET /api/admin/usuarios/dashboard`:
  - Valida `verifyAuth("ADMIN")` + `assertModulo(..., "usuarios_admin")`.
  - Devuelve `{ kpi: [...], alertas: [...] }`.

### 2. Backend — Listados por rol
- Extender `GET /api/admin/usuarios`:
  - Query params: `rol`, `page`, `pageSize`, `q`, `estado`.
  - Para `rol=OPERADOR`, delega en `OperadorService.panelAsignacion()` y enriquece con métricas 30d de `OperadorMetricasService` si es necesario.
  - Para otros roles, usa `UsuarioRepository` + repositorios de colegio/comité/reporte según corresponda.
  - DTOs distintos por rol.
- Validar rate-limit `admin_read`.

### 3. Backend — Detalle consolidado
- Crear `GET /api/admin/usuarios/[id]`:
  - Busca usuario por id; si no existe, 404.
  - Según `usuario.rol`, construye DTO cruzando fuentes:
    - `PARENT`: reportes enviados (metadatos), colegios asociados, fecha registro.
    - `SCHOOL_ADMIN`: colegio(s) que dirige, integrantes por rol, reportes del colegio, accesos recientes.
    - `OPERADOR`: métricas desde `OperadorMetricasService.obtenerMetricas()` + histórico de reasignaciones.
    - `COMITE_CONVIVENCIA`: colegio asociado, operadores del colegio, casos escalados, tiempo medio resolución.
    - `COMITE_VALIDACION`: casos escalados a plataforma en curso, últimas 10 decisiones, tasa aprobación/rechazo.
    - `ADMIN`: módulos con grants, última sesión, últimas acciones sensibles desde `AuditLog`.

### 4. Frontend — Dashboard + sub-tabs
- `src/app/dashboard/admin/usuarios/page.tsx`: Server Component con `verificarAccesoPagina("usuarios_admin")`.
- `UsuariosKpiCards.tsx`: renderiza 5 tarjetas con colores de alerta.
- `UsuariosAdminClient.tsx`:
  - Recibe `rol` activo.
  - Carga KPI al montar.
  - Renderiza `UsuariosSubNav` con 6 tabs.
  - Renderiza tabla correspondiente según `rol`.
- `UsuariosSubNav.tsx`: actualizar a 6 tabs y activo por `startsWith`.

### 5. Frontend — Tablas por rol
- 6 componentes de tabla, una por rol, con columnas definidas en el BRIEF.
- Cada fila tiene "Ver detalle" → `/dashboard/admin/usuarios/[id]`.
- Paginación reusable.

### 6. Frontend — Detalle por rol
- `UsuarioDetalleClient.tsx`: recibe usuario + datos cruzados; selecciona componente de render según `rol`.
- 6 componentes de detalle, cada uno con acciones útiles del rol.

### 7. Migración
- Ninguna en la fase inicial. Si el agregado de KPI es lento en BD grande, se evalúa índice aditivo en `Usuario(rol, estado)` en una fase posterior.

### 8. Tests
- Tests de integración para `GET /api/admin/usuarios/dashboard`.
- Tests de integración para `GET /api/admin/usuarios?rol=...` (al menos OPERADOR y PARENT).
- Tests de integración para `GET /api/admin/usuarios/[id]` (un rol representativo).
- Tests de componente para `UsuariosKpiCards`, `UsuariosSubNav` y al menos una tabla.
- Test que verifica coincidencia de conteos entre `/usuarios?rol=OPERADOR` y `/operadores/asignacion`.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Divergencia de conteos de operadores | Reusar `OperadorService.panelAsignacion()` como fuente única |
| Queries lentos con muchos usuarios | Agregados SQL + índices aditivos si se detecta lentitud |
| Exposición de PII | Revisar selects; tests de contrato que validan ausencia de texto de reporte |
| Detalle por rol con muchas ramas | 6 componentes aislados; un solo DTO por rol desde el backend |
| Cambio visual grande regresa feedback del CEO | Componentes por separado; fácil ajustar una tabla sin tocar otra |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- Tests de integración para dashboard, listado y detalle.
- No tocar `src/lib/ai/**`.
- Sin migraciones destructivas.
