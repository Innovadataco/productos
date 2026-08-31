# Quickstart / Validación §6: Cómo le habla PI al padre (SPEC-326)

Evidencia §6 **en producción, capturas en el PR, se ve bien en teléfono** (candado 25). Un hueco que no se pueda ejercer se declara (candado 18).

## Fase A — §3.1 notificaciones
1. Padre entra a Notificaciones → arriba "Te escribimos a <correo> · Cambiar".
2. Ve **2 interruptores**: círculo + reporte resuelto (textos aprobados). Apaga uno → recarga → sigue apagado.
3. Pie en gris "siempre te llegan": plan por vencer + contraseña cambiada + recuperación, sin interruptor.
4. **Cero claves técnicas** en toda la pantalla. No aparecen "identificador de hijos" ni "resumen semanal".

## Fase B — §3.5 país/ciudad registro
5. Padre nuevo completa registro → se le piden país y ciudad (del catálogo, **sin "Otra ciudad"**).
6. BD: la cuenta guarda `paisId`/`ciudadId`.

## Fase C — §3.4 perfil + cambio de correo
7. Padre entra a "Mi perfil" → ve nombre/correo/teléfono/país/ciudad + acceso a cambiar contraseña.
8. Edita nombre/teléfono → guarda → persiste.
9. Pide cambiar correo → ingresa correo nuevo → llega verificación al **nuevo**; el correo real **no cambia** aún.
10. Confirma el código → correo actualizado **y** aviso al correo **anterior**. (Correo nuevo ya en uso → rechazo, sin cambiar el original.)

## Fase D — §3.6 menú
11. Menú lateral del padre muestra "Mis reportes" y "Mi perfil".
12. Comportamiento del lateral coherente con A-56/A-57 (o documentado como ya resuelto).

## Transversal
13. Cada pantalla del padre termina en una acción con verbo. Todo se ve bien en teléfono.
