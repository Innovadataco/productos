# Reporte de cierre: Rediseño completo del Home (Spec 028) — ajuste botones de reporte y acceso anónimo

**Spec**: [`spec.md`](./spec.md) | **Plan**: [`plan.md`](./plan.md) | **Quickstart**: [`quickstart.md`](./quickstart.md)

**Fecha de cierre**: 2026-07-18

**Estado**: ✅ CERRADA

**Rama**: `feature/001-scaffolding`

---

## Resumen

Se ajustó la landing page (`/`) para que la tarjeta "Crear un reporte" ofrezca dos botones claros: "Reportar anónimo" (directo al wizard) y "Reportar con mi cuenta" (login con redirect). Se corrigió el acceso anónimo a `/reportar` modificando `src/proxy.ts` para que usuarios sin sesión no sean redirigidos a login. Las cuentas internas (ADMIN/OPERADOR/SCHOOL_ADMIN) siguen bloqueadas por el wizard (bug 021). El resto del home se mantuvo: tarjeta "Consultar" con buscador y resultado dentro, canales oficiales y footer Innovadataco.

---

## Decisiones y reutilización

- **Componentes modificados**:
  - `src/proxy.ts`: `/reportar` agregada a `PUBLIC_ROUTES` y quitada de `USER_FINAL_ROUTES`, permitiendo acceso anónimo sin redirigir a login; internos siguen sin poder usar `/reportar` como flujo de usuario final (bloqueados por el wizard).
  - `src/components/modules/LandingHero.tsx`: tarjeta "Crear un reporte" ahora tiene dos botones con iconos (ojo tachado para anónimo, usuario para cuenta); botón destacado con `accent-gradient` y botón secundario con fondo claro y borde.
  - `src/components/modules/NavHeader.tsx`, `HomePageClient.tsx`, `LandingFooter.tsx`: sin cambios en esta iteración (ya ajustados previamente).
- **Sin componentes nuevos**: iconos SVG inline; sin nuevas dependencias.
- **Tono**: español neutral, sin voseo ("Elige", "Reporta").
- **Responsive**: los botones se apilan dentro de la tarjeta; en móvil la tarjeta se apila bajo "Consultar".
- **Accesibilidad**: iconos decorativos con `aria-hidden`, textos visibles en ambos botones.

---

## Verificaciones realizadas

| Check | Comando | Resultado |
|-------|---------|-----------|
| Lint | `npm run lint` | ✅ 0 errores (1 warning preexistente en `src/lib/sms.ts`) |
| TypeScript | `npx tsc --noEmit` | ✅ Sin errores |
| Tests unitarios | `npm run test` | ✅ 343 tests pasaron |
| Build | `npm run build` | ✅ Compilación exitosa |
| Smoke E2E | `npx tsx scripts/smoke-e2e.ts` | ✅ PASÓ (8/8 pasos) |
| Acceso anónimo a `/reportar` | `curl -I http://localhost:5005/reportar` | ✅ HTTP 200, sin redirect a `/login` |
| Home renderizado | `curl http://localhost:5005/` | ✅ Muestra título, tarjetas, botones de reporte y buscador integrado |

---

## Despliegue

- App reiniciada en `http://localhost:5005` con `npx next start -p 5005 -H 0.0.0.0`.
- Worker reiniciado con `node --env-file=.env scripts/worker-supervisor.mjs`.
- Ambos procesos corren sobre la build actualizada.

---

## Archivos tocados/creados

- `src/proxy.ts`
- `src/components/modules/LandingHero.tsx`
- `specs/028-redisenio-home/spec.md`
- `specs/028-redisenio-home/plan.md`
- `specs/028-redisenio-home/quickstart.md`
- `specs/028-redisenio-home/cierre.md`

---

## Commits

```text
e912af8 feat(ui): tarjeta Crear un reporte con botones anónimo y con cuenta
c545a15 fix(proxy): permitir acceso anónimo a /reportar sin redirigir a login
e395537 docs(specs): ajustes 028 botones de reporte y acceso anónimo
791d267 docs(specs): cierre 028 con lista final de commits
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

- La corrección de `src/proxy.ts` permite que anónimos lleguen a `/reportar`, pero no altera el wizard: usuarios internos aún ven el bloqueo de cuentas internas.
- El botón "Reportar con mi cuenta" aprovecha el soporte de `?redirect=` que ya existía en la página de login.
- El componente `LandingFeatures` se mantiene en el repo pero no se usa en el home.
