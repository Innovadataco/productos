# Plan de implementación — SPEC-232

## Stack técnico

- Next.js 16.2.10 App Router, React 19 Server Components por defecto.
- Componentes cliente para interactividad (formulario agregar evento, filtros).
- Tailwind CSS 3.4 con tema `cielo` (SPEC-231).
- `date-fns-tz` para cálculos de días en Bogotá.

## Arquitectura propuesta

```
src/
├── app/dashboard/padre/expedientes/
│   ├── page.tsx                    # Lista (reemplaza placeholder)
│   ├── [id]/page.tsx               # Detalle
│   └── components/
│       ├── ExpedientesListClient.tsx
│       ├── ExpedienteCard.tsx
│       ├── ExpedienteDetalleClient.tsx
│       ├── TimelineEventos.tsx
│       ├── AgregarEventoForm.tsx
│       └── AutoSuggestExpediente.tsx
├── app/api/padre/expedientes/[id]/eventos/
│   └── route.ts                    # POST agregar evento
└── lib/padre/
    └── expediente-ui.ts            # helpers de formato (días, estados)
```

## Dependencias

- SPEC-230: `ExpedienteRepository` con métodos de lista, detalle y agregar evento.
- SPEC-231: `PadreSideNav`, layout, tema `cielo`, `PlaceholderPadre`.
- Componentes UI existentes: `GlassCard`, `PanelVidrio`, `Cargando`, `ErrorState`.

## Pasos de implementación

1. Crear helpers de formato en `src/lib/padre/expediente-ui.ts`.
2. Crear componente `ExpedienteCard` y `ExpedientesListClient` con filtros.
3. Reemplazar `/dashboard/padre/expedientes/page.tsx` por la lista.
4. Crear componentes de detalle: `TimelineEventos`, `ExpedienteDetalleClient`.
5. Crear `/dashboard/padre/expedientes/[id]/page.tsx`.
6. Crear `AgregarEventoForm` (modal o inline).
7. Crear endpoint `POST /api/padre/expedientes/[id]/eventos`.
8. Crear `AutoSuggestExpediente` y montarlo en la lista.
9. Tests de integración del endpoint y tests de componente.
10. Gate local + push.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| `ExpedienteRepository.agregarEvento` crea Reporte con defaults genéricos | Aceptable para v1; el motor IA clasificará después. |
| AutoSuggest molesto si aparece siempre | Solo si expediente ACTIVO + 3+ días sin eventos. |
| Conflicto con SPEC-211 en `/dashboard/padre/suscripcion` | No se toca esa ruta. |

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- Humo con `next start`
