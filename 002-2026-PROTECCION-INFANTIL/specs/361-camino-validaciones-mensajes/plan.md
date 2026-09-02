# SPEC-361 · Plan

1. Leer la fuente (15v5): el backend YA daba buenos mensajes de duplicado y tope;
   el cliente los descartaba (`throw new Error("No se pudo registrar")`). El
   defecto de F4 es de la pantalla, más el 400 genérico del schema.
2. Módulo puro `documento-menor.ts` (F7/F8/F9) con sus tests.
3. Backend `/api/padre/hijos`: mensajes por campo, validación por tipo, tope por
   ACTIVOS con el texto de Jelkin.
4. Cliente `MisHijos`: leer el mensaje del servidor, validar antes de enviar,
   contador visible, campo Edad.
5. `ReporteStepDetalle`: la edad como lista 4-17.
6. Tests (24v2) + verificación en vivo de cada punto.
