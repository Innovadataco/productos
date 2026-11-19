# SPEC-918 · El correo de activación del colegio muestra un BOTÓN, no la URL pelada

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-918-colegio-enlace-boton` desde `origin/main` (54145873).
**Deploy + corrector contra prod:** los corre el CEO.

## Problema

El correo de activación por enlace del colegio (`colegio.registro_enlace.email`, evento
SPEC-344) tenía la `{{url}}` **suelta** en su línea (URL cruda), no un botón. El patrón
correcto ya existe en `comite.invitacion.enviada.email` (SPEC-909): lead-in + enlace markdown
`[Activar mi cuenta]({{url}})` a solas en su párrafo → el motor lo pinta como **botón
bulletproof**.

## Copy (confirmado por Diseño · FORMA f5b3030c)

Botón = **«Activar mi cuenta»**. Copy-only, voz ya en usted. Se **PRESERVA la variable
`{{url}}`** (este evento la usa; NO es `{{linkActivacion}}`).

```
Hola,

Usted está por activar la cuenta del **{{nombreColegio}}** en Protección Infantil.

Para crear su contraseña y activar la cuenta, haga clic en el botón:

[Activar mi cuenta]({{url}})

El enlace vence en 24 horas y solo se puede usar una vez. Si no fue usted quien lo pidió, no tiene que hacer nada.
```

El CTA va en **párrafo propio** con línea en blanco (`\n\n`) **antes y después** — riesgo
crítico de Diseño: con `breaks:true` del motor, un `\n` simple lo deja INLINE (enlace de
texto, no botón).

## Cambios

1. **Fuente única** `prisma/colegio-registro-enlace-copy.seed-data.ts`
   (`COLEGIO_REGISTRO_ENLACE_COPY`) — la MISMA que consumen el seed y el corrector, sin
   derivar (lección SPEC-908/909).
2. **Seed** (`prisma/seed.ts`): el bloque de `colegio.registro_enlace.email` siembra
   `asunto`/`cuerpoMarkdown` desde la fuente única; `variablesSchema` (con `url`) intacto.
3. **Corrector idempotente** `scripts/corregir-colegio-registro-enlace-boton.ts` (patrón
   SPEC-909): DRY-RUN por defecto, `--confirm` aplica fila-por-fila, idempotente, preserva
   `variablesSchema`, exit≠0 si falla. Trae la fila VIVA de prod (que el seed no toca).

## Candados (mueren con el defecto)

- `prisma/colegio-registro-enlace-boton.candado.test.ts` (ESTRUCTURAL + CONDUCTA):
  (1) no queda `{{url}}`/URL http **fuera** de un `[texto](url)`; (2) el CTA está en párrafo
  propio **y** el render del motor produce el botón — con prueba directa del riesgo de Diseño
  (`\n\n` → botón; `\n` simple → NO botón); (3) preserva `{{url}}`; (4) el seed usa la fuente
  única. Control positivo: el cuerpo viejo (URL pelada) dispara (1).
- `scripts/corregir-colegio-registro-enlace-boton.candado.test.ts`: DRY-RUN no escribe,
  `--confirm` trae al canónico, idempotente, fila-por-fila, clave sin fila reportada (db falsa).

## Fuera de alcance

- Otras plantillas con `{{url}}` suelta (padre `colegio...padre`, profesional, reset de
  contraseña): son otros eventos/audiencias; el CEO no las radicó. El candado es específico de
  `colegio.registro_enlace.email`.
- `variablesSchema`, clave y evento: no se tocan (§3 de la FORMA).
