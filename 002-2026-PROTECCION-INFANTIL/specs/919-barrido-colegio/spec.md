# SPEC-919 · Barrido de correos · familia `colegio.*` (botón + voz usted)

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-919-barrido-colegio` desde `origin/main` (67cffcb8, con el registro de SPEC-922).
**FORMA:** Diseño · Gestión `9b3ddbeb` · FORMA-BARRIDO-03-FAMILIA-COLEGIO. Toda la audiencia es SCHOOL_ADMIN → usted (D-107).
**Deploy + corrector `--confirm` a prod:** los corre el CEO. Seed CREATE-ONLY.

## Qué entra (append al REGISTRO ÚNICO de 922 `prisma/correos-canonicos.seed-data.ts`)

9 entradas nuevas con el copy LITERAL de la FORMA; se borró la definición vieja de cada clave en `prisma/seed.ts`
(el registro es el único que las siembra). `variablesSchema` preservado; el corrector y el candado iteran el registro.

**7 EMAIL con botón (6 son fix de voz tú→usted — le llegan al rector):**
- `colegio.comite.recomendacion_informe.email` — CTA «Abrir el caso» → `urlCaso` (ya usted; tono recomendación, SPEC-380).
- `colegio.reporte_nuevo.email` — CTA «Ir a mi panel» → `urlAlertas` (tú→usted).
- `colegio.curso.umbral.email` — CTA «Ir a mi panel» → `urlPanel` (tú→usted).
- `colegio.estudiante.repetido.email` — CTA «Ir a mi panel» → `urlAlertas` (tú→usted).
- `colegio.resumen_semanal.email` — CTA «Ir a mi panel» → `urlPanel` (tú→usted). `{{cuerpo}}` = OPACO (conteos aguas arriba).
- `colegio.alerta.pendientes.email` — CTA «Ir a mi panel» → `urlAlertas` (ya usted).
- `colegio.creado.email` — CTA «Entrar a mi cuenta» → `urlLogin` (tú→usted · credenciales). VIVO (evento `colegio.creado`).

**2 EMAIL EXENTOS (anti-enumeración · enlaces INLINE, sin botón):**
- `colegio.registro_enlace.cuenta_existente.email` — login + recuperar inline (2 enlaces condicionales).
- `colegio.registro_enlace.nit_ya_registrado.email` — soporte inline.

## Qué NO entra (decisiones verificadas)

- **`colegio.comite.recomendacion_informe.in_app`** — NO se migra. La campana renderiza TEXTO PLANO
  (`NotificacionesInbox.tsx:218` pinta `{{mensaje}}` escapado, sin markdown ni linkify), así que un `[texto](url)`
  mostraría markdown literal; por FORMA §9, con texto plano la URL cruda se queda (el candado de email no rige la
  campana, y el registro prohíbe URL cruda → no va al registro). La voz ya es usted. No hay nada que arreglar.
- **`colegio.bienvenida.email`** — ORFANA confirmada: NO existe el evento `colegio.bienvenida` ni una regla que la
  dispare (emisores reales: `colegio.creado` y `colegio.bienvenida_rector`). Es resto del piloto SPEC-204. No se migra
  ni se pule (sigue en `seed.ts`, voz vieja, inofensiva porque nunca se envía). **Recomendación:** retirar su fila en
  una limpieza de datos aparte (no es copy; fuera del carril de 919). No se fusionó con `creado` (FORMA: «no es mi carril»).
- Reconciliadas (ya resueltas, NO duplicadas): `registro_enlace.email` (918), `bienvenida_rector` (922),
  `invitacion.enviada` (909).

## Candados

El registro de 922 ya trae el candado estructural `prisma/correos-canonicos.candado.test.ts` (cero URL cruda; CTA →
botón del motor hacia su variable; exención declarada para los inline). Las 9 entradas nuevas pasan (29/29). No hay
candado nuevo: el de 922 cubre cada entrada del registro por construcción.
