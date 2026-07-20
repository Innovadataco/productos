# Quickstart: Validación de Accesibilidad (WCAG 2.2)

**Prerequisites**: Node.js >=22, `npm`, proyecto en rama `feature/001-scaffolding`.

---

## 1. Preparar el entorno

```bash
npm install
```

---

## 2. Verificar tipos y lint

```bash
npx tsc --noEmit
npm run lint
```

**Esperado**: 0 errores de TypeScript y 0 errores de lint.

---

## 3. Ejecutar tests

```bash
npm run test
```

**Esperado**: Todos los tests existentes pasan; no se introducen fallos.

---

## 4. Medir contraste

```bash
node scripts/contrast_check.js
```

**Esperado**: Ninguna combinación de texto/fondo usada falla el ratio (4.5:1 para texto normal, 3:1 para texto grande). El script lista los resultados de cada combinación.

---

## 5. Auditar botones e íconos

```bash
node scripts/a11y_audit.js
```

**Esperado**:
- `Icon buttons without label: 0`
- Los SVGs sin `aria-label`/`title` están en contextos con texto visible o marcados `aria-hidden="true"`.

---

## 6. Validación manual con teclado

1. Iniciar la aplicación:

```bash
npm run dev
```

2. Abrir `http://localhost:5005`.
3. Navegar con `Tab` y `Shift+Tab`.
4. Verificar:
   - Todos los enlaces, botones, campos y controles reciben foco visible.
   - `Enter` activa botones/enlaces.
   - `Space` activa botones.
   - `Escape` cierra el menú de usuario y cualquier panel desplegable.
   - El orden de foco es lógico y visual.

---

## 7. Validación de touch targets

1. Usar DevTools > Device Toolbar o inspeccionar elementos.
2. Verificar que botones de solo-ícono y controles principales tengan `min-width: 44px` y `min-height: 44px`.

---

## 8. Verificar build

```bash
rm -rf .next && npm run build
```

**Esperado**: Build exitoso sin errores.
