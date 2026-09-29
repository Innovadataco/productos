# Plan · SPEC-793 · allowlist de proveedores del enlace

## Medición (previa)
`validarEnlaceReunion` en `main`: solo `https` + no-HTML, **sin allowlist**. Enlaces publicados: 0 (test
DB medido; prod 0 por radicado/CEO). El control entra antes del primer enlace real.

## Implementación
1. **`enlace-validacion.ts`**: `ProveedorEnlace {nombre, dominios[], porque, aprobado}` +
   `PROVEEDORES_APROBADOS` (propuesta mínima, todos `aprobado:false`, cada uno con su porqué) +
   `hostPerteneceADominio` (exacto o subdominio propio, no «contiene») + `esProveedorAprobado` +
   `validarEnlaceReunion(raw, proveedores = PROVEEDORES_APROBADOS)` (inyectable → candado content-independent).
2. **`enlace-sesion.ts`**: `publicarEnlaceSesion(params, proveedores?)` pasa la lista a la validación
   (el endpoint la deja en default; el test de servidor inyecta entradas de prueba).
3. **El porqué** vive en la cabecera de `enlace-validacion.ts` y en el comentario de `PROVEEDORES_APROBADOS`.

## Candados
- `enlace-proveedor-aprobado.candado.test.ts` (unit, content-independent): mecanismo + look-alike + forma
  de la lista real (sin fijar contenido). Registrado en el manifiesto unit.
- `enlace-allowlist-servidor.candado.test.ts` (integración): validación de servidor por `publicarEnlaceSesion`.

## Co-cambio (hallazgo)
`enlace-sesion.test.ts` y `sesion-operador.candado.test.ts` (C-c) de 750 inyectan un proveedor de prueba
para su host, preservando su invariante original (formato / no-fuga-de-URL). Es el agujero que 793 cierra.

## Verificación
`tsc` · `lint` · unit (proveedor-aprobado + enlace-sesion) · integración (servidor + sesion-operador) ·
`arch:check` · `specs-discipline`.
