# Plan · SPEC-792 · Las cuatro costuras del recorrido

Parches de secuencia/cierre sobre el código de 784. Copy verbatim de Diseño (`3d45701`).

## Implementación
- **C2** (`vista-espera-cita.ts`): la vista de CONFIRMADA-pasada deja de ofrecer `pedirOtraCita` (era el
  escape); queda `escribenos`. La tarjeta de la encuesta (784, arriba) es el primer camino.
- **C1+C3** (`EncuestaFormulario.tsx`): el cierre del «sí»/profesional gana «Volver a mi panel» (C1) y el
  padre-sí gana la voz cálida (C3); el profesional se queda con «quedó registrado».
- **C4** (`enlace-derivado.ts` + `vista-espera-cita.ts` + `EsperaCitaPanel.tsx`): nuevo sub-estado
  `PASADA_SIN_PUBLICAR` (enlace nunca publicado al pasar la hora); la vista produce el copy «no dependió
  de ti» con pago heredado (`heredarDeCitaId`); `AccionFranjaPasada` usa `?heredarDe=` cuando aplica.

## Candados
`espera-cita-encuesta-primero.candado.test.tsx` (C2, render), `encuesta-cierre.candado.test.tsx` (C1/C3,
render), `vista-espera-cita.candado.test.ts` (C2/C4, puro), `enlace-derivado.candado.test.ts` (C4 estado).
Registrados en el manifiesto unit.

## Co-cambios (hallazgo)
Los candados de 750 que asumían el comportamiento viejo (CONFIRMADA-pasada con [Pedir otra cita]; enlace
→ PASADA sin distinguir publicación) se actualizan al contrato nuevo, preservando su invariante original.

## Verificación
`tsc` · `lint` (1 warning de complejidad preexistente en `EsperaCitaPanel`) · candados · `arch:check` ·
`specs-discipline`. Recorrido caminado: post-deploy (Calidad), no hay deploy hoy.
