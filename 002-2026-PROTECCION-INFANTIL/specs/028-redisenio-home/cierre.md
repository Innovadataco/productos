# Reporte de cierre: Rediseño completo del Home (Spec 028)

**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md) | **Quickstart**: [`quickstart.md`](./quickstart.md)

**Fecha de cierre**: 2026-07-18

**Estado**: ✅ CERRADA

**Rama**: `feature/001-scaffolding`

---

## Resumen

Se rediseñó por completo la landing page (`/`). El home ahora se centra exclusivamente en dos acciones: crear un reporte y consultar un identificador. El buscador y su resultado se integraron dentro de la tarjeta "Consultar". Se simplificó la barra superior, se eliminaron las secciones redundantes ("¿Cómo funciona?", accesos secundarios) y se conservó la sección de canales oficiales de denuncia. Se actualizó el footer con el copyright de Innovadataco. No se tocó backend, auth ni endpoints.

---

## Decisiones y reutilización

- **Componentes modificados**:
  - `src/components/modules/NavHeader.tsx`: se eliminaron "Consultar" y "Reportar" del menú superior y móvil; se conservaron "Dashboard" e "Iniciar sesión".
  - `src/components/modules/LandingHero.tsx`: nuevo layout con dos tarjetas, buscador integrado en la tarjeta "Consultar" y resultado renderizado dentro de ella (0, 1-2 o >2 reportes).
  - `src/components/modules/HomePageClient.tsx`: contenedor simplificado que pasa el estado de la consulta a `LandingHero`, conserva `CanalesOficiales` y `LandingFooter`, y elimina `LandingFeatures`.
  - `src/components/modules/LandingFooter.tsx`: copyright actualizado a "© 2026 Innovadataco. Todos los derechos reservados." y eliminación del enlace "Reportar".
  - `src/components/modules/ConsultaForm.tsx`: se reutilizó el modo `compact` para ocultar el label dentro de la tarjeta.
- **Sin componentes nuevos**: iconos SVG inline; sin nuevas dependencias.
- **No se tocó**: `ConsultaResultado.tsx` (sigue usado en `/consulta`), endpoints de consulta, wizard de reporte, auth.
- **Tono**: español neutral, sin voseo. Se eliminó `LandingFeatures` del home, que contenía imperativos con voseo.
- **Responsive**: grid `sm:grid-cols-[1fr_1.25fr]` en escritorio; en móvil las tarjetas se apilan verticalmente.
- **Accesibilidad**: iconos decorativos con `aria-hidden`, textos visibles, input con label asociado (oculto visualmente en modo compacto pero accesible para lectores de pantalla).

---

## Verificaciones realizadas

| Check | Comando | Resultado |
|-------|---------|-----------|
| Lint | `npm run lint` | ✅ 0 errores (1 warning preexistente en `src/lib/sms.ts`) |
| TypeScript | `npx tsc --noEmit` | ✅ Sin errores |
| Tests unitarios | `npm run test` | ✅ 343 tests pasaron |
| Build | `npm run build` | ✅ Compilación exitosa |
| Smoke E2E | `npx tsx scripts/smoke-e2e.ts` | ✅ PASÓ (8/8 pasos) |
| Home renderizado | `curl http://localhost:5005/` | ✅ Muestra título, tarjetas, buscador integrado y canales oficiales; sin Consultar/Reportar en el menú |

---

## Despliegue

- App reiniciada en `http://localhost:5005` con `npx next start -p 5005 -H 0.0.0.0`.
- Worker reiniciado con `node --env-file=.env scripts/worker-supervisor.mjs`.
- Ambos procesos corren sobre la build actualizada.

---

## Archivos tocados/creados

- `src/components/modules/NavHeader.tsx`
- `src/components/modules/LandingHero.tsx`
- `src/components/modules/HomePageClient.tsx`
- `src/components/modules/LandingFooter.tsx`
- `src/components/modules/ConsultaForm.tsx` (modo `compact` preexistente, reutilizado)
- `specs/028-redisenio-home/spec.md`
- `specs/028-redisenio-home/plan.md`
- `specs/028-redisenio-home/quickstart.md`
- `specs/028-redisenio-home/cierre.md`
- `specs/README.md` (sin cambios en esta iteración, ya actualizado previamente)

---

## Commits

```text
96237bd docs(specs): cierre 028 actualizado con rediseño completo
51635de feat(ui): rediseño completo del home con buscador integrado en tarjeta
81eea86 docs(specs): rediseño completo del home 028 con buscador integrado
8bf0d30 docs(specs): actualizar cierre 028 con commits finales y evidencia del smoke
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

- El bug 021 (reporte anónimo para usuarios internos) no se resolvió en este cambio; el enlace a `/reportar` en el hero se mantiene.
- El componente `LandingFeatures` se mantiene en el repo pero ya no se usa en el home; puede reutilizarse en una página de documentación futura.
- El resultado de la consulta se muestra dentro de la tarjeta "Consultar"; para más de 2 reportes se ofrece un enlace a la vista completa `/consulta`.
