# Quickstart · SPEC-339 · El camino guiado del padre

Cómo se prueba de punta a punta. Es el guion que recorre el CEO antes de mostrárselo a Jelkin (brief §6).

---

## Antes de empezar

La base de datos de desarrollo de esta máquina está **por detrás de `main`** (le faltan, entre otras, las migraciones de perfil del padre y de estado del menor). Ponerla al día primero, o nada de esto corre:

```bash
npm run db:migrate && npm run db:seed
```

Levantar siempre con el reinicio limpio, nunca a mano:

```bash
./scripts/dev-restart.sh
```

Aplicación en el puerto `5005`. **El recorrido se hace con la ventana en 390 px de ancho** — es el tamaño del mockup y el del padre real.

---

## Puerta de calidad antes de dar nada por listo

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Y, porque este PR toca el esquema y la navegación:

```bash
npm run arch:check && npm run indices:check
```

**Ninguno de estos comandos es evidencia de que funciona.** Son evidencia de que no está roto. La evidencia real es el recorrido de abajo.

---

## Recorrido 1 · La puerta (FR-001 a FR-007)

1. Abrir `/registro` con un correo que **no** tenga cuenta. Dejar solo el correo.
2. **Verificar**: aparece la pantalla intermedia con el correo escrito, la nota de revisar el correo no deseado, el botón de enviar de nuevo y el de escribir otro correo.
3. Abrir el enlace que llegó al buzón.
4. **Verificar**: pide la contraseña dos veces, con las dos condiciones a la vista, y el botón sigue apagado hasta cumplirlas.
5. Guardar.
6. **Verificar**: entra con sesión iniciada, llega el correo de bienvenida y aterriza en el **Paso 1 de 4**.

**Los bordes:**

7. Abrir **otra vez** el mismo enlace → lo rechaza con calma y ofrece pedir uno nuevo.
8. Repetir el paso 1 con un correo que **sí** tiene cuenta → **la pantalla es exactamente la misma** y al buzón llega el aviso «ya tienes una cuenta».

---

## Recorrido 2 · El portero (FR-008 a FR-014) — el que más importa

Con la cuenta recién creada, **en el Paso 1**, escribir a mano en la barra de direcciones la dirección de un módulo del padre.

9. **Verificar**: vuelve al Paso 1. No entra.
10. Aceptar el consentimiento. Repetir con la URL a mano → vuelve al **Paso 2**.
11. Completar los datos. URL a mano → vuelve al **Paso 3**.
12. Cargar un menor. URL a mano → vuelve al **Paso 4**.

**La prueba de la cookie vencida** (esto es lo que se le escapa a una prueba automática):

13. Quedarse en el Paso 3 y **esperar más de 5 minutos** sin tocar nada, o borrar a mano la cookie `sesion_estado` desde el navegador.
14. Escribir a mano la dirección de un módulo.
15. **Verificar**: **no entra**. Rebota, se re-sella la sesión y termina en el Paso 3. Un solo salto, sin parpadeo de ida y vuelta.

**Retomar** (FR-010):

16. Cerrar el navegador a mitad del Paso 3 y volver a entrar más tarde → retoma en el Paso 3, con lo que ya había cargado.

---

## Recorrido 3 · Los menores (FR-018 a FR-022-d)

17. Cargar un menor con todos sus datos y una cuenta (plataforma + nick).
18. Corregirle el apellido → **verificar** que el cambio queda guardado y visible.
19. Cargar hasta llegar a cinco. Intentar el **sexto** → lo rechaza con el mensaje del parámetro.
20. Cambiar `padre.hijos.maximo` a `3` desde la administración e intentar un cuarto → lo rechaza. **Sin desplegar nada.** Devolverlo a `5`.
21. Intentar registrar dos veces el **mismo documento en la misma lista** → lo rechaza con mensaje claro.

**La prueba de los dos padres** (D-4 · FR-022-a a FR-022-c) — hay que hacerla con **dos cuentas**:

22. Con un segundo padre (otro correo), registrar al **mismo menor, mismo documento**.
23. **Verificar**: el segundo padre obtiene **su propio registro** y no se engancha al del primero.
24. Con el padre A, **inactivar** ese menor.
25. **Verificar**: el padre B lo sigue viendo activo y sigue recibiendo sus avisos.
26. Con el padre A, cambiarle el nombre al menor.
27. **Verificar**: en la lista del padre B el nombre **no cambió**.

---

## Recorrido 4 · El plan y el cierre (FR-023 a FR-025)

28. En el Paso 4, **verificar** que solo aparecen los planes que el administrador tiene activos, con la prueba gratis destacada y el campo de bono.
29. Activar la prueba gratis.
30. **Verificar**: aparece el cierre nombrando al menor, con los dos accesos siguientes y el botón al panel.
31. Entrar a un módulo **sin recargar y sin tocar «Renovar»** → abre al primer intento.

---

## Recorrido 5 · Móvil y voz (FR-026 a FR-029)

32. Recorrer todo lo anterior a **390 px**: ninguna pantalla se desborda a lo ancho y hay una sola cosa por pantalla.
33. **Verificar** que en móvil el padre alcanza todos los destinos de su menú, **«Reportar» incluido** — hoy no tiene ninguno.
34. **Verificar** que ninguna pantalla ni ningún mensaje le habla en voseo («debés», «tenés», «creá»), incluido el aviso del muro de consentimiento.
35. **Verificar** que no aparece rojo, ni jerga técnica, ni nombres internos en ninguna pantalla del camino.

---

## Recorrido 6 · Que no se rompió nada de lo demás

36. **Registro de colegio**: `/registro-colegio` sigue funcionando con su **código de 6 dígitos**, sin cambios visibles.
37. Entrar como administrador, como colegio, como operador y como comité: **ninguno** ve el camino ni queda encerrado.
38. Un padre con el plan vencido sigue yendo a su pantalla de renovación, no al camino.

---

## Qué se adjunta al PR

- Capturas a 390 px de las seis pantallas del camino.
- La captura del intento de entrar por URL a mano con la cookie vencida (paso 15).
- Las capturas de las dos listas del recorrido de los dos padres (pasos 25 y 27).
- La salida de la puerta de calidad.

Y la frase que no se puede saltar: **verde en la integración continua no es que funcione.** Lo que vale es este recorrido.
