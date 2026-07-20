# Research: Corrección post-cierre 049 y 051 — Accesibilidad y UI

**Date**: 2026-07-20
**Feature**: `specs/054-correccion-049-051-accesibilidad-ui/spec.md`

---

## Contexto

Durante una validación en vivo se detectaron fallos en las specs 049 (Accesibilidad WCAG 2.2) y 051 (Claridad y estados) ya cerradas:

1. **Modales del área admin/operador/comité** se arman manualmente, no cierran con Escape ni clic en overlay, y no tienen focus trap.
2. **Botones de solo ícono** y **navegación por teclado** quedaron parciales en el spec 049.
3. **Contraste en dark mode** no fue medido/corregido en el spec 051; hay pares que fallan WCAG 2.2.

Este spec documenta el plan de corrección. No se implementa código hasta aprobación humana.

---

## 1. Modales / dialogs (hallazgo de exploración)

### Estado actual
No existe un componente `Modal`/`Dialog` reutilizable en `src/components/ui/`. Todos los modales encontrados se arman manualmente con `fixed inset-0 z-50 flex items-center justify-center bg-black/50`.

### Modales centrados reales

| Modal | Archivo / línea | Cierre visible | Escape | Clic fondo | Focus trap | Bloqueante |
|---|---|---|---|---|---|---|
| Detalle de reporte | `src/components/modules/AdminReporteDetalle.tsx:90` | Sí (línea 13 del sub-componente `ReporteDetalleHeader`) | No | No | No | No |
| Detalle de solicitud del comité | `src/components/modules/ComiteSolicitudDetalle.tsx:123` | Sí (línea 127) | No | No | No | No |
| Revisión de spam | `src/components/modules/SpamRevisionPanel.tsx:182` | Sí (línea 186) | No | No | No | No |

### Problemas identificados

- Ninguno implementa `role="dialog"`, `aria-modal="true"`, cierre con Escape, cierre en clic de overlay, ni focus trap.
- El modal de spam reutiliza `AdminReporteDetalle` dentro de sí (`SpamRevisionPanel.tsx:191`), apilando dos overlays `z-50`.
- La descripción del usuario (“obliga a refrescar”) parece haber ocurrido en una build previa o en un estado de apertura doble; en código existe un botón Cerrar, pero la falta de Escape/overlay/focus degradea la UX y accesibilidad.

### Candidatos a reemplazar por Modal reusable

1. `src/components/modules/AdminReporteDetalle.tsx` (overlay de detalle).
2. `src/components/modules/ComiteSolicitudDetalle.tsx` (overlay de solicitud del comité).
3. `src/components/modules/SpamRevisionPanel.tsx` (overlay de revisión de spam).

### Otros overlays no modales centrados

| Overlay | Archivo | Comportamiento |
|---|---|---|
| Menú de usuario | `NavHeader.tsx:102` | Dropdown con Escape y clic fuera; no requiere Modal. |
| Menú mobile | `NavHeader.tsx:180` | Panel desplegable; no requiere Modal. |

---

## 2. Botones de solo ícono y navegación por teclado

### Componentes UI estándar actuales

- `src/components/ui/Button.tsx`: botón base, sin `IconButton` ni `Tooltip`.
- No existe `Tooltip`/`IconButton` reutilizable en `src/components/ui/`.

### Botones de solo ícono encontrados en admin/operador/comité

| # | Archivo | Línea | Ícono | `aria-label` | `title` | Estado |
|---|---|---|---|---|---|---|
| 1 | `src/components/ui/ThemeToggle.tsx` | 9–20 | Sol/Luna | Sí | No | Sí, alterna tema |
| 2 | `src/components/modules/NavHeader.tsx` | 170–176 | X/Menu | Sí | No | Sí, alterna menú |
| 3 | `src/components/modules/CategoriaGruposEditor.tsx` | 248–255 | Cruz Unicode | Sí | No | No |

### Observación

Los demás botones de las vistas admin/operador/comité tienen texto visible. El 049 anterior solo tocó ~11 archivos; la exploración indica que la cobertura real de botones de solo ícono es menor de lo esperado, pero falta:

- `title` como tooltip complementario en los 3 casos encontrados.
- Componente `Tooltip` reusable para futuros botones de ícono.
- Foco visible y orden lógico de tabulación en vistas principales: se reporta que Tab no funciona correctamente, lo que apunta a:
  - Elementos no focusables (divs con onClick sin tabindex/role).
  - Orden visual ≠ orden DOM.
  - Foco invisible por falta de estilos `:focus-visible` consistentes.
  - Posible pérdida de foco al abrir modales por falta de focus trap.

### Candidatos a revisar para foco/tab

- Tablas de `AdminReportesTable`, `ComiteBandeja`, `SpamRevisionPanel` (filas con botones de acción).
- Formularios de `reportar/page.tsx`, `consulta/page.tsx`, `seguimiento/page.tsx`.
- Navegación lateral/subnav de admin, operador y comité.
- Cards de `AdminDashboard`, `AdminOperadoresAsignarPage`.

### Decisión de diseño propuesta

- No crear un `IconButton` nuevo si `Button` ya cubre los casos; en su lugar, envolver los botones de ícono existentes con un `Tooltip` reusable y asegurar `aria-label`.
- Auditar `div[onClick]` sin `role`/`tabIndex` y convertirlos a `<button>` o agregar `tabIndex={0}` + `role="button"` + manejadores de teclado.
- Estandarizar `focus-visible` en globals.css para que el foco sea visible en todos los elementos interactivos.

---

## 3. Contraste en dark mode

### Definición del tema

- `tailwind.config.ts:4` → `darkMode: "class"`.
- `src/app/globals.css` define fondos, texto y superficies glass para `.dark`.
- `src/components/providers/ThemeProvider.tsx` gestiona la clase `dark` en `<html>`.

### Componentes afectados

#### `src/components/ui/Button.tsx` (disabled)

| Variante | Clases | Par en dark | Contraste | Estado |
|---|---|---|---|---|
| `primary` disabled | `bg-sky-700 text-white disabled:opacity-50` | blanco 50% sobre azul 50% sobre `#020617` | ~4.23:1 | **Falla 4.5:1** |
| `secondary` disabled | `bg-emerald-700 text-white disabled:opacity-50` | blanco 50% sobre verde 50% | ~4.16:1 | **Falla 4.5:1** |
| `danger` disabled | `bg-red-700 text-white disabled:opacity-50` | blanco 50% sobre rojo 50% | ~4.28:1 | **Falla 4.5:1** |

#### `src/components/modules/AdminReporteDetalle.tsx`

| Uso | Clases | Par en dark | Contraste | Estado |
|---|---|---|---|---|
| Texto de carga | `text-slate-600` (sin `dark:`) | `#475569` sobre `#020617` | 2.66:1 | **Falla 4.5:1** |

#### `src/components/modules/Sparkline.tsx`

| Uso | Clases | Par en dark | Contraste | Estado |
|---|---|---|---|---|
| Área del gráfico | `fill-slate-400 dark:fill-slate-500` | `#64748b` sobre `glassDark`/`#020617` | 3.98–4.24:1 | **Falla 4.5:1** |
| Eje X | `fill-slate-500 text-[9px]` (sin `dark:`) | `#64748b` sobre `glassDark`/`#020617` | 3.98–4.24:1 | **Falla 4.5:1** |

#### `src/components/modules/RiskBadge.tsx` (modo claro, no dark)

| Puntos | Clases | Contraste | Umbral | Estado |
|---|---|---|---|---|
| `BAJO` | `bg-emerald-500` | 2.42:1 | 3:1 (no textual) | **Falla** |
| `MEDIO` | `bg-amber-500` | 2.05:1 | 3:1 (no textual) | **Falla** |

### Scripts de auditoría existentes

- `scripts/contrast_check.js`: mapa estático de colores; actualmente reporta 0 fallos porque no revisa opacidad `disabled` ni textos fijos sin `dark:`.
- `scripts/a11y_audit.js`: solo verifica `aria-label` en icon-only buttons, no contraste.

### Decisiones de diseño propuestas

1. **Botones disabled**: cambiar de `disabled:opacity-50` a colores sólidos de fondo más oscuros y texto sin opacidad reducida, o usar una variante `disabled` explícita con colores que pasen 4.5:1.
2. **Textos fijos sin `dark:`**: reemplazar `text-slate-600` por `text-muted` o `dark:text-slate-400`.
3. **Sparkline**: usar `dark:fill-slate-300` para ejes/área.
4. **RiskBadge en modo claro**: agregar borde o cambiar colores de los puntos `BAJO`/`MEDIO` para alcanzar 3:1, o combinar con texto/icono adicional.

---

## 4. Decisiones generales

- **No reabrir 049 ni 051**: se crea el spec 054 como corrección post-cierre.
- **Alcance acotado**: solo UI/accessibilidad; no toca lógica de negocio, SPEC-050, SPEC-060 ni datos.
- **Validación**: medir con scripts de auditoría actualizados + Lighthouse/axe en dark mode + prueba manual de cierre de modales.
