# Plan · SPEC-419 — El psicólogo puede recibir su enlace de registro

## Análisis en fuente

| Archivo | Qué se sacó |
|---|---|
| `src/lib/email-profesional.ts` | Dos eventos, los dos con `programadas === 0` → throw. Escrito bien; lo que faltaba era el catálogo. |
| `src/app/api/auth/registro-profesional/solicitar/route.ts:70` | Atrapa el throw, lo loguea y responde 202. **Ahí se vuelve invisible el defecto.** |
| `src/app/api/auth/registro-profesional/completar/route.ts:71` | Mismo patrón con la bienvenida. Menos grave: la cuenta sí queda creada. |
| `prisma/seed.ts:875-890` y `:1144-1145` | El patrón de la puerta del padre (SPEC-339): plantilla + regla `obligatoria`. Se copia tal cual. |
| `prisma/schema.prisma` (`TokenRegistro`) | El token del enlace se creaba desde siempre — sirve para acotar el defecto al aviso. |

## Decisiones

- **No tocar el 202.** Choca con el anti-enumeración de SPEC-338 y no es el defecto.
- **No ablandar el `throw`.** Fallar en cerrado es lo correcto; el candado lo fija.
- **Obligatorias**, como las del padre: es la puerta de entrada, no admite opt-out.
- **Los eventos del test se leen del emisor**, no se escriben a mano: si mañana alguien renombra uno en `email-profesional.ts` sin sembrarlo, el candado cae.

## Riesgos

| Riesgo | Cómo se acota |
|---|---|
| Que se pierda otra vez al agregar un correo nuevo | Candado estático sobre el seed + el guardián `reglas:check` de SPEC-418. |
| Plantilla sin la variable del enlace (correo inútil) | El candado exige que la plantilla nombre las variables que el emisor manda. |
| Que alguien "arregle" quitando el throw | Candado que exige los dos `programadas === 0`. |
