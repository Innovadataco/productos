# SPEC-489 · El medidor de confianza (IaDocsPanel) a tokens (data-viz reservado)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: ruling data-viz de Diseño §7.9. Cierra el ring que SPEC-483b excluyó.

## El arreglo
El arco de confianza de `IaDocsPanel` codifica un valor; Diseño fijó la escala: **en/sobre umbral → `text-estado-pino`**, **bajo umbral → `text-estado-ambar`**, arco de fondo → neutro `text-tinta/10` (`--linea`), marcador de umbral → `text-muted` (tinta-muted). **NUNCA rojo.** La lógica `confianza >= umbral` no cambia — solo se tokenizan los colores. Se retiró la región `data-viz:inicio/fin` que 483b había marcado (el ring ya está migrado) y se actualizó el candado de 483b (`ia-residual-barrido`) para escanear todo `ia/**` sin exención.

## Candado — `src/components/modules/ia/ring-confianza-tokens.candado.test.ts`
- El arco de valor mapea el umbral a pino/ámbar por token; 0 crudo green/amber/slate en IaDocsPanel; **cero rojo** (sin `-red-` ni rubi) en el ring. Muere por mutación.

## Impacto en arquitectura:
- Cierra el último data-viz reservado del panel de IA usando la escala de tokens de Diseño; el color sigue codificando el valor pero por token. Conducta del gauge intacta (mismo umbral, misma lectura).

## Referencias
SPEC-483b (marcó y excluyó el ring) · regla de oro data-viz. Rama del lote desde `origin/main 94c0e8c8c`.
