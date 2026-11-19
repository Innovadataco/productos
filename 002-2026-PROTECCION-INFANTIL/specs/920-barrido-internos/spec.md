# SPEC-920 · Barrido de correos · familia interna comité/operador (voz usted + botón)

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-920-barrido-internos`, STACKEADA sobre #940 (SPEC-919) — ambas appendean al mismo registro.
**FORMA:** Diseño · Gestión `7a0c4ae3` · FORMA-BARRIDO-05 (subsume la voz de 920 + agrega botón).
**Deploy + corrector `--confirm` a prod:** los corre el CEO. Seed CREATE-ONLY.

## Qué entra (append al registro único de 922)

6 entradas nuevas con el copy LITERAL de la FORMA; se borró la def vieja de cada clave en `seed.ts`; `variablesSchema`
preservado (contrato no recortado aunque el cuerpo deje de usar una variable).

- `comite.pendientes.alerta.email` — tú→usted · CTA «Ir a la bandeja» → `urlBandeja`.
- `comite.apelaciones.plazo.email` — CTA «Ir a la bandeja de apelaciones» → `urlBandeja`. `{{lineas}}` OPACO.
  ⚖️ **[NORMA]** «15 días hábiles, Ley 1581» LITERAL en el cuerpo (no se reescribe).
- `usuario.bienvenida.comite.email` — tú→usted · credencial · CTA «Entrar a mi cuenta» → `urlLogin`.
- `usuario.bienvenida.operador.email` — tú→usted (fix nuevo) · credencial · CTA «Entrar a mi cuenta» → `urlLogin`.
- `caso.asignado.email` — tú→usted · **SIN URL → sin botón** · saludo QUITA `{{nombre}}` (axis-3: nombre del
  destinatario interno puede traer el correo). `nombre` queda declarada en el schema (paso 7).
- `caso.asignado.in_app` — tú→usted · sin URL.

## Candado de voz (riesgo de Diseño)

`prisma/correos-canonicos-voz.candado.test.ts` (NUEVO): escanea TODO `CORREOS_CANONICOS` y exige cero marcadores de
tuteo (pronombres/posesivos de tú + verbos informales); control positivo dispara con «tú» y calla con usted/impersonal.
Cierra el hueco que señaló Diseño: el candado de voz de SPEC-915 escanea las PANTALLAS del colegio, no el seed de correos.
El candado estructural del registro (922) ya cubre botón + cero URL cruda de las 6 (35/35).

## Fuera de alcance / flags (necesito VEREDICTO)

- **Los 3 correos de análisis (`analisis.anomalia.detectada.email`, `analisis.alerta.admin.email`,
  `analisis.operador.asignacion.email`) NO se migran en este PR.** Viven en bloques de seed BESPOKE (SPEC-225/226, BI)
  con `upsert` que SOBRESCRIBE el cuerpo (no create-only) y schema vacío, y están EMPAREJADOS con su `.in_app` en un
  mismo loop. Migrarlos es un REESTRUCTURE del seed del motor BI (partir el par email/in_app, pasar a create-only), no
  un append. Recomiendo hacerlos en un paso aparte (bucket motor/BI, como `motor.deriva` en la FORMA). **¿Los foldeo
  en 920 o van aparte?**
- **Los 2 `analisis.*.in_app` con URL** se quedan crudos (la campana pinta texto plano — verificado en 919,
  `NotificacionesInbox.tsx:218`): no van al registro (prohíbe URL cruda); voz ya impersonal/OK.
- **NO tocadas** (orden de 920): `expediente.comite.aprobo` (PADRE = tú) y las mixtas/impersonales de
  COMITE_VALIDACION (la neutralidad ya es la solución). `comite.invitacion.enviada` = SPEC-909 (ya con botón).
