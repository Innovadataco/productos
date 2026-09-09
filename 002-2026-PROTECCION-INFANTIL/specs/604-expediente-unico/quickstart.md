# Quickstart · SPEC-604 — verificación manual

1. Levantar entorno: `docker compose up -d db` y `./scripts/dev-restart.sh` (app en :5005).
2. Entrar como padre (cuenta PARENT) y abrir `/dashboard/padre/reportar`.
3. **Paso 0**: se ven las fichas ACTIVAS con su edad («Nombre · N años» o «· sin edad») y el botón «+ Nuevo hijo (solo nombre)». Una ficha INACTIVA no aparece.
4. Elegir una ficha CON año de nacimiento y avanzar: en el paso 2 («Detalles del incidente») NO aparece «Edad aproximada del menor». En «Revisa y confirma» se ve la fila «Para quién es» y la nota «Al enviar, se crea o se actualiza el expediente de …».
5. Enviar: la respuesta es la redirección a `/mis-reportes`; la tarjeta de la cadena muestra **«Ver expediente»** desde el primer evento (nunca «Crear expediente»). Abrirlo: el expediente tiene 1 evento.
6. En la tarjeta, «Agregar otro evento» y guardar: el expediente queda con 2 eventos y la cadena con 2 (misma tarjeta).
7. Repetir el reporte del mismo identificador desde `/dashboard/padre/reportar`: aparece la oferta «Ya reportaste este identificador recientemente» → «Sí, agregar otro evento» → el nuevo reporte se suma al MISMO expediente.
8. **Alta «solo nombre»**: con una cuenta de padre SIN fichas (o eligiendo «+ Nuevo hijo»), el paso 0 muestra el campo «Nombre del menor». Escribir solo el nombre, completar y enviar: en «A quién protego» queda la ficha nueva (sin apellidos, activa) y el reporte nace atado a ella, con su expediente.
9. **Anónimo (candado)**: en incógnito, `/reportar` muestra el wizard de 3 pasos de siempre (sin «¿Para quién reportas?») y el paso 2 conserva «Edad aproximada del menor». Al enviar no se crea expediente alguno.

Verificación en BD (opcional): `select "origenCreacion", estado, "numEventos" from "Expediente" order by "createdAt" desc limit 3;` — los nuevos nacen `AUTOMATICO` y `numEventos` crece con cada evento.
