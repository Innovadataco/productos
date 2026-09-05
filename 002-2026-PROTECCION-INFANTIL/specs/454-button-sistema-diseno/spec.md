# SPEC-454 · OLA 1 del rediseño — el Button al Sistema de Diseño

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-04 · **Dev**: PI-1 (`idc-32`) · **Origen**: plan maestro de Diseño (`SISTEMA-DE-DISENO/REDISENOS/PLAN-MAESTRO-REDISENO.md`), radicado por CEO. Autoridad de diseño: **Diseño** (certifica la forma; el CEO radica, CI no cierra un rediseño).

## Para qué

El `Button` es el mueble de más palanca del rediseño: **17 usos de color crudo × 166 pantallas**. Migrarlo una vez cambia casi todo el producto. Esta ola le cambia la **piel** (color por token, radio 16px, firma en el primario) sin tocar su **conducta** ni su **API**.

## Decisiones de gobierno aplicadas

- **API estable (decisión CEO)**: se conservan las 5 variantes (`primary`, `secondary`, `outline`, `ghost`, `danger`) porque están en uso en ~160 archivos; colapsarlas a 3 sería rework fuera de alcance. Cambia la piel, no la firma de tipos.
- **Mapeo a las 3 jerarquías del §7.1 (decisión de Diseño, Sistema §7.1 commit `aaa9d43`)**:
  - `primary` → **Primario** (el único sólido; lleva la firma).
  - `secondary`, `outline` → **Fantasma** (transparente + borde del acento).
  - `ghost` → **Sutil** (velo).
  - `danger` → **Fantasma-rubí** (borde rubí; el sólido rubí queda reservado al «confirmar» del modal, no se reparte por las 16 pantallas).
- **Radio = 16px fijo** (decisión de Diseño; el «12px» de §7.1 era error y el squircle 32% es solo tarjetas/contenedores).
- **Firma (gradiente + grano + órbita) SOLO en el Primario** (decisión de Diseño). Fantasma y Sutil son planos.
- **Acento leído de `--accent` con fallback pino**: SPEC-460 declarará `--accent` por rol en los 4 layouts; hasta entonces el Button sale en pino — estado intermedio honesto, no roto. **454 no toca los layouts** (decisión de alcance del CEO).

## Cambios

- **`src/app/globals.css`**: bloque nuevo `.btn-ds*` con la piel del Sistema de Diseño — base (alto 48px, radio 16px, curva del sistema), Primario (gradiente `--pi-accent`, grano `::after` con data-uri de ruido, órbita `::before` animada `pi-btn-orbita`), Fantasma, Fantasma-rubí, Sutil, estado disabled, y el apagado de la órbita/desplazamiento bajo `prefers-reduced-motion` y `hover: none` (§5). `--pi-accent: var(--accent, rgb(var(--pino-rgb)))`. Ningún color crudo (los `.css` no cuentan en `tokens:check`, pero igual todo sale de tokens).
- **`src/components/ui/Button.tsx`**: mapea las 5 variantes a `.btn-ds--*`. Se retiran los 17 crudos (`from-sky-700`, `to-cyan-600`, `bg-emerald-700`, `bg-red-700`, `bg-slate-300`, etc.). El spinner de `isLoading` gana `aria-hidden`. Conducta intacta.

## Candados

- **`src/components/ui/Button.test.tsx`** (nuevo, 18 tests unit):
  - **Conducta (9)**: renderiza `<button>`, dispara onClick, `disabled`/`isLoading` bloquean el click y ponen el atributo, las 5 variantes siguen aceptándose (API estable), reenvía props HTML, forwardRef expone el nodo, concatena className, foco por teclado. Escrito ANTES de la re-piel contra el Button viejo.
  - **Firma/jerarquías (2)**: mapeo variante→clase; solo el primario lleva firma y danger nunca es sólido rubí.
  - **Piel en globals.css (7, estructural)**: radio 16px, gradiente del acento, grano, órbita animada + keyframe, `prefers-reduced-motion` apaga la órbita, `--accent` con fallback, y la piel no introduce color crudo Tailwind.
  - **Verificado por mutación**: quitar la órbita del globals mata el candado correspondiente.
- **`scripts/tokens-check.ts`**: piso 1038 → **1021** (−17, la caída que exige el radicado). Medido sobre `origin/main` fresco.

## Impacto en arquitectura:

- El Button pasa de color crudo a token; es el primer mueble de la Ola 1. La piel vive en `globals.css` con clases `.btn-ds*`, patrón idéntico al del Guardián (keyframes + clase + `prefers-reduced-motion`).
- Introduce el consumo de `--accent` (con fallback) — el cableado por rol es **SPEC-460** (declara `--accent` en los 4 layouts y suelta el pino fijo de `tailwind.config.ts`).
- No cambia la API pública del componente: las 166 pantallas que lo usan no requieren cambios.

## Certificación (la da Diseño)

Diseño revisa el Button migrado —contra el código o tras desplegar— y certifica que cumple el Sistema de Diseño. Hasta esa certificación, la ola NO se marca cerrada en el inventario de pantallas. **Verde en CI no cierra un rediseño.**

## Excepción a marcar (no resolver a ojo)

Diseño pidió: si una pantalla usa `secondary` como su ÚNICA acción (sin `primary`), esa instancia debe subir a Primario. **No se resuelve en esta spec** — se reporta al CEO cuando aparezca en el barrido de pantallas y Diseño decide caso por caso.

## Después (orden de palanca)

Badge (24×79) → Alerta (16×74) → GlassCard/Modal (cablear firma). Cada uno su spec.

## Referencias

- **Sistema de Diseño** `SISTEMA-DE-DISENO.md` §7.1 (Botón) · §5 (movimiento) · §3 (color).
- **Plan maestro** `REDISENOS/PLAN-MAESTRO-REDISENO.md` §4 (contrato de cada mueble).
- **SPEC-460** — `--accent` por rol en los layouts (siguiente).
- Worktree `.worktrees/pi-SPEC-454` desde `origin/main f7c61ec5e`.
