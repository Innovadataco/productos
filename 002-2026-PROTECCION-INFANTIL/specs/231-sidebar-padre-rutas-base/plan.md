# Plan de implementación — SPEC-231

## Stack técnico

- Next.js 16.2.10 App Router, React 19 Server Components por defecto.
- Tailwind CSS 3.4 con tokens `cielo` existentes.
- TypeScript 5 strict, sin `any`.
- Componente cliente `PadreSideNav` ("use client") para estado activo por ruta.
- Layout server component en `src/app/dashboard/padre/layout.tsx` con guarda de sesión.

## Arquitectura propuesta

```
src/
├── app/dashboard/padre/
│   ├── layout.tsx              # Guarda PARENT + tema + PadreSideNav
│   ├── page.tsx                # Inicio (placeholder)
│   ├── expedientes/page.tsx    # Placeholder
│   ├── reportar/page.tsx       # Placeholder
│   ├── suscripcion/page.tsx    # Placeholder (SPEC-211 la implementará)
│   ├── circulo-confianza/page.tsx
│   ├── notificaciones/page.tsx
│   └── perfil/page.tsx
└── components/modules/padre/
    └── PadreSideNav.tsx        # Sidebar cielo con 7 items

src/lib/
└── nav-items.ts                # + PADRE_NAV_ITEMS

src/app/globals.css             # + .theme-padre (mapeo a cielo)
```

## Dependencias

- SPEC-210 (Pagos): modelos de suscripción en BD.
- SPEC-230 (Padre v2): modelos Expediente/EventoExpediente en BD.
- Componentes existentes: `ColegioSideNav` (patrón), `AdminNav` (patrón), `GlassCard` / `PanelVidrio` (para placeholders).

## Pasos de implementación

1. Agregar `.theme-padre` en `globals.css` (mapeo de tokens `cielo`, análogo a `.theme-colegio`).
2. Agregar `PADRE_NAV_ITEMS` en `src/lib/nav-items.ts` con los 7 items.
3. Crear `PadreSideNav.tsx` con estado activo, íconos SVG, color cielo.
4. Crear `layout.tsx` en `/dashboard/padre` con verificación de sesión PARENT y uso de `PadreSideNav`.
5. Crear las 7 páginas placeholder con título + "Próximamente".
6. Tests de componente para `PadreSideNav`.
7. Gate local + push.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Conflicto con SPEC-211 en `/dashboard/padre/suscripcion` | SPEC-231 solo crea placeholder; SPEC-211 solo edita `suscripcion/page.tsx`. Orden de merge: 231 primero. |
| Rutas antiguas (`/dashboard/mis-reportes`) se rompen | No se tocan. `/dashboard/padre/*` es un subárbol nuevo. |
| Falta de módulos de permisos para padre | Se documenta como decisión: sin filtrado por módulo en v1. |

## Gate de calidad

- `npx tsc --noEmit`
- `npm run lint -- --no-cache`
- `npm run arch:check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- Humo con `next start`
