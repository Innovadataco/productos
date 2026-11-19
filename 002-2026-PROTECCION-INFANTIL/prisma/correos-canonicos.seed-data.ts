/**
 * SPEC-922 · REGISTRO ÚNICO de copys canónicos de correos/avisos (clave → copy). EXTENSIBLE.
 *
 * Barrido de correos (Jelkin aprobó los 45): cada FAMILIA del barrido entra APPENDEANDO su(s)
 * entrada(s) a `CORREOS_CANONICOS`. Nada más se toca: los tres consumidores iteran el registro.
 *   - `prisma/seed.ts` → `sembrarCorreosCanonicos(prisma)`, CREATE-ONLY: crea la fila que falta y NO
 *     pisa la existente (el panel admin edita plantillas; un seed que pisara revertiría la edición en
 *     silencio en el próximo deploy).
 *   - `scripts/corregir-correos-canonicos.ts` → el ÚNICO camino del canónico a una fila viva, como acto
 *     deliberado: DRY-RUN lista fila por fila qué difiere (incluida una edición de panel) y
 *     `--confirm` aplica. `--aviso` = detector de deriva que corre al final del deploy (no lo tumba).
 *   - `prisma/correos-canonicos.candado.test.ts` → candado estructural: por CADA entrada, cero URL
 *     cruda; por cada CTA, BOTÓN pintado por el motor (SPEC-909) hacia la variable declarada; un
 *     correo con enlaces y SIN botón solo pasa si declara su exención.
 *
 * CÓMO SE APPENDEA UNA FAMILIA (el candado se pone ROJO si falta un paso):
 *   1. Agregá la entrada acá con el copy LITERAL de la FORMA de Diseño (`fuente` = SHA + SPEC).
 *   2. Borrá la definición vieja de esa clave en `prisma/seed.ts` (`clave: "…"`): el registro es el
 *      ÚNICO que la siembra. Las REGLAS (`plantillaClave`) se quedan donde están.
 *   3. Cero URL CRUDA, sin excepciones: toda `{{url…}}` va dentro de un `[texto](…)`.
 *   4. CTA (acción primaria): `cta = { etiqueta, variable }` y el `[etiqueta]({{variable}})` A SOLAS
 *      en su párrafo (`\n\n` antes; si hay texto después, `\n\n` después). Un `\n` simple = enlace
 *      inline, NO botón. Un enlace SECUNDARIO va inline dentro de la frase (no pide nada más).
 *      La variable del botón va DECLARADA en `variablesSchema` (si la fila de hoy no la tiene, se agrega):
 *      la vista previa del panel admin solo le da valor de muestra a lo declarado.
 *   5. Correo con enlaces y SIN botón (inline a propósito): declará `sinBoton` con su motivo —
 *      `anti-enumeracion` (p. ej. `cuenta_existente`: el aviso no revela si la cuenta existe) o
 *      `seguridad` (enlace incidental de un aviso de seguridad: un botón sobre-dramatiza). Es la
 *      ALLOWLIST: un motivo nuevo es un cambio de `MotivoSinBoton`, que se revisa.
 *   6. Contenido DINÁMICO armado aguas arriba (p. ej. `{{cuerpo}}`/`{{asunto}}` de
 *      `reporte_enriquecido`): listalo en `variablesOpacas`. El candado no le exige forma a ese
 *      contenido, pero SÍ al envoltorio (botón, cero URL cruda), y nunca acepta una URL como opaca.
 *   7. `variablesSchema` se copia TAL CUAL de la fila de hoy: el contrato de variables no se recorta
 *      aunque el cuerpo deje de usar una (la FORMA dice «preservá las variables»).
 *   8. ⚖️ [NORMA]: si el copy es constancia legal, listá sus variables en `constanciaNorma`.
 *   9. Evento DEROGADO (p. ej. `expediente.auto_cerrado_inactividad`, SPEC-340): `derogada: true`.
 *
 * `activa` NO es copy: es estado (un admin desactiva, una SPEC deroga). Nadie del registro ACTIVA una
 * fila existente: el seed no toca filas existentes y el corrector escribe SOLO asunto + cuerpo. Al
 * crear, `activa = !derogada` (una derogada nace inactiva).
 *
 * La VOZ va horneada en el copy (no hay candado de voz acá — eso es SPEC-920): el texto de cada
 * entrada ES la forma aprobada; cambiarlo es cambiar la FORMA, no «mejorar la redacción».
 */
import type { Prisma, PrismaClient } from "@prisma/client";

export type CanalCopy = "EMAIL" | "IN_APP";

export interface CtaCopy {
    /** Texto del botón (lo fija la FORMA de Diseño). */
    etiqueta: string;
    /** Variable `{{url…}}` a la que apunta el botón. */
    variable: string;
}

/** ALLOWLIST cerrada de motivos para un correo con enlaces y sin botón (paso 5). */
export type MotivoSinBoton = "anti-enumeracion" | "seguridad";

export interface ExencionBoton {
    motivo: MotivoSinBoton;
    /** Por qué ESTE correo va inline (lo que decidió la FORMA). */
    nota: string;
}

export interface CopyCanonico {
    /** Clave de la plantilla (no se cambia). */
    clave: string;
    canal: CanalCopy;
    /** Solo EMAIL. IN_APP (campana) va sin asunto. */
    asunto?: string;
    cuerpoMarkdown: string;
    /** Contrato de variables — se siembra TAL CUAL (ver paso 5). */
    variablesSchema: Record<string, unknown>;
    /** El botón del correo, o `null` si no lleva (IN_APP nunca lleva). */
    cta: CtaCopy | null;
    /** Exención del botón: correo con enlaces inline a propósito (paso 5). Excluye `cta`. */
    sinBoton?: ExencionBoton;
    /** Variables con contenido DINÁMICO armado aguas arriba: sin exigencia de forma (paso 6). */
    variablesOpacas?: readonly string[];
    /**
     * ⚖️ [NORMA] Variables que SON la constancia legal (el hecho jurídico): deben quedar en el cuerpo.
     * Quitar una cruza la frontera legal aunque «mejore la redacción».
     */
    constanciaNorma?: readonly string[];
    /** Evento DEROGADO: la plantilla nace INACTIVA (paso 9). */
    derogada?: true;
    /** Trazabilidad: FORMA de Diseño (SHA de Gestión) + SPEC. No lo usa el código. */
    fuente: string;
}

/** `variablesSchema` de strings, en el formato que ya usan las plantillas sembradas. */
function schemaDe(...variables: string[]): Record<string, unknown> {
    return { type: "object", properties: Object.fromEntries(variables.map((v) => [v, { type: "string" }])) };
}

const FORMA_ALTA_COLEGIO =
    "Diseño · Gestión bb6384eb · FORMA-BOTON-Y-VOZ-CORREOS-ALTA-COLEGIO-2026-11-18 · SPEC-922";
const FORMA_AUTH = "Diseño · Gestión a8a983e1 · FORMA-BARRIDO-01-FAMILIA-AUTH v1.1 · SPEC-923";
const FORMA_BARRIDO_COLEGIO = "Diseño · Gestión 9b3ddbeb · FORMA-BARRIDO-03-FAMILIA-COLEGIO-2026-11-18 · SPEC-919";

const FORMA_BIENVENIDA_FUSIONADA =
    "Diseño · Gestión c540eeac · FORMA-ONBOARDING-COLEGIO-CORREOS-Y-PASOS-2026-11-20 §A · SPEC-955";

export const CORREOS_CANONICOS: readonly CopyCanonico[] = [
    // ── SPEC-922 · familia «alta del colegio» ───────────────────────────────────
    {
        // SPEC-955 · FUSIONADO (bienvenida + recibo de aceptación), voz usted. Antes era la
        // «bienvenida al crear la contraseña» (SPEC-922, botón a login); ahora la dispara la
        // PRIMERA aceptación de la Política del rector (bifurcación por rol en consentimiento.ts),
        // así que el botón va al PANEL (ya autenticado) y el cuerpo lleva la constancia [NORMA]
        // versión+fecha. El `consentimiento.aceptado` compartido NO se envía al rol colegio.
        // ⚠️ Esta plantilla la RENDERIZA la 2.ª ola: el cuerpo-botón-vivo recién aplica cuando el
        // corrector de la ola la actualice; hasta entonces el envío manda `urlLogin=urlPanel`
        // para que la plantilla viva (vieja) no deje el botón roto (email-colegio.ts).
        clave: "colegio.bienvenida_rector.email",
        canal: "EMAIL",
        asunto: "Su cuenta de {{nombreColegio}} está lista",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "La cuenta de **{{nombreColegio}}** quedó lista. Desde aquí protegerá a sus estudiantes, profesores y acudientes.\n\n" +
            "Dejamos registrada su aceptación de la versión {{version}} de los términos de tratamiento de datos personales, el {{fechaAceptacion}}.\n\n" +
            "Entre a su panel cuando quiera:\n\n" +
            "[Entrar a mi panel]({{urlPanel}})",
        variablesSchema: schemaDe("nombreColegio", "version", "fechaAceptacion", "urlPanel"),
        cta: { etiqueta: "Entrar a mi panel", variable: "urlPanel" },
        constanciaNorma: ["version", "fechaAceptacion"],
        fuente: FORMA_BIENVENIDA_FUSIONADA,
    },
    {
        // §2 · COMPARTIDA: el evento dispara para todo el que acepta términos (el motor NO filtra
        // por rol, SPEC-247) → voz IMPERSONAL. Saludo «Hola,» SIN `{{nombreUsuario}}`: hoy esa
        // variable puede traer el CORREO del usuario; queda DECLARADA en el schema, solo no se usa.
        // ⚖️ [NORMA] La constancia = versión + fecha (`{{version}}`, `{{fechaAceptacion}}`). Esta
        // redacción impersonal queda FIJA hasta que entre la cadena del abogado: no se reescribe libre.
        clave: "consentimiento.aceptado.email",
        canal: "EMAIL",
        asunto: "Confirmación de aceptación de términos",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Confirmamos la aceptación de la versión {{version}} de los términos de tratamiento de datos personales, registrada el {{fechaAceptacion}}.\n\n" +
            "Para consultar el expediente y la configuración:\n\n" +
            "[Ir al panel]({{urlDashboard}})",
        variablesSchema: schemaDe("nombreUsuario", "version", "fechaAceptacion", "urlDashboard"),
        cta: { etiqueta: "Ir al panel", variable: "urlDashboard" },
        constanciaNorma: ["version", "fechaAceptacion"],
        fuente: FORMA_ALTA_COLEGIO,
    },
    {
        // §4 · Hermana IN_APP (campana): misma audiencia compartida → impersonal, sin botón ni
        // saludo. Conserva `{{version}}` (dato de la constancia [NORMA]; la fecha vive en el correo).
        clave: "consentimiento.aceptado.in_app",
        canal: "IN_APP",
        cuerpoMarkdown:
            "Se registró la aceptación de los términos de tratamiento de datos personales (versión {{version}}).",
        variablesSchema: schemaDe("nombreUsuario", "version", "fechaAceptacion", "urlDashboard"),
        cta: null,
        constanciaNorma: ["version"],
        fuente: FORMA_ALTA_COLEGIO,
    },

    // ── SPEC-923 · familia `auth.*` (FORMA-BARRIDO-01 v1.1) ───────────────────────
    // Voz horneada por audiencia: COMPARTIDA = impersonal · padre = tú · profesional = usted.
    // Ninguna saluda con `{{nombre*}}` (riesgo nombre=correo: no aplica a esta familia).
    {
        // §1 · Compartida (verificación genérica de correo) → impersonal. Sin URL, sin botón.
        clave: "auth.codigo_verificacion.email",
        canal: "EMAIL",
        asunto: "Código de verificación",
        cuerpoMarkdown: "El código de verificación es: {{codigo}}\n\nVálido por 15 minutos.",
        variablesSchema: schemaDe("codigo"),
        cta: null,
        fuente: FORMA_AUTH,
    },
    {
        // §2 · Compartida → impersonal + BOTÓN. `url` no estaba declarada: se declara (el emisor ya la pasa).
        clave: "auth.password_recuperacion.email",
        canal: "EMAIL",
        asunto: "Restablecer la contraseña",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Recibimos una solicitud para restablecer la contraseña de esta cuenta.\n\n" +
            "Para crear una nueva:\n\n" +
            "[Restablecer la contraseña]({{url}})\n\n" +
            "El enlace vence en 1 hora y solo se puede usar una vez. Si no se solicitó este cambio, no hay que hacer nada.",
        variablesSchema: schemaDe("url"),
        cta: { etiqueta: "Restablecer la contraseña", variable: "url" },
        fuente: FORMA_AUTH,
    },
    {
        // §3 · COMPARTIDA: la emiten 3 puertas (registro padre, registro profesional y verificar;
        // `enviarEmailCuentaExistente`) → impersonal. Enlaces INLINE a propósito: el aviso no revela nada.
        clave: "auth.cuenta_existente.email",
        canal: "EMAIL",
        asunto: "Ya existe una cuenta con este correo",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Alguien intentó crear una cuenta con este correo, pero ya existe una cuenta asociada a él.\n\n" +
            "Para ingresar: [iniciar sesión]({{urlLogin}}). Para restablecer la clave: [recuperar la contraseña]({{urlRecuperar}}).\n\n" +
            "Si no hubo ninguna solicitud, no hay que hacer nada: la cuenta está segura.",
        variablesSchema: schemaDe("urlLogin", "urlRecuperar"),
        cta: null,
        sinBoton: { motivo: "anti-enumeracion", nota: "aviso de cuenta existente: no revela nada más allá del buzón" },
        fuente: FORMA_AUTH,
    },
    {
        // §4 · Padre → tú + BOTÓN.
        clave: "auth.registro_enlace.email",
        canal: "EMAIL",
        asunto: "Crea tu contraseña y empecemos",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Estás para cuidarlos. Nosotros, para avisarte.\n\n" +
            "Abre este enlace y crea tu contraseña:\n\n" +
            "[Crear mi contraseña]({{url}})\n\n" +
            "El enlace vence en 24 horas y solo se puede usar una vez.\n\n" +
            "Si no fuiste tú quien lo pidió, no tienes que hacer nada.",
        variablesSchema: schemaDe("url"),
        cta: { etiqueta: "Crear mi contraseña", variable: "url" },
        fuente: FORMA_AUTH,
    },
    {
        // §5 · Padre → tú + BOTÓN.
        clave: "auth.bienvenida_padre.email",
        canal: "EMAIL",
        asunto: "Tu cuenta está lista",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Tu cuenta quedó creada. Desde acá te avisamos si alguno de los tuyos aparece en un reporte.\n\n" +
            "Te faltan unos pocos pasos para terminar de configurarla. Con calma, toma un minuto. Entra cuando quieras:\n\n" +
            "[Entrar a mi cuenta]({{urlLogin}})",
        variablesSchema: schemaDe("urlLogin"),
        cta: { etiqueta: "Entrar a mi cuenta", variable: "urlLogin" },
        fuente: FORMA_AUTH,
    },
    {
        // §6 · Profesional → USTED (era tú) + BOTÓN. Puerta del profesional (SPEC-419).
        clave: "auth.registro_enlace_profesional.email",
        canal: "EMAIL",
        asunto: "Cree su contraseña y empecemos",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Gracias por querer sumarse a la red de profesionales de Protección Infantil.\n\n" +
            "Abra este enlace y cree su contraseña:\n\n" +
            "[Crear mi contraseña]({{url}})\n\n" +
            "El enlace vence en 24 horas y solo se puede usar una vez.\n\n" +
            "Si no fue usted quien lo pidió, no tiene que hacer nada.",
        variablesSchema: schemaDe("url"),
        cta: { etiqueta: "Crear mi contraseña", variable: "url" },
        fuente: FORMA_AUTH,
    },
    {
        // §7 · Profesional → USTED (era tú). Primaria = completar perfil (BOTÓN); login = secundario (inline).
        clave: "auth.bienvenida_profesional.email",
        canal: "EMAIL",
        asunto: "Su cuenta está lista — falta un paso",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Su cuenta quedó creada.\n\n" +
            "Para aparecer en el directorio de familias, complete su perfil y suba la autorización firmada. Hasta ese momento su perfil queda en borrador y no llega a revisión:\n\n" +
            "[Completar mi perfil]({{urlCompletarPerfil}})\n\n" +
            "También puede [entrar a su cuenta]({{urlLogin}}) cuando quiera.",
        variablesSchema: schemaDe("urlLogin", "urlCompletarPerfil"),
        cta: { etiqueta: "Completar mi perfil", variable: "urlCompletarPerfil" },
        fuente: FORMA_AUTH,
    },
    {
        // §8 · COMPARTIDA (rol ALL; le llegaba en tú al rector) → impersonal. Enlace de seguridad INLINE
        // (incidental, no CTA). `fechaHora`/`urlRecuperar` no estaban declaradas: se declaran.
        clave: "auth.password_cambiada.email",
        canal: "EMAIL",
        asunto: "Cambio de contraseña — {{fechaHora}}",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "La contraseña de esta cuenta en Protección Infantil se cambió el **{{fechaHora}}** (hora de Colombia).\n\n" +
            "Si el cambio fue esperado, no hay que hacer nada.\n\n" +
            "Si no se reconoce, conviene recuperar el acceso de inmediato y escribir a soporte: [recuperar el acceso]({{urlRecuperar}}).\n\n" +
            "Este es un mensaje automático de seguridad. No contiene la contraseña ni enlaces de sesión.",
        variablesSchema: schemaDe("fechaHora", "urlRecuperar"),
        cta: null,
        sinBoton: { motivo: "seguridad", nota: "confirmación de rutina: un botón grande sobre-dramatiza; el enlace es incidental" },
        fuente: FORMA_AUTH,
    },
    {
        // §9 (addendum v1.2) · COMPARTIDA (código SPEC-598 para cuenta OAuth que crea su clave; cualquier
        // rol) → impersonal. Es un CÓDIGO: sin URL, sin botón, sin saludo (igual que codigo_verificacion).
        clave: "auth.crear_password.codigo.email",
        canal: "EMAIL",
        asunto: "Código para crear la contraseña",
        cuerpoMarkdown:
            "El código para crear la contraseña de esta cuenta es:\n\n" +
            "{{codigo}}\n\n" +
            "Vence en {{vigenciaMinutos}} minutos. Si no se solicitó, se puede ignorar este correo: la cuenta seguirá entrando con Google.",
        variablesSchema: schemaDe("codigo", "vigenciaMinutos"),
        cta: null,
        fuente: FORMA_AUTH,
    },
    // ── SPEC-919 · familia «colegio.*» (FORMA-BARRIDO-03) ───────────────────────
    {
        // §1 · usted (OK). Tono recomendación, NO orden (SPEC-380). CTA «Abrir el caso».
        clave: "colegio.comite.recomendacion_informe.email",
        canal: "EMAIL",
        asunto: "El comité de convivencia recomienda emitir el informe del caso {{numeroCaso}}",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "El Comité de Convivencia de **{{nombreColegio}}** revisó el caso **{{numeroCaso}}** y le recomienda emitir el informe firmado.\n\n" +
            "Esto es una recomendación — la decisión y la firma siguen siendo suyas.\n\n" +
            "Abra el caso y revise el análisis del comité antes de emitir:\n\n" +
            "[Abrir el caso]({{urlCaso}})",
        variablesSchema: schemaDe("nombreColegio", "numeroCaso", "urlCaso"),
        cta: { etiqueta: "Abrir el caso", variable: "urlCaso" },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // §2 · tú → usted (le llega al rector). CTA «Ir a mi panel». El aviso NO trae datos del reporte.
        clave: "colegio.reporte_nuevo.email",
        canal: "EMAIL",
        asunto: "Le avisamos: tiene un reporte nuevo para revisar",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Le avisamos que llegó un reporte nuevo relacionado con su colegio. Ingrese a su panel para revisarlo:\n\n" +
            "[Ir a mi panel]({{urlAlertas}})\n\n" +
            "Este aviso no incluye datos del reporte; toda la información está en su panel.",
        variablesSchema: schemaDe("urlAlertas"),
        cta: { etiqueta: "Ir a mi panel", variable: "urlAlertas" },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // §3 · tú → usted. CTA «Ir a mi panel». Conteos, sin nombres ni datos.
        clave: "colegio.curso.umbral.email",
        canal: "EMAIL",
        asunto: "Le avisamos: un curso de su colegio acumula reportes",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Le avisamos que un curso de su colegio acumula {{reportes}} reportes en los últimos {{dias}} días. Ingrese a su panel para ver el panorama completo:\n\n" +
            "[Ir a mi panel]({{urlPanel}})\n\n" +
            "Este aviso no incluye nombres ni datos de los reportes; toda la información está en su panel.",
        variablesSchema: schemaDe("reportes", "dias", "urlPanel"),
        cta: { etiqueta: "Ir a mi panel", variable: "urlPanel" },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // §4 · tú → usted. CTA «Ir a mi panel». Sin el nombre del estudiante.
        clave: "colegio.estudiante.repetido.email",
        canal: "EMAIL",
        asunto: "Le avisamos: un estudiante de su colegio acumula reportes",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Le avisamos que un estudiante de su colegio acumula {{reportes}} reportes en los últimos {{dias}} días. Ingrese a su panel para revisar el caso:\n\n" +
            "[Ir a mi panel]({{urlAlertas}})\n\n" +
            "Este aviso no incluye el nombre del estudiante ni datos de los reportes; toda la información está en su panel.",
        variablesSchema: schemaDe("reportes", "dias", "urlAlertas"),
        cta: { etiqueta: "Ir a mi panel", variable: "urlAlertas" },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // §5 · tú → usted. CTA «Ir a mi panel». `{{cuerpo}}` = conteos armados aguas arriba (OPACO).
        clave: "colegio.resumen_semanal.email",
        canal: "EMAIL",
        asunto: "Su resumen de la semana",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "{{cuerpo}}\n\n" +
            "Ingrese a su panel para ver el detalle:\n\n" +
            "[Ir a mi panel]({{urlPanel}})\n\n" +
            "Este resumen solo muestra conteos; toda la información está en su panel.",
        variablesSchema: schemaDe("cuerpo", "urlPanel"),
        cta: { etiqueta: "Ir a mi panel", variable: "urlPanel" },
        variablesOpacas: ["cuerpo"],
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // §6 · usted (OK). CTA «Ir a mi panel».
        clave: "colegio.alerta.pendientes.email",
        canal: "EMAIL",
        asunto: "Tiene {{novedadTexto}} para revisar en su panel de colegio",
        cuerpoMarkdown:
            "Tiene {{novedadTexto}} para revisar en su panel de colegio. Ingrese y valide:\n\n" +
            "[Ir a mi panel]({{urlAlertas}})",
        variablesSchema: schemaDe("novedadTexto", "urlAlertas"),
        cta: { etiqueta: "Ir a mi panel", variable: "urlAlertas" },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // §8 · tú → usted · credenciales. CTA «Entrar a mi cuenta». VIVO (api/admin/colegios · reenviar-email,
        // evento `colegio.creado`). `Hola {{nombreColegio}}` = nombre del colegio (no correo) → saludo seguro.
        clave: "colegio.creado.email",
        canal: "EMAIL",
        asunto: "Su cuenta institucional en Protección Infantil está lista",
        cuerpoMarkdown:
            "Hola {{nombreColegio}},\n\n" +
            "Se registró su institución en Protección Infantil.\n\n" +
            "**Acceso inicial**\n" +
            "- Usuario: {{emailAdmin}}\n" +
            "- Contraseña temporal: {{passwordTemporal}}\n\n" +
            "Para entrar y cambiar su contraseña cuanto antes:\n\n" +
            "[Entrar a mi cuenta]({{urlLogin}})\n\n" +
            "Si no solicitó este registro, contáctenos de inmediato.",
        variablesSchema: schemaDe("nombreColegio", "emailAdmin", "passwordTemporal", "urlLogin"),
        cta: { etiqueta: "Entrar a mi cuenta", variable: "urlLogin" },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // EXENTA anti-enumeración (FORMA): aviso de seguridad que NO revela si la cuenta existe. Los dos
        // enlaces (login / recuperar) van INLINE en la frase — NO un CTA (un botón lo convertiría en acción).
        clave: "colegio.registro_enlace.cuenta_existente.email",
        canal: "EMAIL",
        asunto: "Ya existe una cuenta con este correo",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Alguien intentó crear una cuenta del colegio **{{nombreColegio}}** con su correo. Su cuenta ya existe.\n\n" +
            "Si fue usted quien intentó, [ingrese a su cuenta]({{urlLogin}}); si olvidó su contraseña, puede [recuperarla]({{urlRecuperar}}).\n\n" +
            "Si no fue usted, no tiene que hacer nada.",
        variablesSchema: schemaDe("nombreColegio", "urlRecuperar", "urlLogin"),
        cta: null,
        sinBoton: {
            motivo: "anti-enumeracion",
            nota: "El aviso no confirma si la cuenta existe; los enlaces de login y recuperación van inline, sin CTA.",
        },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
    {
        // EXENTA anti-enumeración (FORMA): el aviso de NIT ya registrado no revela más; el enlace de soporte
        // va INLINE en la frase, sin CTA.
        clave: "colegio.registro_enlace.nit_ya_registrado.email",
        canal: "EMAIL",
        asunto: "Alguien intentó registrar su colegio",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "Alguien intentó registrar el NIT **{{nit}}** en Protección Infantil, y ese NIT ya está a su nombre.\n\n" +
            "Si fue usted quien intentó desde otro correo, [escríbanos a soporte]({{urlSoporte}}).\n\n" +
            "Si no fue usted, no tiene que hacer nada.",
        variablesSchema: schemaDe("nit", "urlSoporte"),
        cta: null,
        sinBoton: {
            motivo: "anti-enumeracion",
            nota: "Aviso anti-enumeración (NIT ya a su nombre); el enlace de soporte va inline, sin CTA.",
        },
        fuente: FORMA_BARRIDO_COLEGIO,
    },
];

/**
 * Siembra del registro — CREATE-ONLY (VEREDICTO CEO 19-11). Crea la fila que FALTA con su copy canónico
 * (`activa = !derogada`) y NO TOCA una fila existente: las plantillas se editan desde el panel admin
 * (con AuditLog), y un seed que pisara revertiría esa edición EN SILENCIO en el próximo deploy — el
 * panel ofrecería «Editar» y mentiría. Lo canónico llega a una fila viva SOLO por el corrector
 * (`scripts/corregir-correos-canonicos.ts --confirm`), como acto deliberado.
 *
 * Recibe el cliente (el seed le pasa `prisma`): así el candado prueba la CONDUCTA con una base falsa.
 */
export async function sembrarCorreosCanonicos(
    db: Pick<PrismaClient, "notificacionPlantilla">,
    registro: readonly CopyCanonico[] = CORREOS_CANONICOS
): Promise<{ creadas: string[]; existentes: string[] }> {
    const creadas: string[] = [];
    const existentes: string[] = [];
    for (const c of registro) {
        if (await db.notificacionPlantilla.findUnique({ where: { clave: c.clave } })) {
            existentes.push(c.clave); // NO se toca: ni copy, ni activa, ni version.
            continue;
        }
        await db.notificacionPlantilla.create({
            data: {
                clave: c.clave,
                canal: c.canal,
                asunto: c.asunto ?? null,
                cuerpoMarkdown: c.cuerpoMarkdown,
                variablesSchema: c.variablesSchema as Prisma.InputJsonValue,
                activa: !c.derogada,
            },
        });
        creadas.push(c.clave);
    }
    return { creadas, existentes };
}
