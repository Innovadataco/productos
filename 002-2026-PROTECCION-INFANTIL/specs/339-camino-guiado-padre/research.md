# Research · SPEC-339 · El camino guiado del padre

**Fase 0** · 31-08-2026 · todo lo de abajo está verificado contra `origin/main` = `04f5af5c0`.

---

## R-1 · Cómo se sostiene un camino que no se puede saltar

**Decisión**: el paso pendiente del padre viaja como un campo más de la cookie firmada `sesion_estado`, y `middleware.ts` gana un quinto guardián que lo evalúa después de consentimiento y antes de vigencia.

**Por qué**: es el único punto del sistema por el que pasa **toda** petición, incluida una URL escrita a mano, y ya gobierna así los otros tres muros (`middleware.ts`, pasos 4 a 6). Corre en Edge sin tocar la base de datos, que es la restricción dura del archivo.

**Alternativas descartadas**:

- *Guardar en cada layout / página*: prohibido por el ratchet `no-redirect-en-layout-de-dashboard`, y de todos modos deja las rutas de datos sin protección.
- *Comprobar solo en las rutas de datos*: no impide entrar a la pantalla; el padre vería un módulo vacío en vez de su paso.
- *Un campo nuevo en la base de datos con el paso alcanzado*: dos fuentes de verdad que se desincronizan (es la clase de defecto I-211/I-222/I-224/I-227). El paso **se deriva** de datos que ya existen: consentimiento firmado, perfil completo, menores, suscripción.

---

## R-2 · La grieta de la falla-abierta (lo más importante de esta spec)

**El hallazgo**: `middleware.ts` dice, textualmente, que si la cookie no está o expiró **deja pasar** — un estado viejo de menos de 5 minutos se prefiere a colgar la base de datos desde Edge. Para la vigencia esa ventana es aceptable. **Para el camino no lo es**: el brief §6 exige que el padre no pueda saltarse un paso *ni escribiendo la URL a mano*, y la cookie vive 5 minutos. Un padre que deja la pestaña abierta diez minutos y escribe la dirección de un módulo entraría.

**Decisión**: para el rol padre, cuando la cookie **no se puede leer** y la ruta está gobernada por el camino, el guardián no deja pasar ni consulta la base de datos: rebota **una sola vez** a `/api/sesion/al-dia?destino=<ruta>`, una ruta de sesión (Node) que re-sella la cookie con `sellarCookieSesionEstado` y devuelve al padre a su destino o a su paso pendiente.

**Propiedades**: un solo salto (el destino queda exento, invariante del ratchet), sin base de datos en Edge, y reutiliza el mecanismo de re-sellado que ya existe. Para los demás roles y para los otros tres guardianes **no cambia nada**: siguen fallando abierto exactamente como hoy.

**Alternativas descartadas**:

- *Dejar la falla-abierta también para el camino*: incumple el §6 del brief y el CEO lo cazaría en el recorrido.
- *Consultar la base de datos desde Edge*: prohibido por diseño del archivo.
- *Alargar la vida de la cookie*: empeora todo lo demás (un plan cancelado tardaría más en cerrarse).

---

## R-3 · Registro por enlace sin romper el registro de colegio

**Decisión**: rutas y modelo nuevos y separados para el padre (`/api/auth/registro/solicitar` y `/api/auth/registro/completar`, modelo `TokenRegistro`), calcados del patrón de recuperación de contraseña (`TokenRecuperacion`: se guarda el **hash** del token, con vencimiento y marca de usado). El código de 6 dígitos y sus tres rutas **no se tocan**.

**Por qué**: verificado en fuente — `/registro-colegio` usa el mismo formulario (`VerificacionForm`) y las mismas rutas que el registro del padre. Modificarlas para el enlace rompería el camino del colegio, que nadie pidió tocar.

**Detalle que evita trabajo de más**: las rutas públicas se comparan por segmento (`pathname === ruta || pathname.startsWith(ruta + "/")`), así que `/registro/crear-clave` ya es pública por heredar de `/registro`. No hay que añadir nada a la lista.

**Anti-enumeración**: la ruta nueva repite el contrato de SPEC-338 — misma respuesta en pantalla exista o no el correo, y el aviso «ya tienes una cuenta» al buzón.

---

## R-4 · Un menor por padre

**Decisión**: la ficha del menor pasa a tener **dueño**: identidad única por (padre + tipo + número), y el alta deja de enganchar al segundo padre — cada uno crea la suya.

**Por qué**: regla de Jelkin del 31-08 y confirmación del CEO. Sin esto quedan vivos tres defectos, los tres verificados en el servicio de menores:

1. El interruptor del menor es global: un padre lo inactiva y el otro deja de recibir avisos sin enterarse.
2. El interruptor de cada cuenta también es global — el propio código lo llama «flag global compartido».
3. La corrección de datos que pide este brief **nace rota**: sobre una ficha compartida, un padre le reescribiría el nombre y el documento al menor del otro.

**Costo hoy**: cero. Conteo en producción hecho por el CEO el 31-08: **0 menores con más de un padre**. No hay ninguna ficha que partir; la migración no duplica nada. En un mes, con padres reales, esto sería una migración de PII de menores con avisos ya emitidos.

**Qué queda inactivo y no se borra** (orden del CEO, por si Jelkin revierte la regla): la tabla puente padre↔menor y el mecanismo de «cuentas desvinculadas por este padre». Ambos documentados como sin uso.

**Alternativa descartada**: *denormalizar el documento en la tabla puente para lograr la unicidad por padre sin darle dueño a la ficha*. Consigue la unicidad y **no arregla ninguno de los tres defectos**, porque la ficha seguiría compartida.

---

## R-5 · El tope de menores

**Decisión**: parámetro `padre.hijos.maximo`, sembrado en `5`, del tipo entero, con siembra idempotente en el mismo bloque `padre.*` que ya existe. El mensaje que ve el padre sale del parámetro, no del código.

**Por qué**: el brief §2.4 lo exige explícitamente («ese 5 es un parámetro, no una constante») y es el patrón vigente para todos los umbrales del producto.

**Alternativa descartada**: constante en el código. Obligaría a un despliegue para cambiar un número de negocio.

---

## R-6 · Los dos correos nuevos

**Decisión**: `auth.registro_enlace` y `auth.bienvenida_padre` se emiten como **eventos con plantilla sembrada** en el motor de notificaciones, con su envoltorio en la capa de correo, siguiendo exactamente lo que hizo SPEC-338.

**Por qué**: hay un ratchet (`email.migracion.test.ts`) que exige que todo evento tenga regla y plantilla después de la siembra. Un envío suelto lo rompería.

---

## R-7 · La voz

**Decisión**: **tuteo neutro colombiano** en todo. El brief §3 y el mockup están en voseo rioplatense; el CEO decidió el 31-08 que manda `AGENTS.md` y que el mockup se reescribe. Se conserva íntegro el *tono*: sereno, cercano, cero alarma, cero jerga, cero rojo.

**Arrastre**: la única frase que hoy el padre lee en voseo dentro del código es el mensaje del guardián de consentimiento (`middleware.ts:195`). Se corrige en este mismo PR.

---

## R-8 · El menú en móvil

**Decisión**: barra de navegación inferior para el padre en anchos pequeños, con los mismos destinos de la lista lateral, que se mantiene intacta en escritorio.

**Por qué**: verificado — la lista lateral del padre es `hidden … sm:flex`, así que **en móvil el padre no tiene ningún menú**. Terminar el camino y quedar encerrado sería el «callejón sin salida» que el brief prohíbe. Los destinos ya viven en una lista única compartida, así que no nacen listas paralelas.

**Nota de alcance**: «Reportar» se queda en el menú aunque no se rediseñe (decisión del CEO, precedente I-38).

---

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Un error en el guardián cierra la aplicación para **todos** los roles | Pruebas explícitas de que administrador, colegio, operador y comité no evalúan el camino |
| Bucle de redirección (historia I-25 → I-111 → I-141) | El destino del camino entra en sus propias exentas; el ratchet de invariante lo verifica al importar |
| El rebote de re-sellado se vuelve infinito | El destino del rebote es ruta de sesión (no evalúa el camino) y solo puede ocurrir una vez por cookie |
| El camino se «gana» de por vida | El paso se **deriva** de la base de datos en cada re-sellado; si el padre borra su único menor, vuelve al paso 3 |
| Romper el registro de colegio | Rutas y modelo separados; el camino del colegio entra en el recorrido de prueba |
| La base local está atrás de `main` | Ponerla al día antes de probar; anotado en el quickstart |
