# Plan · SPEC-458 · Alerta al sistema de diseño

**Status**: DESARROLLO
**Fecha**: 2026-09-04 · **Dev**: Infra (idc-c0)

## Decisiones

**Fondo con alpha del token, no una variante `-50` nueva.** El patrón ya usado en el producto (`AdminAntiAbusoSimulacion.tsx`: `bg-rubi/10 text-rubi`) es `bg-{token}/10`. El dark lo resuelve la variable RGB del token, así que NO hace falta `dark:` — y eso es exactamente lo que elimina los 16 crudos (4 tonos × bg+text × claro+dark).

**Texto con `.text-estado-*`, no `text-{token}` plano.** El catálogo §4.2 es explícito: `ambar` (#a9700c) da 3.69:1 como texto y falla AA; por eso existe `ambar-ink` (5.11:1). Las clases `.text-estado-{pino,ambar,rubi}` ya cablean las variantes `-ink`. Uso esas para que el texto cumpla contraste.

**`.text-estado-cielo` nuevo, reusando `--cielo-700-rgb`.** Faltaba la variante de info. En vez de inventar un `--cielo-ink-rgb`, reuso `--cielo-700-rgb`, que el catálogo ya reserva para "cielo oscurecido (texto/botón)" y tiene AA en claro y dark. Un solo bloque aditivo en `globals.css`.

**globals.css es el único archivo compartido que toco — avisado al CEO.** El CEO dijo que Alerta es independiente de Button (454) y Badge (457). Cierto para `Alerta.tsx`, pero `.text-estado-cielo` vive en `globals.css`, que los tres podrían tocar. El cambio es aditivo (líneas nuevas al final del bloque `.text-estado-*`), de bajo riesgo de conflicto; si Button/Badge también lo añaden, el merge se resuelve trivial (misma clase, mismo valor).

**Icono con SVG inline + `currentColor`, sin dependencia.** El catálogo pide "icono a la izquierda". Cuatro paths mínimos (check/triángulo/círculo) que heredan el color del estado. Ocultable con `sinIcono` para no romper usos densos. Cero deps nuevas.

**No reescribo los 109 callsites.** Es una spec de COMPONENTE (OLA 1). El "mensaje con qué pasó + qué hacer" es una guía de contenido para los callsites; el componente lo habilita con el layout icono+texto, no lo impone. Reescribir los mensajes es trabajo de las olas de pantalla, no de esta.

**El candado del test se mueve con el arreglo.** El catálogo lo dice literal: `Alerta.test.tsx:14` que exigía `bg-red-50` se actualiza al token. Además sumo la contraprueba bidireccional (rubi solo error) que el radicado pide.

## Archivos

- **EDIT** `src/components/ui/Alerta.tsx` — tokens por función + icono.
- **EDIT** `src/app/globals.css` — `.text-estado-cielo` (aditivo).
- **EDIT** `src/components/ui/Alerta.test.tsx` — candado al token + contraprueba + icono.
- **EDIT** `scripts/tokens-check.ts` — piso 1038 → 1022.
- **NUEVO** `specs/458-alerta-sistema-diseno/{spec,plan,tasks}.md` + fila en `specs/README.md` (generada).

## Riesgos

- **Conflicto en `globals.css` con Button/Badge**: aditivo, trivial de resolver; avisado.
- **Un callsite pasaba `className` con color crudo que ahora choca con el token**: el barrido de crudos es sobre `Alerta.tsx`; si un callsite mete su propio color, es su spec, no esta. No encontrado en el barrido.
- **Contraste real en dark del `cielo-700` dark (#9cc9f5) sobre `bg-cielo/10`**: alto (texto claro sobre fondo translúcido oscuro). Diseño lo certifica visualmente.
