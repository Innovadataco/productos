# Cierre: Spec 054 — Corrección post-cierre 049 y 051 (Accesibilidad y UI)

**Spec**: `specs/054-correccion-049-051-accesibilidad-ui/`  
**Feature Branch**: `feature/001-scaffolding`  
**Fecha de cierre**: 2026-07-20  
**Status**: CERRADA

---

## Resumen

Se implementaron las correcciones de accesibilidad y UI identificadas tras el cierre de los specs 049 y 051: modal reusable accesible, tooltip y navegación por teclado para botones de ícono, y corrección de contraste en dark mode. No se reabrieron los specs originales; las correcciones quedan documentadas bajo el spec 054.

## Commits

```
84049d6 feat(054-US1): modal reusable accesible con Escape, overlay, focus trap y focus restoration
9858958 feat(054-US2): tooltip accesible y navegación por teclado para botones de ícono y divs clicables
064dc42 feat(054-US3): corregir contraste en dark mode y mejorar auditoría de contraste
```

(El cuarto commit de documentación se agregará junto con este cierre.)

## Archivos modificados

- `src/components/ui/Modal.tsx` (nuevo)
- `src/components/ui/Modal.test.tsx` (nuevo)
- `src/components/ui/Tooltip.tsx` (nuevo)
- `src/components/ui/Tooltip.test.tsx` (nuevo)
- `src/components/modules/AdminReporteDetalle.tsx`
- `src/components/modules/ComiteSolicitudDetalle.tsx`
- `src/components/modules/SpamRevisionPanel.tsx`
- `src/components/modules/Sparkline.tsx`
- `src/components/modules/NavHeader.tsx`
- `src/components/modules/CategoriaGruposEditor.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/ThemeToggle.tsx`
- `src/components/ui/GlassCard.tsx`
- `src/lib/labels.ts`
- `scripts/a11y_audit.js`
- `scripts/contrast_check.js`
- `package.json`
- `specs/054-correccion-049-051-accesibilidad-ui/spec.md`
- `docs/PRE-PRODUCCION.md` (si aplica)

## Resultados de pruebas y validación

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | OK |
| `npm run lint` | OK |
| `npm run test` | 556 tests OK |
| `npm run a11y:audit` | 0 issues |
| `npm run a11y:contrast` | 0 failures |
| `npm run build` | OK |
| `./scripts/dev-restart.sh` | OK (healthcheck `status=ok`, `workerAlive=true`, `dbOk=true`) |

## Evidencia de deploy

Healthcheck en `http://localhost:5005/api/health/worker`:

```json
{"status":"ok","workerAlive":true,"dbOk":true,"timestamp":"2026-07-20T17:14:05.065Z"}
```

## Notas de pre-producción

La medición de contraste con herramientas externas (axe/Lighthouse) sobre las vistas reales en modo claro y oscuro no está disponible en el entorno de desarrollo. El script `scripts/contrast_check.js` cubre los pares estáticos de los componentes corregidos, pero la auditoría final en navegador debe completarse antes del despliegue a producción. Ítem registrado en `docs/PRE-PRODUCCION.md` Sección 3.

## Deuda técnica

- El test de integración `Modal.integration.test.tsx` (T007 en `tasks.md`) se consideró cubierto por los tests unitarios de `Modal.tsx` y los tests existentes de `AdminReporteDetalle`, `ComiteSolicitudDetalle` y `SpamRevisionPanel`, ya que todos los modales reemplazados consumen el mismo componente `Modal`.
- La verificación manual del `quickstart.md` (cierre con Escape/overlay, tooltips visibles, orden de tabulación) requiere confirmación humana en el navegador.

## Status final

CERRADA — implementación, validación y documentación completadas.
