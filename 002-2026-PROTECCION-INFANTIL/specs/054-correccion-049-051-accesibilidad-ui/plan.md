# Plan: Corrección post-cierre 049 y 051 — Accesibilidad y UI

## Constitution Check

- **Texto plano**: sí, todos los artefactos son texto plano.
- **IA local**: no se requieren terceros; el plan se ejecuta con herramientas locales.
- **Lenguaje sin veredictos**: el plan describe comportamientos, no emite juicios.
- **Migraciones aditivas**: no se tocan migraciones ni datos.
- **Un solo worker**: aplica solo al deploy; no cambia código de worker.
- **Cobertura Vitest**: se agregarán tests para Modal, Tooltip y auditoría de contraste.

*Constitution Check pasado.*

---

## Technical Context

- **Framework**: Next.js 16 + React 19 + Tailwind CSS + TypeScript.
- **Modales actuales**: 3 overlays manuales en `src/components/modules/AdminReporteDetalle.tsx`, `ComiteSolicitudDetalle.tsx` y `SpamRevisionPanel.tsx`.
- **Botones de solo ícono**: 3 casos encontrados (`ThemeToggle`, `NavHeader` menú móvil, `CategoriaGruposEditor` quitar categoría). Se necesita un componente `Tooltip` reusable.
- **Contraste dark mode**: fallos en `Button` disabled, `AdminReporteDetalle` texto de carga, `Sparkline` ejes/área, `RiskBadge` puntos en modo claro.
- **Navegación por teclado**: requiere auditar `div[onClick]`, estandarizar `focus-visible` y verificar orden de tabulación.

---

## Complexity Tracking

| Área | Complejidad | Riesgo | Notas |
|---|---|---|---|
| Modal reusable | Media | Bajo | Requiere focus trap y focus restoration; hay bibliotecas probadas o implementación con refs. |
| Reemplazo de modales | Baja | Bajo | Solo 3 modales centrados; el resto son dropdowns. |
| Tooltip + aria-label | Baja | Bajo | Pocos botones de ícono; crear `Tooltip` reusable. |
| Navegación por teclado | Media | Medio | Puede requerir convertir muchos `div[onClick]` a `<button>` y revisar orden visual. |
| Contraste dark mode | Baja | Bajo | Cambios de clases Tailwind; medir con scripts. |
| Auditoría de contraste | Baja | Bajo | Extender `scripts/contrast_check.js` a dark mode y disabled. |

---

## Decisiones de diseño propuestas

1. **Modal**: crear `src/components/ui/Modal.tsx` con:
   - Props: `isOpen`, `onClose`, `title`, `children`, `size?`, `showCloseButton?`.
   - Uso de `React.useRef` para contenedor, `useEffect` para Escape, focus trap con `Tab`/`Shift+Tab`, y `focus()` en primer input o botón de cierre.
   - Renderizar con `createPortal` si es posible; si no, montar directamente en el componente padre.

2. **Tooltip**: crear `src/components/ui/Tooltip.tsx` con:
   - Wrapper que muestra el tooltip en hover y focus.
   - Usar `title` nativo como respaldo mínimo, o implementar tooltip accesible con `aria-describedby`.

3. **Navegación por teclado**: 
   - Auditar `div[onClick]` en vistas principales y convertir a `<button>` donde aplique.
   - Estandarizar `focus-visible` con anillo de foco en `globals.css` para todos los elementos interactivos.
   - Verificar orden visual vs orden DOM.

4. **Contraste dark mode**:
   - `Button` disabled: crear variante explícita con fondos oscuros y texto sin opacidad reducida, o ajustar `disabled:opacity-70` combinado con fondos más oscuros.
   - `AdminReporteDetalle`: reemplazar `text-slate-600` por `text-muted`.
   - `Sparkline`: cambiar `fill-slate-400 dark:fill-slate-500` a `dark:fill-slate-300`.
   - `RiskBadge`: agregar borde o cambiar colores `BAJO`/`MEDIO` en modo claro para ≥ 3:1.

---

## Riesgos y mitigaciones

- **Riesgo**: El focus trap podría romper el tab order si se usa mal. **Mitigación**: test unitario para `Modal.tsx` que simule Tab y Escape.
- **Riesgo**: Cambios de color afectan percepción visual. **Mitigación**: mantener paleta existente, solo ajustar tonos; medir con script antes y después.
- **Riesgo**: Algunos `div[onClick]` son complejos de convertir a `<button>` por estilos. **Mitigación**: usar `role="button"` + `tabIndex={0}` + manejadores de teclado como solución mínima, o refactorizar CSS del contenedor.

---

## Approach

1. Implementar `Modal.tsx` y `Tooltip.tsx` con tests.
2. Reemplazar los 3 modales manuales por `Modal.tsx`.
3. Agregar `Tooltip` a los botones de solo ícono y auditar `aria-label`.
4. Auditar y corregir navegación por teclado.
5. Corregir colores de contraste en dark mode y RiskBadge en modo claro.
6. Extender scripts de auditoría.
7. Ejecutar validación completa y cerrar el spec.

