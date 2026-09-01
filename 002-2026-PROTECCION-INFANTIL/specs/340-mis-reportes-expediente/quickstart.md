# Quickstart · SPEC-340 · el hilo

El recorrido del CEO (candado 25 — el §6 del brief, ampliado). A **390 px**.

## Antes

```bash
npm run db:migrate && npm run db:seed && ./scripts/dev-restart.sh
```

Gate: `npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run arch:check && npm run tokens:check`. Nada de esto es evidencia de que funciona — el recorrido sí.

## Recorrido 1 · Reportar (US1)

1. Reportar una situación: el campo pide **día y hora** → guardar → el detalle muestra ambas.
2. **Verificar**: no existe el letrero «Reportando como…».
3. Ir a `/seguimiento` de un reporte → **no existe** «Reportar de nuevo a este identificador».

## Recorrido 2 · La cadena (US2)

4. Con 2 reportes vinculados, abrir Mis reportes → **una** tarjeta: nick+plataforma, clasificación dominante, «2 eventos», fecha del último, acordeón cronológico.
5. «Agregar otro evento» → nick/país/ciudad/edad **fijos**; escribir solo texto + día y hora → guardar → el acordeón lo muestra y el contador sube.
6. Buscar en la pantalla: «cerrar», «resuelto», puntaje → **no existen**.

## Recorrido 3 · Análisis y texto tapado (US3)

7. «Ver análisis» en un reporte clasificado → la explicación serena por categoría, no la clave técnica.
8. El texto propio aparece **difuminado** con «Revelar texto · se ocultó por tu seguridad».
9. Revelar → visible → esperar N minutos (bajar el parámetro a 1 para probar) → se tapa solo.
10. Con sesión de más de M minutos (bajar el parámetro): revelar pide **la contraseña**. Contraseña errada → mensaje sereno; correcta → revela.
11. Ver el código fuente de la página del listado: el texto **no está** en el HTML (viaja solo tras step-up).

## Recorrido 4 · Otros reportes (US4)

12. Sembrar un reporte **anónimo** al mismo identificador → en la tarjeta: «Otros reportes» con fecha, hora, lugar, clasificación — sin texto, sin autor, marcado anónimo.
13. En una cadena sin ajenos: «sin otros reportes por ahora».

## Recorrido 5 · El expediente nace del botón (US5)

14. Cadena sin expediente → «**Crear expediente**» → nace → el botón pasa a «**Ver expediente**».
15. Vincular un 2º reporte en OTRA cadena → **no** nace expediente solo.
16. Poner un expediente con última actividad vieja (SQL de prueba) y correr el motor → **no** lo cierra.
17. El expediente legado de producción (creado automático) sigue visible e intacto.

## Recorrido 6 · El mapa cuenta la historia (US6)

18. Expediente con hechos en 3 ciudades (uno ajeno, uno anónimo) → encabezado «N hechos documentados · X tuyos… · siempre abierto» y el mapa con las ciudades.
19. «Reproducir la historia» → aparecen en orden cronológico con la fecha visible; pausar y arrastrar funciona.
20. Un hecho en otro país → al llegar, el mapa se amplía solo.
21. La línea de tiempo distingue mío (texto tapado con revelar) / otro padre / anónimo; ubicaciones = solo ciudad.

## Recorrido 7 · Informes para siempre (US7)

22. «Generar informe (PDF)» → el PDF trae **fecha y hora de generación** (hora de Colombia) y el **código de verificación** impresos.
23. Generar OTRO una hora después → funciona; «Informes generados» lista los DOS con su fecha, numerados.
24. Abrir la página pública de verificación con el código/hash → «auténtico». Editar un byte del PDF y verificar de nuevo → no verifica.
25. Buscar cómo borrar o editar una entrada del historial → **no hay forma** en la aplicación.

## Recorrido 8 · La lectura (US8)

26. Con 5 hechos (4 entre 9 y 11 p. m., escalada de categoría, 3 en 4 días): el panel dice las TRES cifras, descriptivas.
27. Bajo el mapa: «Ciudad 7 · Ciudad 5 — el más reciente: …» — solo cifras.
28. Buscar «se está moviendo», «se concentra» → no existen; está la invitación al análisis detallado.
29. Expediente con UN hecho en UNA ciudad → el panel no se rompe ni rellena.

## Recorrido 9 · El escudo (US9)

30. Con una alerta sin ver → el escudo del header en **ámbar** en cualquier pantalla.
31. Ver las alertas → vuelve a la calma sin recargar.
32. Entrar como colegio/admin → su escudo no cambia por esto.

## Bordes

33. Dos eventos el mismo día → el acordeón ordena por hora.
34. Reporte sin clasificar → «Ver análisis» avisa con calma que está en camino.
35. Dos PDFs en el mismo minuto → dos entradas, códigos distintos.
36. Reporte de la cadena anonimizado por disputa → el expediente muestra lo que queda sin romperse.

## Al PR

Capturas a 390 px: la tarjeta con acordeón · agregar-evento con campos fijos · texto tapado y el pedido de contraseña · el mapa reproduciendo · «Informes generados» con dos entradas · la verificación pública en verde y en rojo · el escudo en ámbar.
