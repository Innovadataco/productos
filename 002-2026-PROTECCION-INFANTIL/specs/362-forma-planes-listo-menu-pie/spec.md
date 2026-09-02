# SPEC-362 · A-70 tanda 2 · Forma y guía (G13–G17, G21) + I-256 + voseo

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-2 · **Origen**: brief A-70 y I-256 (Calidad, prod `1c47be7c`)

## Requisitos

- **FR-I256**: Tras el 201 del consentimiento, la pantalla DEBE navegar. Hoy se
  guardaba y el padre se quedaba mirando la misma página.
- **FR-G13**: La pantalla de planes no puede mostrar claves técnicas
  ("PADRE · MES_6 · 2026", "(precio placeholder)") ni tarjetas encimadas con
  texto en columnas de una palabra y botones cortados.
- **FR-G14**: La pantalla "Listo" explica cada opción en tarjetas, en vez de
  tres botones sueltos en una pantalla vacía.
- **FR-G15**: Señal animada que invite a bajar hasta habilitar el botón del
  consentimiento; se apaga sola al llegar y respeta `prefers-reduced-motion`.
- **FR-G16**: Durante el camino, el menú superior queda en gris sin acción;
  solo "cambiar contraseña" (y cerrar sesión) siguen vivos.
- **FR-G17**: Verde = activo · gris = inactivo. Nunca rojo (regla 2 del brief).
- **FR-G21**: Pie en TODAS las pantallas: "Desarrollado por Innovadataco · V1"
  más la versión del despliegue, actualizada sola en cada subida.
- **FR-I250**: Cero voseo ("Podés" → "Puedes").

## Impacto en arquitectura:

Un helper puro nuevo (`nombre-plan-humano.ts`) que decide en la presentación
cómo se llama un plan, para no depender de un UPDATE manual en producción. Un
componente de pie global en el layout raíz. Sin migraciones, sin endpoints, sin
cambios de contrato.
