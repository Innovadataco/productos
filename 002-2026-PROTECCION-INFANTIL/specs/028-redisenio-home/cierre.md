# Reporte de cierre: Rediseño del Home (Spec 028) — buscador integrado

**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md) | **Quickstart**: [`quickstart.md`](./quickstart.md)

**Fecha de cierre**: 2026-07-18

**Estado**: ✅ CERRADA

**Rama**: `feature/001-scaffolding`

---

## Resumen

Se rediseñó la landing page (`/`) para orientar al usuario desde el primer vistazo: dos tarjetas de acción grandes (reportar y consultar), con el buscador de identificador integrado dentro de la tarjeta "Consultar". Se eliminó el bloque separado "Consulta un identificador" debajo del hero. Se conservaron los accesos secundarios a registro y dashboard público, y el estilo glassmorphism. No se tocó backend, auth ni endpoints.

---

## Decisiones y reutilización

- **Componentes modificados**:
  - `src/components/modules/LandingHero.tsx`: nuevo layout, textos, iconos y buscador integrado en la tarjeta de consultar.
  - `src/components/modules/HomePageClient.tsx`: pasa `onSearch` a `LandingHero`, muestra resultados/estados debajo del hero y elimina el bloque `#consultar` separado.
  - `src/components/modules/ConsultaForm.tsx`: prop `compact` opcional para ocultar el label cuando se usa dentro de la tarjeta.
- **Sin componentes nuevos**: todos los iconos son SVG inline; no se agregaron dependencias.
- **No se tocó**: `ConsultaResultado.tsx`, endpoints de consulta, wizard de reporte, auth.
- **Textos**: español neutral, textos aprobados por el owner, sin voseo.
- **Responsive**: grid de 1 columna en móvil, `sm:grid-cols-[1fr_1.25fr]` en escritorio (consultar más ancha).
- **Accesibilidad**: iconos decorativos con `aria-hidden`, textos visibles en todos los enlaces, formulario con label asociado al input.

---

## Verificaciones realizadas

| Check | Comando | Resultado |
|-------|---------|-----------|
| Lint | `npm run lint` | ✅ 0 errores (1 warning preexistente en `src/lib/sms.ts`) |
| TypeScript | `npx tsc --noEmit` | ✅ Sin errores |
| Tests unitarios | `npm run test` | ✅ 343 tests pasaron |
| Build | `npm run build` | ✅ Compilación exitosa |
| Smoke E2E | `npx tsx scripts/smoke-e2e.ts` | ✅ PASÓ (8/8 pasos) |
| Home renderizado | `curl http://localhost:5005/` | ✅ Muestra título, tarjetas, buscador integrado y accesos secundarios |

---

## Despliegue

- App reiniciada en `http://localhost:5005` con `npx next start -p 5005 -H 0.0.0.0`.
- Worker reiniciado con `node --env-file=.env scripts/worker-supervisor.mjs`.
- Ambos procesos corren sobre la build actualizada.

---

## Archivos tocados/creados

- `src/components/modules/LandingHero.tsx` — rediseño completo del hero con buscador integrado.
- `src/components/modules/HomePageClient.tsx` — pasa `onSearch` a `LandingHero`, muestra resultados y elimina el bloque de consulta separado.
- `src/components/modules/ConsultaForm.tsx` — modo `compact` opcional.
- `specs/028-redisenio-home/spec.md` — especificación actualizada (modificada).
- `specs/028-redisenio-home/plan.md` — plan actualizado (modificado).
- `specs/028-redisenio-home/quickstart.md` — escenarios de validación actualizados (modificado).
- `specs/028-redisenio-home/cierre.md` — este reporte (modificado).
- `specs/README.md` — índice maestro actualizado con la spec 028.

---

## Commits

```text
6f1180d feat(ui): integrar buscador en tarjeta Consultar y eliminar bloque #consultar separado
b626eb7 docs(specs): actualizar spec 028 con buscador integrado en tarjeta de consultar
300ae9b docs(specs): reporte de cierre 028 y actualización del índice maestro
16efae4 feat(ui): rediseño landing con acciones principales y accesos secundarios
6d1c5b3 docs(specs): spec 028 redisenio del home con spec, plan y quickstart
```

---

## R7 (pipeline de clasificación)

No aplica. Este cambio no toca el pipeline de clasificación IA ni el procesamiento de reportes.

---

## Notas

- El acceso "Crear una cuenta" siempre visible, incluso para usuarios autenticados, para mantener la simplicidad visual del layout.
- El bug 021 (reporte anónimo para usuarios internos) no se resolvió en este cambio; el enlace a `/reportar` se mantiene.
- El bloque de consulta separado (`#consultar`) fue eliminado; el resultado de la consulta se muestra ahora debajo del hero.
