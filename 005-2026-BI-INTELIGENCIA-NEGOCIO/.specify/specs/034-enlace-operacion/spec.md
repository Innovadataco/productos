# SPEC-034 · Enlace a `/operacion` en la sidebar

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 034 |
| **Nombre** | enlace-operacion |
| **Origen** | BI · INSTRUCTIVO-019 · F3C 2026-08-30 17:1x COT · cierre A-55 |
| **Estado** | ⏳ spec+plan LISTO · pendiente REVISO |

---

## Objetivo

Cerrar A-55: agregar la entrada **"Operación"** a la barra lateral (`BiSideNav`), como **primera** de la lista, apuntando a `/operacion` (la vista del tablero, ya en `main` vía #173). Es la pantalla que Jelkin abre a diario.

## Excepción de alcance (BI congelado)

BI sigue congelado. Este SPEC descongela **una sola cosa**: la entrada nueva. NO se tocan las otras 4 entradas del menú (los 404 de `/dashboard/dashboards` y `/dashboard/configuracion` **siguen congelados**), ni el chat, ni el PR #168. `BiSideNav.tsx` es el mismo archivo donde viven los 404 congelados: se **inserta** la nueva entrada sin rozar las demás.

---

## Alcance

### Único archivo de código tocado

`src/components/bi/layout/BiSideNav.tsx` — al array `SECTIONS`, insertar **primero** (antes de "Home"):

```ts
{ label: "Operación", href: "/operacion", emoji: "🧭" },
```

- Las otras 4 entradas (Home, Dashboards, Chat NL→SQL, Configuración) **no se modifican**.
- El array no tiene campo de rol hoy; la entrada nueva es un `Link` plano igual que las demás (si algún ratchet exigiera guarda de rol, se agrega SOLO a la nueva con el mismo criterio; hoy no aplica).
- El destino `/operacion` existe en `main` (verificado: `src/app/operacion/page.tsx` presente tras #173) → NO crea un 404.

### Test

`tests/unit/bi-sidenav-operacion.test.*`:
- Afirma que existe una entrada con `href === "/operacion"` y `label === "Operación"`.
- Afirma que el destino es real: `src/app/operacion/page.tsx` existe (comprobación de FS).
- **NO** agrega una aserción "todos los ítems del menú resuelven" — esa es la del defecto congelado de los 404 y va aparte.

---

## Fuera de alcance

- Los 404 de `/dashboard/dashboards` y `/dashboard/configuracion` (congelados).
- El chat de 3 modelos, el PR #168, y cualquier otra ruta que no sea `BiSideNav.tsx`, `tests/` y la carpeta del spec.
- El orden o estilo de las otras entradas.

---

## Candados aplicables

| # | Candado | Aplicación |
|---|---|---|
| — | Congelamiento respetado | Solo la entrada nueva · las 4 restantes intactas |
| 25 | Evidencia pesa más que el código | PASO 5 · 2 capturas (sidebar con la entrada · click → aterriza en /operacion) |
| 14 | Verificación en vivo | `next build && next start` autenticado, no `next dev` |
| 17 | spec+plan commiteado antes de implementar | Aplicado |

---

## Riesgos

- **Auth de `/dashboard`:** la sidebar vive dentro del layout autenticado de `/dashboard`. `/operacion` NO está bajo `/dashboard` (es su propia ruta, sin el guard). La entrada es un `Link` que navega fuera del segment protegido — funciona igual (el usuario ya está autenticado para ver la sidebar). La captura §5 lo confirma en vivo.
- **Estado activo (`aria-current`):** el `BiSideNav` marca activo cuando `pathname === href`. Al estar en `/operacion`, la entrada nueva se marca activa; las demás no. Comportamiento correcto, heredado del componente.

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-30 17:1x COT |
| **Autor** | Dev BI-2 |
| **Aprobado por** | pendiente REVISO Fábrica BI-2 |
