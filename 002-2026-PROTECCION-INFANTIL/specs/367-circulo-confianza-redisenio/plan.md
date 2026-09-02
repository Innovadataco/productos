# Plan · SPEC-367 · A-73 círculo de confianza (rediseño G12)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1

## Decisiones de diseño

**Se construyó sobre el mockup aprobado, no de cero.** Las tres decisiones de
Jelkin mandan sobre el diseño (nombre doble · avisar desde la revisión ·
estadísticas dentro de cada persona).

**Verificado en fuente antes de codificar (candado 15v5).** El hallazgo que
ahorró backend: `listarContactos` usa `include`, así que la lista YA devolvía
`nombre`, `parentesco` y `creadoEn`. La pantalla vieja declaraba solo `etiqueta`
(deprecada) — por eso no mostraba el nombre real. Cero cambios de API para eso.

**Único agregado:** `tope` en la respuesta de la lista, para mostrar el cupo real
("2 de 20") en vez de un número inventado. Aditivo, ningún consumidor previo lo
lee.

**Estilos con tokens, no con la paleta suelta.** El mockup usa hex; el producto
usa clases-token (`bg-pino`, `text-muted`, `bg-ambar`). `tokens:check` mide la
paleta default de Tailwind: al retirar la pantalla vieja el conteo BAJA de 1083 a
1064.

**El `Button` legacy no se usa**: su variante primaria es un degradado sky/cyan
que no es el diseño aprobado (pino sólido). Los controles se arman con tokens.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Relajar el acceso al rediseñar la página | El guard de rol se conserva igual (mismos roles redirigidos); no se restringe ni se abre más |
| Perder datos al tocar identificadores | El PATCH es de LISTA COMPLETA: toda acción manda la lista entera con su `activo` (se lee el detalle antes de sumar) |
| Que vuelva a aparecer jerga o rojo en la cara del padre | Tests: sin "identificador"/"etiqueta" en el panel; el marcado no contiene `rubi` |
| Que las estadísticas vuelvan a la pantalla principal | Test de la decisión 3: "De qué se trata"/"Dónde"/"Cuándo" NO están fuera del detalle |
| Misgenderear a la persona vigilada | Textos neutros: el sistema no guarda género y no se infiere del nombre |

## Impacto en arquitectura: no

Sin modelo ni migración; se reordena la capa de presentación. Detalle en spec.md.
