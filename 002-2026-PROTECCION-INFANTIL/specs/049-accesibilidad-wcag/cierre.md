# Cierre: SPEC-049 Accesibilidad (WCAG 2.2)

**Spec**: specs/049-accesibilidad-wcag/spec.md
**Status final**: CERRADA
**Fecha de cierre**: 2026-07-20
**Rama**: feature/001-scaffolding

---

## Resumen de alcance

Saneamiento de accesibilidad conforme a WCAG 2.2 sobre el sistema de diseño existente del Producto 002. Se trabajaron tres User Stories:

- **US1 (P1)**: nombres accesibles para controles con íconos y badges de riesgo sin dependencia exclusiva del color.
- **US2 (P1)**: medición y ajuste del contraste sobre superficies glass y botones.
- **US3 (P2)**: foco visible, navegación por teclado y targets táctiles ≥ 44×44 px.

No se crearon endpoints ni se modificaron datos/migraciones.

---

## Commits

```text
7a2e7e8 SPEC-049 US1: aria-label en iconos de estado y badges de riesgo
7f16d4c SPEC-049 US2: ajustar contraste glassmorphism y botones a WCAG 2.2
3313041 SPEC-049 US3: foco visible y touch targets >=44px para teclado/táctil
7b41d85 SPEC-049 docs: artefactos Spec-Kit y scripts de auditoría a11y/contraste
```

---

## Archivos tocados

### US1
- `src/components/modules/RiskBadge.tsx` — punto de color oculto a lectores de pantalla; badge con título accesible.
- `src/components/modules/NavHeader.tsx` — `aria-label` en dropdown de usuario; íconos decorativos con `aria-hidden`.
- `src/components/modules/AuditLogViewer.tsx` — Chevron decorativo con `aria-hidden`.
- `src/components/modules/AdminNav.tsx` — íconos decorativos con `aria-hidden`.
- `src/components/modules/LandingHero.tsx` — íconos decorativos con `aria-hidden`.
- `src/components/modules/LandingFeatures.tsx` — íconos decorativos con `aria-hidden`.
- `src/components/modules/CanalesOficiales.tsx` — íconos decorativos con `aria-hidden`.
- `src/components/modules/ConfirmacionReporte.tsx` — ícono de check decorativo con `aria-hidden`.
- `src/components/modules/ia/IaDocsPanel.tsx` — SVG del gauge decorativo con `aria-hidden`.
- `src/app/dashboard/admin/dataset-entrenamiento/page.tsx` — íconos de estado decorativos con `aria-hidden`.
- `src/app/offline/page.tsx` — ícono decorativo con `aria-hidden`.
- `src/components/ui/Select.tsx` — Chevron decorativo con `aria-hidden`.
- `src/components/ui/ThemeToggle.tsx` — íconos sol/luna con `aria-hidden` (el botón ya tenía `aria-label` dinámico).
- `src/components/modules/AdminReportesTable.tsx` — Chevron decorativo con `aria-hidden`.
- `src/components/modules/ConfigPanel.tsx` — Chevron decorativo con `aria-hidden`.

### US2
- `src/app/globals.css` — `text-accent` light a `sky-700`; `text-subtle` dark a `slate-400`.
- `src/components/ui/Button.tsx` — fondos `primary` (`sky-700`), `secondary` (`emerald-700`), `danger` (`red-700`) para contraste con texto blanco.
- `src/lib/labels.ts` — colores de texto por nivel de riesgo ajustados a tonos 700 en light / 400 en dark.
- `src/components/modules/AdminAntiAbusoSimulacion.tsx` — textos semánticos ajustados a 700/400 con contraste sobre glass.

### US3
- `src/app/globals.css` — fallback de `focus-visible` para botones y enlaces nativos sin `ring-accent`.
- `src/components/ui/ThemeToggle.tsx` — `h-11 w-11` (44×44 px).
- `src/components/modules/NavHeader.tsx` — touch targets ≥ 44 px en dropdown de usuario y menú móvil.

### Docs / scripts
- `specs/049-accesibilidad-wcag/` — spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md, checklists/requirements.md.
- `scripts/a11y_audit.js` — auditoría de iconos y botones sin label.
- `scripts/contrast_check.js` — medición de contrastes WCAG sobre Tailwind/glass.

---

## Resultados de pruebas

| Prueba | Comando | Resultado |
|--------|---------|-----------|
| TypeScript | `npx tsc --noEmit` | ✅ OK |
| Lint | `npm run lint` | ✅ OK (1 warning preexistente en GestionPageClient.tsx) |
| Tests | `npm run test` | ✅ 531 passed (92 files) |
| Contraste | `node scripts/contrast_check.js` | ✅ 0 fallos |
| Auditoría a11y | `node scripts/a11y_audit.js` | ✅ 0 icon-only buttons sin label; 0 SVGs sin accesible name |
| Build | `rm -rf .next && npm run build` | ✅ OK |
| Deploy | `./scripts/dev-restart.sh` | ✅ Healthcheck OK, worker único, puerto 5005 |
| Manual landing | `curl http://localhost:5005/` | ✅ HTTP 200 |

---

## Deuda técnica

- No se instaló `eslint-plugin-jsx-a11y` ni `@axe-core/react`; se usaron scripts manuales. Futura mejora: integrar uno de estos en CI para detectar regresiones.
- El script de contraste mide combinaciones fijas y no recorre el AST. Mejora futura: leer clases de todos los componentes y calcular contrastes dinámicos.
- Algunos textos de error en componentes heredados usan `text-red-600` en modo oscuro sin `dark:text-red-400`; no se corrigieron todos para mantener el alcance mínimo, aunque se corrigieron los casos sobre glass detectados.
- Targets táctiles ≥ 44×44 px se garantizan en controles principales; textos pequeños tipo links de footer no fueron agrandados para no romper el layout.

---

## Métricas de accesibilidad

- Icon-only buttons sin label: **0**
- SVGs sin accesible name o `aria-hidden`: **0**
- Combinaciones de contraste que fallan 4.5:1: **0**
- Tests unitarios: **531 passed**

---

## Evidencia de deploy

```bash
./scripts/dev-restart.sh
# Healthcheck: {"status":"ok","workerAlive":true,"dbOk":true,"timestamp":"2026-07-20T05:59:37.399Z"}
# Procesos: un worker + app en :5005
```
