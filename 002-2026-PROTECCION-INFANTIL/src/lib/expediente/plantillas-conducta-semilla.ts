/**
 * SPEC-735 · Semilla (defaults en código) de las plantillas deterministas por
 * conducta. Datos PUROS, sin imports: lo comparten `mensaje-padre.ts` (defaults
 * de los builders) y `prisma/seed.ts` (siembra de `ParametroSistema`) — una sola
 * fuente de verdad, editable sin desplegar (SPEC-735 mueve estos textos a param).
 *
 * DOS variantes por audiencia (decisión de Diseño 25-09, doc FORMA-SPEC736 §3/§6):
 *  - PADRE-personalizada (`PLANTILLAS_DEFECTO`): la audiencia se CONOCE (es el
 *    padre viendo el reporte de SU hijo) → «tu hijo o hija», más cálido. Alimenta
 *    `construirExplicacionPadre` («Mis reportes») y el borrador del admin.
 *  - ANÓNIMO-genérica (`REENCUADRE_ANONIMO_DEFECTO`): el rol NO se conoce
 *    (víctima, amigo o testigo) → «la persona afectada». Solo cambia la
 *    `recomendacion` de las CUATRO conductas que decían «tu hijo/el menor»; el
 *    `hallazgo` es común y el resto de conductas ya eran neutrales.
 */

export interface PlantillaConducta {
    hallazgo: string;
    recomendacion: string;
}

export interface PlantillasConducta {
    /** Plantilla de respaldo (conducta desconocida, OTRO, SPAM). */
    generica: PlantillaConducta;
    /** Plantilla específica por categoría de conducta. */
    porConducta: Record<string, PlantillaConducta>;
}

/** Clave lógica de la plantilla genérica dentro del reencuadre anónimo. */
export const CLAVE_GENERICA = "GENERICA";

/**
 * Variante PADRE (personalizada). Textos actuales — NO cambian con SPEC-736: la
 * vista del padre y el borrador del admin conservan «tu hijo».
 */
export const PLANTILLAS_DEFECTO: PlantillasConducta = {
    generica: {
        hallazgo: "señales de una conducta que requiere atención",
        recomendacion: "Habla con tu hijo o hija sobre lo ocurrido y conserva cualquier registro de la conversación.",
    },
    porConducta: {
        COMPARTIMIENTO_SEXUAL: {
            hallazgo: "posibles señales de difusión de contenido sexual",
            recomendacion: "Conserva las capturas o registros disponibles y evita difundir el material, incluso para pedir ayuda.",
        },
        SOLICITUD_MATERIAL: {
            hallazgo: "posibles solicitudes de fotos o videos íntimos dirigidas a un menor",
            recomendacion: "No respondas a la solicitud ni envíes material íntimo, y conserva los mensajes como evidencia.",
        },
        SOLICITUD_ENCUENTRO: {
            hallazgo: "posibles propuestas de encuentro en persona con un desconocido",
            recomendacion: "Evita cualquier encuentro presencial con el contacto y acompaña a tu hijo o hija en el manejo de sus redes.",
        },
        CONTACTO_INSISTENTE: {
            hallazgo: "posible contacto insistente que genera incomodidad",
            recomendacion: "Bloquea el contacto en la plataforma y conserva el registro de los mensajes recibidos.",
        },
        OFRECIMIENTO_REGALOS: {
            hallazgo: "posibles ofrecimientos de regalos, dinero o beneficios a cambio de contacto",
            recomendacion: "Desconfía de ofrecimientos de valor dirigidos a un menor y conversa en casa sobre esta táctica de ganarse la confianza.",
        },
        SUPLANTACION_IDENTIDAD: {
            hallazgo: "posible suplantación de identidad para contactar a un menor",
            recomendacion: "Verifica la identidad del contacto por canales oficiales antes de responder y reporta el perfil en la plataforma.",
        },
        EXTORSION: {
            hallazgo: "posibles señales de extorsión o amenazas",
            recomendacion: "No cedas a las exigencias, conserva todas las evidencias y denuncia de inmediato ante las autoridades.",
        },
        DIFUSION_NO_CONSENTIDA: {
            hallazgo: "posible difusión de imágenes o información sin consentimiento",
            recomendacion: "Solicita el retiro del contenido en la plataforma y conserva las evidencias de la publicación.",
        },
        DOXING: {
            hallazgo: "posible publicación de datos personales (doxing)",
            recomendacion: "Solicita el retiro de los datos en la plataforma y refuerza la privacidad de las cuentas del menor.",
        },
        CONTENIDO_GENERADO_IA: {
            hallazgo: "posible contenido sintético generado con inteligencia artificial",
            recomendacion: "Conserva las evidencias y reporta el contenido en la plataforma donde circula.",
        },
    },
};

/**
 * Variante ANÓNIMO (genérica) — SOLO `recomendacion`, SOLO las cuatro conductas
 * que en la padre decían «tu hijo/el menor». La clave `GENERICA` cubre la
 * plantilla de respaldo (conducta desconocida). El `hallazgo` no cambia. Los
 * textos son de Diseño (FORMA-SPEC736 §3).
 */
export const REENCUADRE_ANONIMO_DEFECTO: Record<string, string> = {
    [CLAVE_GENERICA]: "Conserva cualquier registro de lo ocurrido. Si conoces a la persona afectada, ayúdala a contárselo a un adulto de confianza.",
    SOLICITUD_ENCUENTRO: "Evita cualquier encuentro presencial con ese contacto. Si es un menor, que un adulto de confianza lo acompañe en el manejo de sus redes.",
    OFRECIMIENTO_REGALOS: "Desconfía de ofrecimientos de dinero, regalos o beneficios dirigidos a un menor: es una táctica para ganarse su confianza. Háblalo con la persona afectada o su familia.",
    DOXING: "Solicita el retiro de los datos en la plataforma y refuerza la privacidad de las cuentas de la persona afectada.",
};
