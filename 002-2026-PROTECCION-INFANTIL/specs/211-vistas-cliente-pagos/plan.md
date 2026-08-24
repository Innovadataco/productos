# Plan de implementación: SPEC-211 — Vistas cliente (Rector + Padre) (002-PI-111)

## Resumen

Crear las vistas de suscripción para rector y padre con los 7 bloques estándar, formulario de renovación, upload de comprobante e integración con el DAL de pagos.

## Contexto técnico

- Next.js App Router, Server Components por defecto.
- Tailwind CSS 3.4; tokens `pino` (rector), `cielo` (padre), `ambar` (pagos).
- `date-fns-tz` para fechas Bogotá.
- DAL: `PagosRepository`.

## Constitution Check

- ✅ Sin multimedia (upload solo almacena archivo de comprobante; no se procesa contenido).
- ✅ Presunción de inocencia no aplica.
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/211-vistas-cliente-pagos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── 211-vistas-cliente.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
src/app/dashboard/colegio/suscripcion/page.tsx
src/app/dashboard/padre/suscripcion/page.tsx
src/components/modules/cliente/suscripcion/SuscripcionResumen.tsx
src/components/modules/cliente/suscripcion/SuscripcionAcciones.tsx
src/components/modules/cliente/suscripcion/HistorialPagos.tsx
src/components/modules/cliente/suscripcion/CodigoReferidoCard.tsx
src/components/modules/cliente/suscripcion/AplicarBonoCard.tsx
src/components/modules/cliente/suscripcion/ContratoCard.tsx
src/components/modules/cliente/suscripcion/CancelarSuscripcion.tsx
src/components/modules/cliente/suscripcion/RenovacionForm.tsx
src/app/api/pagos/suscripcion/route.ts
src/app/api/pagos/renovacion/route.ts
src/lib/pagos/renovacion.service.ts
```

## Cambios de código

### 1. Páginas de cliente

- `/dashboard/colegio/suscripcion/page.tsx`: server component, usa layout existente.
- `/dashboard/padre/suscripcion/page.tsx`: server component, asume layout de SPEC-231.

### 2. Componentes de los 7 bloques

Crear componentes modulares en `src/components/modules/cliente/suscripcion/`.

### 3. Formulario de renovación

Cliente (`"use client"`):
- Selección duración.
- Fetch precio local calculado (server action o API).
- Inputs: método pago, notas.
- Upload comprobante (client-side validation de tamaño/tipo).
- Submit a `POST /api/pagos/renovacion`.

### 4. Endpoints API

- `GET /api/pagos/suscripcion`: datos de la suscripción del cliente.
- `POST /api/pagos/renovacion`: crea `Pago` pendiente.

Ambos usan `PagosRepository`.

### 5. Upload de comprobante

- Servicio de storage (S3 o disco local).
- Calcular SHA256 antes de guardar.
- Validar tamaño y mime-type con parámetros.

### 6. Cancelación

- Endpoint `POST /api/pagos/suscripcion/cancelar`.
- Triple confirmación en UI.
- Cambia estado a `CANCELADA`, registra `AuditLog`.

### 7. Tests

- Tests de componentes (renderizado condicional por estado).
- Tests de API de renovación.
- Tests E2E de flujo completo.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| No existe sidebar padre | Documentar dependencia SPEC-231; no bloquear vista rector. |
| No existe `ColegioSideNav` | Verificar antes de implementar; si falta, reportar. |
| Storage de comprobantes | Decidir en implementación; mínimo viable = disco local con path configurado. |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde: sin imports de `@/lib/prisma` en `src/app/**`.
- Tests de API y componentes pasan.
- Responsive verificado.
