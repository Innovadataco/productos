# SPEC-461 · OLA 1: el estado «Cargando» al Sistema de Diseño (el mueble de más alcance)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-04 · **Dev**: Dev 02 (`idc-63`) · **Origen**: plan maestro · catálogo §6 · orden de Jelkin (rediseño a tope) · **Autoridad de forma**: Diseño (certifica; nada cierra sin su ✅)

**Impacto en arquitectura:** ninguno. `Cargando` es el mueble de más ALCANCE (4 crudos × 110 pantallas). Cambia la piel y el patrón visual (spinner → skeleton), no la conducta ni la API.

---

## Qué se hizo

`src/components/ui/Cargando.tsx`: de **spinner** (`border-slate-200` girando, ×4 crudos) a **skeleton que pulsa** (`animate-pulse`), color por token (`tinta` velada). Regla dura del catálogo §6: **skeleton, NUNCA spinner infinito** — un cargando que no termina es peor que un error honesto; un skeleton comunica «esto es contenido que está llegando», no «esto gira sin fin».

- **API intacta:** `texto`, `inline`, `tamano`, `className` — los 110 callsites siguen igual.
- **Conducta intacta:** se monta mientras carga, el llamador lo desmonta al resolver.
- **A11y intacta:** `role="status"` + `aria-live="polite"`; el placeholder es `aria-hidden`; el texto sigue siendo ocultable.
- Centrado: barras skeleton apiladas (preservan el layout). Inline: una barra corta + texto.

## Candados

- `tokens:check`: piso **1014 → 1010** (4 crudos menos). Medido sobre `origin/main` fresco.
- `cargando-skeleton.candado.test.ts` (fuente, sin BD): pulsa (`animate-pulse`) y NO gira (`animate-spin` prohibido); 0 color crudo; conserva `role="status"`/`aria-live`. Contraprueba por mutación (spinner de vuelta → rojo; crudo de vuelta → rojo).
- `Cargando.test.tsx` (conducta/a11y) sigue verde: role status, texto por defecto/personalizado/oculto, inline SPAN.

## Certificación (la da DISEÑO)

Diseño certifica la forma. Hasta su ✅, no cierra. Circuito: Dev → CEO → Diseño → CEO → Dev.
