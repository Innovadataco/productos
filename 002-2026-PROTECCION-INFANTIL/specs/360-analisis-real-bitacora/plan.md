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

**Verificado en fuente antes de implementar (candado 15v5).** Tres supuestos
míos resultaron falsos al leer `hijos/hijos.ts`:

1. Los eventos de identificador se auditan con `recursoId = identificadorId`,
   no con el del menor. Filtrar solo por `hijoId` los dejaba todos afuera.
2. `valorAnterior` no se escribe nunca en ese módulo: solo hay estado nuevo.
3. "Quitar" **borra** la fila del identificador, y su registro de auditoría no
   llevaba ningún dato que lo atara al menor. Se agregó `{ hijoId }` al
   metadato — y nada más, porque el valor del identificador es PII.

### G20 · hora en punto

Presentación (`fechaHoraSinMinutos`) + normalización al capturar
(`aHoraEnPunto`, `step={3600}`). El tipo de dato en base NO cambia: los minutos
quedan en `00`.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Atribuir a un menor la cuenta quitada de un hermano | Test explícito de cruce entre dos hijos del mismo padre |
| Exponer el valor del identificador (PII) en la bitácora | Assert de que la descripción NO contiene el valor |
| Duplicar el hito de alta de una cuenta (viene por dos vías) | Descarte del `HIJO_UPDATE` sin `activo` + assert de conteo |
| Un `AuditLog` con JSON roto tumba la pantalla | Test que inserta metadato inválido y espera que se omita |
| La tarjeta muestra plantilla como si fuera análisis | Test de estado sin clasificar: `analisisIa` en `null` |

## Impacto en arquitectura: sí

Ruta y servicio DAL nuevos (ver spec.md). `02-roles-capacidades.md`
regenerado.
