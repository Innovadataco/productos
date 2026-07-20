# Quickstart: Corrección post-cierre 049 y 051 — Accesibilidad y UI

*(Se ejecutará tras la aprobación humana del plan e implementación del spec.)*

## Requisitos previos

- Aplicación corriendo en `:5005` con `./scripts/dev-restart.sh`.
- Tema oscuro activado (usar toggle de tema o `prefers-color-scheme: dark`).
- Navegador con herramientas de desarrollo (DevTools) y extensión axe/Lighthouse si está disponible.

## 1. Modal reusable

1. Abrir `/dashboard/admin/ia` → Centro de Control IA → Revisión de spam.
2. Hacer clic en “Revisar” de una fila.
3. Verificar que el modal se abre.
4. Cerrar con:
   - Botón “Cerrar” visible.
   - Tecla `Escape`.
   - Clic en el fondo oscuro fuera del panel.
5. Repetir en `/dashboard/admin` (detalle de reporte) y `/dashboard/admin/comite` (detalle de solicitud).
6. Con el modal abierto, presionar `Tab` varias veces; verificar que el foco no sale del modal.

## 2. Botones de ícono y navegación por teclado

1. En cualquier vista del dashboard, pasar el mouse o foco sobre:
   - Toggle de tema (header).
   - Botón de menú móvil (header).
   - Botón “×” para quitar categoría en Configuración → Categorías.
2. Verificar que aparece un tooltip con la función.
3. Navegar la página con `Tab`.
4. Verificar que:
   - Todos los elementos interactivos reciben foco.
   - El foco es visible (anillo de foco).
   - El orden de tabulación es lógico (de arriba hacia abajo, de izquierda a derecha).

## 3. Contraste en dark mode

1. Activar tema oscuro.
2. Navegar a:
   - `/dashboard/admin` (botones disabled, badges, gráficos).
   - `/dashboard/admin/operadores/asignar` (botones disabled).
   - `/dashboard/admin/comite` (detalle de solicitud, texto de carga).
3. Ejecutar `npm run a11y:contrast` (si se implementa) o Lighthouse/axe.
4. Verificar 0 fallos de contraste en dark mode.
5. Repetir en modo claro para confirmar que no se introdujeron regresiones.

## 4. Scripts de auditoría

```bash
npm run a11y:audit      # botones de ícono, div[onClick], foco visible
npm run a11y:contrast   # contraste en claro y oscuro
```

## 5. Tests

```bash
npx vitest run src/components/ui/Modal.test.tsx
npx vitest run src/components/ui/Tooltip.test.tsx
npm run test
```

## 6. Validación final

```bash
npx tsc --noEmit
npm run lint
npm run build
./scripts/dev-restart.sh
```

