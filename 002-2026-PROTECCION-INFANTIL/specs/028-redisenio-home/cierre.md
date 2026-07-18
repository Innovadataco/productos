# Reporte de cierre: Rediseño del Home (Spec 028)

**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md) | **Quickstart**: [`quickstart.md`](./quickstart.md)

**Fecha de cierre**: 2026-07-18

**Estado**: ✅ CERRADA

**Rama**: `feature/001-scaffolding`

---

## Resumen

Se rediseñó la landing page (`/`) para orientar al usuario desde el primer vistazo: dos acciones grandes (reportar y consultar), más accesos secundarios a registro y dashboard público. Se conservó el buscador existente y el estilo glassmorphism. No se tocó backend, auth ni endpoints.

---

## Decisiones y reutilización

- **Componente modificado**: `src/components/modules/LandingHero.tsx`.
- **Sin componentes nuevos**: todos los iconos son SVG inline para no agregar dependencias.
- **No se tocó**: `HomePageClient.tsx`, `ConsultaForm.tsx`, `ConsultaResultado.tsx`, ni ningún endpoint.
- **Textos**: español neutral, textos aprobados por el owner, sin voseo.
- **Responsive**: grid de 1 columna en móvil, 2 columnas en `sm`.
- **Accesibilidad**: iconos decorativos con `aria-hidden`, textos visibles en todos los enlaces.

---

## Verificaciones realizadas

| Check | Comando | Resultado |
|-------|---------|-----------|
| Lint | `npm run lint` | ✅ 0 errores (1 warning preexistente en `src/lib/sms.ts`) |
| TypeScript | `npx tsc --noEmit` | ✅ Sin errores |
| Tests unitarios | `npm run test` | ✅ 343 tests pasaron |
| Build | `npm run build` | ✅ Compilación exitosa |
| Smoke E2E | `npx tsx scripts/smoke-e2e.ts` | ✅ PASÓ (8/8 pasos) |
| Home renderizado | `curl http://localhost:5005/` | ✅ Muestra título, acciones y accesos secundarios |

---

## Despliegue

- App reiniciada en `http://localhost:5005` con `npx next start -p 5005 -H 0.0.0.0`.
- Worker reiniciado con `node --env-file=.env scripts/worker-supervisor.mjs`.
- Ambos procesos corren sobre la build actualizada.

---

## Archivos tocados/creados

- `src/components/modules/LandingHero.tsx` — rediseño completo del hero.
- `specs/028-redisenio-home/spec.md` — especificación (creado).
- `specs/028-redisenio-home/plan.md` — plan de implementación (creado).
- `specs/028-redisenio-home/quickstart.md` — escenarios de validación (creado).
- `specs/028-redisenio-home/cierre.md` — este reporte (creado).
- `specs/README.md` — índice maestro actualizado con la spec 028.

---

## Commits

```text
6d1c5b3 docs(specs): spec 028 rediseño del home con spec, plan y quickstart
16efae4 feat(ui): rediseño landing con acciones principales y accesos secundarios
```

---

## R7 (pipeline de clasificación)

No aplica. Este cambio no toca el pipeline de clasificación IA ni el procesamiento de reportes.

---

## Notas

- El acceso "Crear una cuenta" siempre visible, incluso para usuarios autenticados, para mantener la simplicidad visual del layout.
- El bug 021 (reporte anónimo para usuarios internos) no se resolvió en este cambio; el enlace a `/reportar` se mantiene.
