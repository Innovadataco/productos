# Data Model: Corrección post-cierre 049 y 051 — Accesibilidad y UI

Este spec no modifica el modelo de datos de Prisma. Todos los cambios son en componentes de UI, estilos y scripts de auditoría.

## Componentes y archivos afectados

### Nuevos componentes UI

| Componente | Ruta | Responsabilidad |
|---|---|---|
| `Modal` | `src/components/ui/Modal.tsx` | Dialog reutilizable con Escape, overlay, focus trap y focus restoration. |
| `Tooltip` | `src/components/ui/Tooltip.tsx` | Tooltip accesible para botones de solo ícono. |

### Modales a reemplazar

| Modal actual | Ruta | Reemplazo |
|---|---|---|
| Detalle de reporte | `src/components/modules/AdminReporteDetalle.tsx` | Usar `Modal`. |
| Detalle de solicitud del comité | `src/components/modules/ComiteSolicitudDetalle.tsx` | Usar `Modal`. |
| Revisión de spam | `src/components/modules/SpamRevisionPanel.tsx` | Usar `Modal`; resolver apilamiento con `AdminReporteDetalle`. |

### Botones de solo ícono a revisar

| Archivo | Línea | Acción |
|---|---|---|
| `src/components/ui/ThemeToggle.tsx` | 9–20 | Agregar `Tooltip` (ya tiene `aria-label`). |
| `src/components/modules/NavHeader.tsx` | 170–176 | Agregar `Tooltip` (ya tiene `aria-label`). |
| `src/components/modules/CategoriaGruposEditor.tsx` | 248–255 | Agregar `Tooltip` (ya tiene `aria-label`). |

### Contraste dark mode

| Componente | Ruta | Cambio |
|---|---|---|
| `Button` disabled | `src/components/ui/Button.tsx` | Nueva variante o ajuste de opacidad/fondo para ≥ 4.5:1. |
| Texto de carga | `src/components/modules/AdminReporteDetalle.tsx` | Usar `text-muted` o `dark:text-slate-400`. |
| Sparkline | `src/components/modules/Sparkline.tsx` | `dark:fill-slate-300` para ejes/área. |
| RiskBadge puntos | `src/components/modules/RiskBadge.tsx` | Borde o color alternativo para `BAJO`/`MEDIO` en claro ≥ 3:1. |

### Scripts de auditoría

| Script | Ruta | Cambio |
|---|---|---|
| `contrast_check.js` | `scripts/contrast_check.js` | Medir dark mode, botones disabled, textos fijos sin `dark:`. |
| `a11y_audit.js` | `scripts/a11y_audit.js` | Verificar foco visible, `div[onClick]`, orden de tabulación. |

## Sin cambios de schema

- `prisma/schema.prisma` no se modifica.
- No se crean migraciones.
- No se tocan datos de usuario.
