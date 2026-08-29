# Plan de implementación — SPEC-233

## Stack técnico

- Next.js 16.2.10 App Router, React 19 Server Components por defecto (mismo patrón que SPEC-232: páginas servidor que leen vía DAL, componentes cliente solo para la caja de búsqueda interactiva).
- Prisma 5.22.0 vía DAL (`ExpedienteRepository` + `obtenerSenalComunitaria`); cero imports de `@/lib/prisma` en páginas/componentes.
- Tailwind CSS 3.4 con tema `cielo` (padre) y `ambar` (admin), componentes vidrio heredados (`GlassCard`); radios 16/12/22.
- `date-fns-tz` con `America/Bogota` para fechas (D-69).
- Cero endpoints API nuevos: las vistas son Server Components con lectura directa por DAL.

## Arquitectura propuesta

```
src/
├── app/dashboard/padre/identificador/[nick]/
│   └── page.tsx                        # Vista padre (Server Component, rol PARENT)
├── app/dashboard/admin/identificador/[nick]/
│   └── page.tsx                        # Vista admin (Server Component, ADMIN + COMITE_VALIDACION)
├── components/modules/padre/
│   ├── IdentificadorBusquedaClient.tsx # Caja de búsqueda + lista de expedientes propios
│   └── ExpedienteDetalleClient.tsx     # (edición) link "Ver todos tus expedientes sobre este identificador"
├── components/modules/admin/
│   ├── IdentificadorAdminClient.tsx    # Caja de búsqueda admin
│   ├── IdentificadorAgregadoAnonimo.tsx# Agregado anónimo (señal comunitaria)
│   └── IdentificadorExpedientesAnonimos.tsx # Lista anonimizada (sin padreUsuarioId)
└── lib/dal/repositories/
    └── expediente-repository.ts        # +2 métodos aditivos
```

## Dependencias

- SPEC-230: `ExpedienteRepository` (`src/lib/dal/repositories/expediente-repository.ts`), modelos `Expediente`/`EventoExpediente`.
- SPEC-231: `PadreSideNav`, layout padre, tema `cielo`.
- SPEC-232: `src/app/dashboard/padre/expedientes/[id]/page.tsx` + `ExpedienteDetalleClient` (ancla del link de entrada) + helpers `src/lib/padre/expediente-ui.ts`.
- SPEC-234: `obtenerSenalComunitaria` (`src/lib/expediente/compilacion/queries/senal-comunitaria.ts:128`) con fallback de recálculo al vuelo.
- Componentes UI existentes: `GlassCard`, `Cargando`, `ErrorState`.

## Pasos de implementación

1. Agregar `listarExpedientesDePadrePorIdentificador(padreUsuarioId, identificadorReportado)` a `ExpedienteRepository` (orden `fechaApertura` desc, paginación estándar).
2. Agregar `listarExpedientesPorIdentificadorAnonimo(identificadorReportado)` con `select` explícito que excluye `padreUsuarioId`, eventos y textos.
3. Tests de los dos métodos del repository (filtro por padre; select anonimizado).
4. Crear `IdentificadorBusquedaClient` (búsqueda + lista + estado vacío) y la página padre.
5. Editar `ExpedienteDetalleClient` para agregar el link de entrada a la vista de búsqueda.
6. Crear componentes admin (`IdentificadorAgregadoAnonimo`, `IdentificadorExpedientesAnonimos`, `IdentificadorAdminClient`) y la página admin con guarda de rol `ADMIN`/`COMITE_VALIDACION`.
7. Tests de componente: lista padre (orden, vacío, links) y vista admin (ausencia de campos sensibles en el render).
8. Regenerar artefactos de arquitectura y dejar `arch:check` verde.
9. Gate local + push.

## Decisiones con alternativas consideradas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Server Components + DAL directo, sin API routes | Endpoint `GET /api/padre/identificador/[nick]` + fetch cliente | SPEC-232 ya fijó el patrón página-servidor/DAL; un endpoint duplica validación de sesión sin beneficio en v1. |
| Agregado admin vía `obtenerSenalComunitaria` | Query agregada ad-hoc sobre `Expediente` | Reutiliza la fuente única de SPEC-234 (caché + recálculo), evita divergencia de criterios. |
| Lista admin con `select` anonimizado en DAL | Traer expedientes completos y filtrar campos en UI | El `select` de Prisma garantiza que `padreUsuarioId`/textos jamás salen de la capa de datos (Ley 1581 por construcción). |
| Sin botón "Ver detalle" en lista admin v1 | Link a detalle admin de expediente | No existe esa vista; el candado del instructivo fija "solo agregado anónimo"; el detalle llega con SPEC-237. |
| Entrada admin solo por URL + búsqueda en la vista | Item nuevo en `AdminNav` / card en home admin | `AdminNav` usa permisos granulares por módulo (`modulosPermitidosParaRol`); tocarlo amplía el blast radius y arriesga colisión con otras SPECs. |
| Restricción de rol en la página admin | Cambios en `src/lib/proxy.ts` | El proxy ya permite `/dashboard/admin/**` a roles internos; la guarda fina (excluir OPERADOR) vive en la página, como hacen otras vistas admin-only (`ADMIN_ONLY_ROUTES` para comité gestión). |

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Fuga de identidad del padre en vista admin | `select` explícito en DAL + test de componente que barre el HTML buscando `padreUsuarioId`/emails/textos. |
| Identificador con caracteres especiales rompe la ruta | `encodeURIComponent` al navegar; decodificar `params` en la página; validación máx 100 chars. |
| Caché de señal comunitaria invalidada | `obtenerSenalComunitaria` recalcula al vuelo (fallback ya implementado en SPEC-234). |
| Colisión con SPEC-237 (bandeja comité) en archivos admin | SPEC-233 solo crea rutas `identificador/` nuevas; no toca `comite/` ni `AdminNav`. |

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test`
- `npm run build`
- `./scripts/dev-restart.sh` + humo con `next start`
