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

export const CORREOS_CANONICOS: readonly CopyCanonico[] = [
    // ── SPEC-922 · familia «alta del colegio» ───────────────────────────────────
    {
        // §1 · Voz usted ya correcta (audiencia SCHOOL_ADMIN); el defecto era la URL pelada.
        clave: "colegio.bienvenida_rector.email",
        canal: "EMAIL",
        asunto: "Su cuenta del colegio está lista",
        cuerpoMarkdown:
            "Hola,\n\n" +
            "La cuenta del **{{nombreColegio}}** quedó creada. Desde aquí protegerá a sus estudiantes, profesores y acudientes.\n\n" +
            "Le faltan unos pocos pasos para terminar de configurarla, y los recorremos juntos. Entre cuando quiera:\n\n" +
            "[Entrar a mi cuenta]({{urlLogin}})",
        variablesSchema: schemaDe("nombreColegio", "urlLogin"),
        cta: { etiqueta: "Entrar a mi cuenta", variable: "urlLogin" },
        fuente: FORMA_ALTA_COLEGIO,
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
