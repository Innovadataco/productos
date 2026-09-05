# SPEC-477 · CanalesOficiales al Sistema de Diseño: neutro uniforme — últimos crudos visibles de la portada

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: certificación visual de Diseño sobre la portada en prod. Autoridad de forma: **Diseño** (certifica; post-merge).

## Para qué

`CanalesOficiales` (en la portada vía `HomePageClient`) pintaba cada canal de un color crudo distinto — sky (141/ICBF), emerald (CAI/Policía), amber (Te Protejo). **Ruling de Diseño: NEUTRO uniforme.** Los tokens significan; darle a cada canal un token distinto mentiría sobre su jerarquía — son de igual peso y se diferencian por número, nombre e ícono, no por color.

## Cambios (`src/components/modules/CanalesOficiales.tsx`)

- Eliminados los 3 `tone` crudos por canal (sky, emerald, amber = 12 clases crudas).
- Tarjeta: `bg-white/40 dark:bg-slate-900/40` + hover slate → **wash de token neutro** `bg-tinta/5` + `hover:bg-tinta/10`, radio `--radio-card`. Fuera el slate/white.
- Círculo del ícono: color por canal → **`bg-tinta/10 text-muted`** uniforme (mismo tratamiento que el ícono neutro de EmptyState, SPEC-471).
- Subtítulo del canal: `text-subtle` → `text-muted`.
- Diferenciación **solo por número/nombre/ícono** (ya estaba). Default neutro liso; el «marcador pino único» que mencionó Diseño NO entra (opcional, aparte).
- Conducta intacta: los enlaces a los canales (`tel:141`, CAI Virtual, Te Protejo) y su `target`/`rel` sin cambio.

## Candado

- **`src/lib/rediseno/canales-oficiales-neutro.candado.test.ts`** (fuente, sin BD): (1) cero color crudo Tailwind en el archivo; (2) uniformidad — ningún canal lleva color propio (`sin `tone`` ni interpolación de color por canal). **Verificado por mutación**: reintroducir un `tone` crudo por canal → rojo.

## Impacto en arquitectura: no

Migración de color de un componente de portada a token + neutralización de jerarquía falsa. No toca `tokens-check.ts` (baja crudos; con SPEC-466 `<=` el conteo cae bajo el piso). Sin schema, sin API, sin runtime, sin cambio de enlaces.

## Certificación (la da Diseño)

Diseño certifica la forma contra prod. Hasta su ✅ no cierra en el inventario. Verde en CI no cierra un rediseño.

## Referencias

- Ruling de Diseño: neutro uniforme (canales de igual peso).
- SPEC-471 EmptyState — precedente del ícono neutro (`bg-tinta/5 text-muted`).
- [[dev-nav-3-estados-y-texto-2]] · Sistema de Diseño §3 (color).
