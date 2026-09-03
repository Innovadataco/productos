# SPEC-381 · Plan

1. Auditar todas las `ruta` en `inicio-admin.ts` contra `page.tsx` (script one-liner).
2. Ver qué muestra el endpoint `/api/admin/notificaciones/salud` (SaludMotorDto) y qué
   pantalla del admin ya lo pinta.
3. Decidir: crear pantalla vs redirigir. Elegido redirigir (ya existe una).
4. Escribir el candado que reproduce I-269 en rojo antes del fix.
5. I-270 · candado 26: reproducir en vivo antes de codificar. NO reproduce con admin.
6. Rastrear en logs y en el journal del docker daemon el reinicio del deploy `6136af5d`
   para verificar la hipótesis del CEO.
7. Log defensivo en el catch mudo (no cambia comportamiento).
