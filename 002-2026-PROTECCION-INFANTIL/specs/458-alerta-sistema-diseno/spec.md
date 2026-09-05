# SPEC-458 · OLA 1 — la Alerta al Sistema de Diseño

**Status**: DESARROLLO
**Fecha**: 2026-09-04 · **Dev**: Infra (idc-c0) · **Origen**: RADICADO-SPEC-458 · catálogo de muebles §3 · **autoridad de forma: Diseño certifica**

## Para qué

`Alerta.tsx` tenía **16 colores crudos** de Tailwind (`bg-red-50 text-red-700 dark:… ` × 4 tonos) y es el aviso de **74 pantallas**. El rediseño (catálogo §3) pide color **por función** en tokens del sistema, con el rojo (`rubi`) reservado a criticidad real.

## Qué trae

### 1) `Alerta.tsx` — color por función en tokens

| tono | antes (crudo) | ahora (token) |
|---|---|---|
| error | `bg-red-50 text-red-700` + dark | `bg-rubi/10 text-estado-rubi` |
| exito | `bg-emerald-50 text-emerald-700` + dark | `bg-pino/10 text-estado-pino` |
| advertencia | `bg-amber-50 text-amber-800` + dark | `bg-ambar/10 text-estado-ambar` |
| info | `bg-sky-50 text-sky-700` + dark | `bg-cielo/10 text-estado-cielo` |

- **Fondo** = token base con alpha (`/10`); el dark lo resuelve la propia variable RGB del token — **sin `dark:` duplicado**, que es lo que mata los 16 crudos.
- **Texto** = variante de estado AA vía `.text-estado-*` (usa las variantes `-ink`; ver §2).
- **Icono a la izquierda** por función (check / triángulo / círculo-!), `currentColor` hereda el color del estado. Ocultable con `sinIcono` para usos densos.
- **API intacta**: mismos 4 tonos, mismos props (`tono`, `children`, `className`, `role`) + `sinIcono` opcional. **Sin cambio de conducta** — los 109 callsites siguen compilando sin tocarse.

### 2) `globals.css` — `.text-estado-cielo` (único toque compartido)

Los `.text-estado-{pino,ambar,rubi}` ya existían para texto de estado con contraste AA; **faltaba el de info**. Se añade `.text-estado-cielo` con `--cielo-700-rgb` (#2c5f99 claro / #9cc9f5 dark), la variante que el catálogo §4.2 reserva para texto/botón. Es aditivo y sigue el patrón exacto de los otros tres. Motivo: el token base `cielo` (#5aa2ea) da ~2.4:1 como texto y falla AA; `info` se usa en callsites reales, así que necesita su variante legible.

### 3) `Alerta.test.tsx` — el candado se mueve al token

El test viejo exigía `bg-red-50` (color crudo). Ahora exige los tokens nuevos + contraprueba en las dos direcciones: el `rubi` es **solo** para error; info/éxito/atención **nunca** usan `rubi`; ningún tono deja crudo `red-/emerald-/amber-/sky-`. Más el candado del icono.

### 4) `tokens-check.ts` — piso 1038 → 1022

Ratchet: los 16 crudos salen, el piso baja con el arreglo (medido sobre `origin/main` fresco, no sobre la rama pre-rebase).

## Candados

- **`tokens:check` baja** (1038 → 1022), verificado sobre `origin/main` fresco.
- **Conducta por color**: alerta de info NO usa rojo; crítica sí `rubi`. Contraprueba en las dos direcciones en el test.
- **Barrido**: 0 crudos en `Alerta.tsx` tras migrar (`grep -cE '(bg|text|border)-(red|emerald|amber|sky|green|slate)-[0-9]'` = 0).
- **Sin cambio de conducta**: API y tonos idénticos; los 109 callsites no se tocan.
- **Autoridad de forma**: Diseño certifica. Hasta su ✅ no se marca cerrado.

## Impacto en arquitectura: no

Un componente UI migrado, una clase utility nueva en `globals.css`, un test y el piso del ratchet. Sin schema, sin API, sin runtime.

## Cómo se probó

- `Alerta.test.tsx` — 6 tests verdes (tokens por tono, rubi solo error, cero crudos, icono, role status).
- `npm run tokens:check` — 1022 ≤ 1022, VERDE.
- `npx tsc --noEmit` — limpio. `npx eslint Alerta.tsx Alerta.test.tsx` — 0.
- Barrido de crudos en `Alerta.tsx` = 0.

## Pendiente

- **Certificación de Diseño** (✅) sobre la forma. No le escribo directo (circuito).
- Verificación visual del icono + contraste en las 74 pantallas — la hace Diseño/Calidad; el componente lo habilita.
