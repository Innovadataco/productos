# Plan · SPEC-360 · A-70 tanda 2

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-01 · **Dev**: PI-1

## Decisiones de diseño

### F11 · de dónde sale el análisis

`ClasificacionIA` ya guarda categoría, confianza, secundarias, modelo y
latencia de cada reporte: el motor YA corrió y su resultado está en base. Se
lee de ahí. Alternativa descartada: volver a llamar al motor al abrir la
tarjeta — gasto por cada visita a una pantalla de consulta, para un resultado
que no cambia.

El candado que hace honesta la pantalla: `analisisIa` sale `null` salvo que el
reporte esté en estado final (`CLASIFICADO` o `CORREGIDO`). Sin eso, un reporte
a medio procesar mostraría una categoría provisional como si fuera conclusión.

`categoriasSecundarias` es `Json` libre: se lee con un parser tolerante que
descarta en silencio lo que no encaje. Una fila vieja con otra forma no puede
tumbar la pantalla del padre.

### F10 · bitácora sin modelo nuevo

Fuentes: `AuditLog` (los cambios sucesivos, con su fecha y hora) + los
`creadoEn` de `Hijo` e `IdentificadorHijo` (las altas). Alternativa descartada:
un modelo `BitacoraMenor` — duplicaría un histórico que ya se lleva y nacería
vacío para todos los menores existentes.

**Verificado en fuente antes de implementar (candado 15v5).** Varios supuestos
míos resultaron falsos al leer `hijos/hijos.ts` y las rutas del padre:

1. Los eventos de identificador se auditan con `recursoId = identificadorId`,
   no con el del menor. Filtrar solo por `hijoId` los dejaba todos afuera.
2. `valorAnterior` no se escribe nunca en ese módulo: solo hay estado nuevo.
3. El estado del HIJO se auditaba `{campos:["estado"]}` **sin el valor** cuando la
   ruta pasaba por `actualizarHijo`. SPEC-363 cambió la ruta para enrutar el
   estado por `cambiarEstadoHijo` (audita `{estado}` con valor · BUG2 + cupo al
   reactivar · BUG1). El lector lo lee y enciende el hito de pausa/reactivación.
4. "Quitar" **borra** la fila del identificador. SPEC-363 (I-259) graba `{hijoId}`
   en la auditoría del borrado (solo eso; el valor es PII) para poder atar el
   hito "quitaste una cuenta" al menor. El lector lo lee.

**Reparto (CEO idc-71/idc-ab):** esta SPEC entregó el LADO LECTURA (servicio +
ruta + UI + display); el lado escritura lo cubrió SPEC-363, hoy en main
(`e98d937eb`). Tras el rebase de esta rama sobre ese main, los cuatro tipos de
hito encienden y se verificó el recorrido punta a punta. En el rebase, main gana
siempre en `hijos.ts` y `[id]/route.ts` (esta rama no los aporta).

### G20 · hora en punto

Presentación (`fechaHoraSinMinutos`) + normalización al capturar
(`aHoraEnPunto`, `step={3600}`). El tipo de dato en base NO cambia: los minutos
quedan en `00`.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Duplicar el hito de alta de una cuenta (viene por dos vías) | Descarte del `HIJO_UPDATE` sin `activo` + assert de conteo |
| Un `AuditLog` con JSON roto tumba la pantalla | Test que inserta metadato inválido y espera que se omita |
| La tarjeta muestra plantilla como si fuera análisis | Test de estado sin clasificar: `analisisIa` en `null` |
| El hito de estado aparece por un camino que la UI no usa | Test: `cambiarEstadoHijo` (lo que la ruta llama) enciende el hito; `actualizarHijo` con una corrección de dato NO |
| PII del valor del identificador al quitar la cuenta | Test E2E: la fila se borra, el hito nombra el hecho y NINGÚN hito contiene el valor |

## Impacto en arquitectura: sí

Ruta y servicio DAL nuevos (ver spec.md). `02-roles-capacidades.md`
regenerado.
