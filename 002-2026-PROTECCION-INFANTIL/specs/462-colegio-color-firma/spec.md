# SPEC-462 · Lote 2 — Colegio: color y firma

> **Rework (main post-Ola-1).** Reconstruido sobre `origin/main` con el lote OLA-1 dentro. **No edita `scripts/tokens-check.ts`** (regla SPEC-466 `<=`: baja crudos y el conteo cae bajo el piso 1021). Añade el fallo de forma de Diseño sobre el nav: el acento `pino` se reserva al ítem ACTIVO; el inactivo va neutro secundario (`text-muted`). Menciones a «piso intacto (1021)» de abajo son históricas.

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: Infra (idc-c0) · **Origen**: RADICADO-SPEC-462 · `REDISENOS/LOTE-2-COLEGIO.md` · **autoridad de forma: Diseño certifica**

## Alcance

**SOLO color y firma.** La VOZ del rector (tú/usted) NO entra — está en pausa esperando decisión de Jelkin (radicado §Fuera de alcance).

## Qué trae

### 1) `ColegioSideNav.tsx` — 28 crudos `emerald` → `pino`

El menú lateral es el marco de **todas** las pantallas del colegio. Migrado a token `pino` (deuda D-74, emerald≈pino al ojo → riesgo visual ~cero):
- Marco/bordes: `border-emerald-200/40 bg-emerald-50/50 dark:…` → `border-pino/20 bg-pino/5` (el token resuelve claro/dark solo — mueren los `dark:` duplicados).
- Item activo: `bg-emerald-600 text-white shadow-emerald-500/25` → `bg-pino text-white shadow-pino/25`.
- Item inactivo: `text-emerald-900/70 hover:bg-emerald-100 … dark:…` → `text-pino/70 hover:bg-pino/10 hover:text-pino`.
- Aplica a los dos bloques (item plano + hijo de grupo expandible + botón del grupo).

### 2) 🔴 El rojo de alarma sobre un estudiante — el peor lugar

`AlertasColegioPageClient.tsx`:
- **Bloque de error del sistema** (`bg-red-50 …`) → `bg-rubi/10 text-estado-rubi`. Error real → `rubi`.
- **Franja de prioridad de la alerta** (`border-l-red-500` alta / `border-l-amber-500` media / `border-l-emerald-500` baja): alta y media → `border-l-ambar`, baja → `border-l-pino`. **La franja roja de alarma sobre un estudiante muere** (radicado §2: «nunca rojo donde más importa»).
  - **Decisión de forma para Diseño**: alta y media quedan ambas en `ambar` en la franja. La distinción alta/media **no se pierde**: el `Badge` de prioridad ya la lleva (`PRIORIDAD_VARIANTS: alta→danger, media→warning, baja→success`, migrado por Badge/457). Si Diseño quiere la franja de alta distinta (p. ej. `ambar` más intenso o un tratamiento propio), se ajusta — queda marcado explícito, no asumido.
- Firma: spinner `border-emerald-600` → `border-pino`; checkboxes `accent-emerald-600` → `accent-pino`.

### 3) Resto del territorio (cursos / estadísticas)

Bloques de error genéricos a token (los otros 2 rojos del radicado §2):
- `CursosPageClient.tsx`: ternario error/success → `bg-rubi/10 text-estado-rubi` / `bg-pino/10 text-estado-pino`.
- `ColegioEstadisticasPageClient.tsx`: bloque error → `bg-rubi/10 text-estado-rubi`.

### 4) `tokens-check.ts` — piso intacto (1021)Los ~47 crudos migrados salen (28 SideNav + rojos/firma de alertas + error-blocks). Medido sobre `origin/main` fresco.

## Candados

- `tokens:check` **baja** (piso intacto 1021), verificado sobre `origin/main` fresco.
- **Cero rojo de alarma** en `AlertasColegioPageClient` (barrido: 0 `red-` en el área colegio productiva).
- **Sin cambio de conducta**: el SideNav conserva navegación y estados; solo cambia la familia de color. Las alertas conservan su lógica de prioridad (la señal vive ahora en el Badge, no en la franja roja).
- El candado de `CursosPageClient.test.tsx` (SPEC-377: «cero red-» en toda la pantalla) sigue **verde** — la migración lo respeta.
- **Autoridad de forma: Diseño certifica.** Draft hasta su ✅.

## Impacto en arquitectura: no

Migración de color en un componente de navegación y tres pantallas, más el fix de forma del nav (acento pino reservado al ítem activo). Sin schema, sin API, sin runtime, sin cambio de rutas.

## Cómo se probó

- `tokens:check` conteo < piso 1021, VERDE.
- `CursosPageClient.test.tsx` 3/3 (incluye el candado «cero red-»).
- `npx tsc --noEmit` limpio · `eslint` de los 5 archivos: 0.
- Barrido: 0 `red-/emerald-/rose-` productivos en `src/app/dashboard/colegio` y `src/components/modules/colegio` (SideNav 0, AlertasColegio 0).

## Pendiente

- **Certificación de Diseño** (✅). En particular la franja alta=media=ambar (ver §2) — que Diseño confirme o pida distinguirlas.
- La **voz** del rector (tú/usted) queda fuera, en pausa por decisión de Jelkin.
