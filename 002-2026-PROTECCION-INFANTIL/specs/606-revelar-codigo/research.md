# Research — SPEC-606

## D1 · ¿Código con estado en BD o token firmado stateless?

SPEC-592 eligió token firmado (HMAC) sin tabla: «la posesión del correo ES el factor». Para SPEC-606 se exige intentos máximos, invalidación al usar y un solo código vigente — todo eso REQUIERE estado en servidor. **Decisión**: tabla `CodigoStepUp` con sha-256 del código (patrón hermano probado: `CodigoAccesoContenido` de SPEC-584, mismo repo). El formato firmado sobrevive solo en «Crear contraseña» (SPEC-598), donde el dueño ya aprobó el trade-off.

## D2 · ¿Eliminar o desactivar el step-up por contraseña?

Grep en `src/`, `tests/`, `scripts/`: el ÚNICO consumidor de `POST /api/padre/step-up` es `TextoSensible.tsx`. **Decisión**: eliminar endpoint + test (opción autorizada por el brief: «eliminar el endpoint si no hay consumidores»). La línea base de arquitectura se regenera en el mismo PR. Alternativa descartada: dejarlo inalcanzable — código muerto con superficie de ataque.

## D3 · Cooldown vs rate limit

Son reglas distintas: el cooldown (60 s, por usuario, mira el último código creado) protege el buzón del padre y da UX honesta («puedes pedir otro en N s»); el rate limit (`stepup_codigo` 5/h) frena abuso seriado. **Decisión**: ambos, con el cooldown ANTES de crear la fila y el rate limit en la ruta (patrón de todo endpoint).

## D4 · ¿Qué pasa si el correo no sale (sin regla activa)?

Fail-closed heredado (SPEC-296/592/598): 502. Pero la fila recién creada NO puede cobrar cooldown por un correo que jamás salió → **se borra** (audit ya escrito conserva el rastro con el hash).

## D5 · Vigencia y parámetros

El TTL del código es parámetro nuevo `padre.texto.codigo_minutos` (default 10) — el mockup fija «vence en 10:00» y el admin lo cambia sin desplegar (regla de la casa: los números del negocio son parámetros). `padre.texto.stepup_minutos` (vida del sello) y `padre.texto.retapado_minutos` (reloj del cliente) NO cambian.

## D6 · Enmascarado del correo

`j•••••@gmail.com` (inicial + 5 viñetas + dominio): el padre reconoce su correo sin regalarlo completo a miradas ajenas (misma amenaza que motiva el tapado: el agresor puede estar en casa).

## D7 · Entropía del código

6 dígitos CSPRNG = 1.000.000 de combinaciones; con 5 intentos por código, vigencia 10 min, un solo código vigente, cooldown 60 s y rate limits, la probabilidad de acierto por fuerza bruta es ~5e-6 por ventana de 10 min — estándar industria para códigos por correo.
