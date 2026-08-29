/**
 * Sets de preguntas de la rúbrica por categoría (spec 090).
 * Preguntas ESTRICTAS (indicadores factuales del texto): 1 solo con evidencia CLARA.
 * Se siembran en ParametroSistema (`ia.rubrica.preguntas`); los expertos las refinan
 * desde el tab "Rúbrica" sin desplegar código (ADR_004).
 */

export type TipoPregunta = "decisiva" | "contexto";

export interface PreguntaRubrica {
    texto: string;
    activo: boolean;
    /**
     * Spec 092-US1: DECISIVA = núcleo de la conducta (obligatoria: todas deben
     * cumplirse para marcar 1). CONTEXTO = suma al análisis pero NO bloquea.
     * Al leer parámetros antiguos sin `tipo`, se asume "contexto" (tolerancia).
     */
    tipo?: TipoPregunta;
}

export type SetsRubrica = Record<string, PreguntaRubrica[]>;

export const RUBRICA_SEMILLA: SetsRubrica = {
    COMPARTIMIENTO_SEXUAL: [
        { texto: "¿El texto describe que alguien compartió o envió contenido sexual?", activo: true, tipo: "decisiva" },
        { texto: "¿El contenido es explícitamente sexual (no solo sugerente o romántico)?", activo: true, tipo: "decisiva" },
        { texto: "¿La persona afectada o involucrada es menor de edad?", activo: true },
        { texto: "¿La acción de compartir o enviar está presente en el texto (no solo mencionada)?", activo: true },
    ],
    SOLICITUD_MATERIAL: [
        { texto: "¿Alguien pide fotos, videos o material visual a otra persona?", activo: true, tipo: "decisiva" },
        { texto: "¿El material pedido es íntimo, del cuerpo o de contenido sexual?", activo: true, tipo: "decisiva" },
        { texto: "¿La persona a quien se le pide es menor de edad?", activo: true },
        { texto: "¿Quien pide es un adulto o un desconocido?", activo: true },
    ],
    SOLICITUD_ENCUENTRO: [
        { texto: "¿Alguien propone verse o encontrarse en persona?", activo: true, tipo: "decisiva" },
        { texto: "¿La propuesta viene de un adulto o un desconocido?", activo: true },
        { texto: "¿Involucra a un menor de edad?", activo: true },
        { texto: "¿La propuesta insiste a pesar de excusas o falta de respuesta?", activo: true },
    ],
    CONTACTO_INSISTENTE: [
        { texto: "¿Hay mensajes o llamadas repetidas a pesar de no recibir respuesta?", activo: true, tipo: "decisiva" },
        // Spec 098 (targeting): distingue acoso interpersonal de spam/publicidad masiva.
        // Corta y afirmativa: las preguntas largas/compuestas no se copian verbatim y matan la categoría.
        { texto: "¿El contacto es personal y dirigido específicamente a este menor?", activo: true, tipo: "decisiva" },
        { texto: "¿La insistencia genera incomodidad o miedo descrito en el texto?", activo: true },
        { texto: "¿El contacto proviene de un desconocido o de alguien mayor?", activo: true },
        { texto: "¿Continúa el contacto a pesar de pedirle que pare o de bloquearlo?", activo: true },
    ],
    OFRECIMIENTO_REGALOS: [
        { texto: "¿Se ofrece algo de valor (dinero, regalos, recargas, skins, ropa)?", activo: true, tipo: "decisiva" },
        // SPEC-199: evitar que publicidad masiva/estafa entre como acoso interpersonal.
        { texto: "¿El mensaje se dirige a UN individuo específico (por nombre, situación o contexto único), NO como una campaña masiva o mensaje genérico?", activo: true, tipo: "decisiva" },
        { texto: "¿El ofrecimiento viene de un adulto o un desconocido?", activo: true },
        { texto: "¿Va dirigido a un menor de edad?", activo: true },
        { texto: "¿Se ofrece a cambio de algo o para ganar la confianza del menor?", activo: true },
    ],
    SPAM: [
        { texto: "¿El texto ofrece dinero, premios, sorteos o beneficios sin víctima concreta identificable?", activo: true, tipo: "decisiva" },
        { texto: "¿Incluye URLs, teléfonos o cuentas para reclamar/visitar/contactar comercialmente?", activo: true, tipo: "decisiva" },
        { texto: "¿Usa lenguaje de urgencia comercial (cupos limitados, solo 24h, ya!!!, felicitaciones)?", activo: true },
        { texto: "¿Describe una situación masiva/genérica en vez de un incidente con víctima e involucrado identificables?", activo: true },
        { texto: "¿El propósito principal es vender/promover/estafar, no reportar peligro contra un menor?", activo: true, tipo: "decisiva" },
    ],
    SUPLANTACION_IDENTIDAD: [
        { texto: "¿Alguien se hace pasar por otra persona o entidad (nombre, fotos, cargo)?", activo: true, tipo: "decisiva" },
        { texto: "¿La identidad usada es falsa o robada?", activo: true },
        { texto: "¿La suplantación se usa para contactar o ganarse a un menor?", activo: true },
        { texto: "¿El texto da evidencia concreta de la farsa (perfil falso, datos que no coinciden)?", activo: true },
    ],
    EXTORSION: [
        { texto: "¿Hay una amenaza o presión explícita en el texto?", activo: true, tipo: "decisiva" },
        { texto: "¿Se exige algo (dinero, fotos, acceso, favores) a cambio de no divulgar o no dañar?", activo: true, tipo: "decisiva" },
        { texto: "¿La amenaza involucra publicar contenido o hacer daño a la víctima o su familia?", activo: true },
        { texto: "¿La víctima es menor de edad?", activo: true },
    ],
    CONTENIDO_GENERADO_IA: [
        { texto: "¿El contenido fue creado o alterado con inteligencia artificial (deepfake, montaje)?", activo: true, tipo: "decisiva" },
        { texto: "¿El contenido representa a una persona real e identificable?", activo: true },
        { texto: "¿El contenido es íntimo o sexual?", activo: true },
        { texto: "¿La persona representada es menor de edad?", activo: true },
    ],
    DIFUSION_NO_CONSENTIDA: [
        { texto: "¿Se compartió contenido privado de alguien sin su permiso?", activo: true, tipo: "decisiva" },
        { texto: "¿La persona afectada NO autorizó su difusión?", activo: true },
        { texto: "¿El contenido es íntimo, sensible o de la vida privada?", activo: true },
        { texto: "¿La difusión fue a terceros (grupos, contactos, redes)?", activo: true },
    ],
    DOXING: [
        { texto: "¿Se publican datos personales (dirección, teléfono, colegio, ubicación)?", activo: true, tipo: "decisiva" },
        { texto: "¿La publicación busca exponer a la persona o facilitar su localización?", activo: true },
        { texto: "¿Los datos pertenecen a un menor de edad?", activo: true },
        { texto: "¿Los datos se compartieron sin autorización del afectado?", activo: true },
    ],
    // SPEC-248 (002-PI-151): Ley 2564 de 2026 art. 6 · preguntas redactadas por el
    // asesor CEO (brief §5.2), copiadas literal — no se parafrasean.
    CIBERACOSO: [
        { texto: "¿Hay comportamientos repetidos de hostigamiento, intimidación o burla hacia una persona específica?", activo: true, tipo: "decisiva" },
        { texto: "¿La intención descrita es humillar, ridiculizar o excluir socialmente a la víctima (no obtener contenido sexual ni dinero)?", activo: true, tipo: "decisiva" },
        { texto: "¿La víctima es menor de edad?", activo: true },
        { texto: "¿Involucra a compañeros de colegio, curso o grupo social del menor?", activo: true },
        { texto: "¿Los ataques ocurrieron en redes sociales, grupos de chat, comentarios públicos o mensajes directos?", activo: true },
    ],
    HAPPY_SLAPPING: [
        { texto: "¿El texto describe la grabación de una agresión (física, verbal o sexual) hacia una persona?", activo: true, tipo: "decisiva" },
        { texto: "¿La grabación se difundió o se está difundiendo por redes, chats o plataformas digitales?", activo: true, tipo: "decisiva" },
        { texto: "¿La víctima es menor de edad?", activo: true },
        { texto: "¿La víctima es identificable en la grabación (cara, nombre, contexto)?", activo: true },
        { texto: "¿La grabación busca burla, viralización o humillación pública?", activo: true },
    ],
    STALKING: [
        { texto: "¿El texto describe un patrón obsesivo de acoso o vigilancia digital hacia una persona (seguimiento de cuentas, monitoreo, contactos reiterados)?", activo: true, tipo: "decisiva" },
        { texto: "¿La conducta busca causar miedo, incomodidad o control sobre la víctima (no obtener contenido sexual ni dinero)?", activo: true, tipo: "decisiva" },
        { texto: "¿La víctima es menor de edad?", activo: true },
        { texto: "¿El acosador continúa a pesar de bloqueos, cambios de cuenta o pedidos de que pare?", activo: true },
        { texto: "¿Hay señales de que el acosador conoce datos privados de la víctima (ubicación, rutina, contactos)?", activo: true },
    ],
};

export const CATEGORIAS_RUBRICA = Object.keys(RUBRICA_SEMILLA);

/**
 * Fundamento legal por categoría (spec 248 / 002-PI-151). Fuente de verdad
 * REDACTADA por el asesor CEO (brief F-COL-4 §6) — el código solo la carga,
 * cero paráfrasis. El valor vivo lo maneja `ParametroSistema.ia.rubrica.definiciones`;
 * esta constante es el fallback confiable si el parámetro aún no existe.
 */
export type DefinicionCategoria = {
    conductaLegal: string;
    definicionLiteral: string;
    referenciaNormativa: string;
    /** Solo para categorías que comparten una misma conducta legal (ej. grooming). */
    rolDentroDeConducta?: string;
};

const DEFINICION_GROOMING = {
    conductaLegal: "Grooming",
    definicionLiteral:
        "Conducta realizada por un mayor de edad que, intencionalmente y haciéndose pasar por un igual, engaña a un menor de edad con la finalidad de generar confianza para solicitar fotos o videos de contenido sexual, para exigir dinero o para concretar un encuentro personal.",
    referenciaNormativa: "Ley 2564 de 2026 · art. 6.a",
};

export const DEFINICIONES_CATEGORIA: Record<string, DefinicionCategoria> = {
    CONTACTO_INSISTENTE: { ...DEFINICION_GROOMING, rolDentroDeConducta: "Vía de acceso · contacto reiterado que abre la relación" },
    SOLICITUD_MATERIAL: { ...DEFINICION_GROOMING, rolDentroDeConducta: "Etapa avanzada · pedir fotos/videos íntimos al menor" },
    OFRECIMIENTO_REGALOS: { ...DEFINICION_GROOMING, rolDentroDeConducta: "Gancho · regalos/dinero/beneficios para ganar confianza" },
    SUPLANTACION_IDENTIDAD: { ...DEFINICION_GROOMING, rolDentroDeConducta: "Método · adulto haciéndose pasar por igual" },
    SOLICITUD_ENCUENTRO: { ...DEFINICION_GROOMING, rolDentroDeConducta: "Etapa terminal · concretar encuentro presencial" },
    COMPARTIMIENTO_SEXUAL: {
        conductaLegal: "Sexting",
        definicionLiteral:
            "Remitir voluntariamente contenido digital íntimo (imágenes, videos, textos o contenido similar) a otras personas por medio de internet.",
        referenciaNormativa: "Ley 2564 de 2026 · art. 6.b",
    },
    EXTORSION: {
        conductaLegal: "Sextorsión",
        definicionLiteral:
            "Para obtener o al obtener contenido privado de la víctima se utiliza el chantaje como forma de constreñimiento para forzar la entrega de dinero, más contenido íntimo o cualquier otra prestación.",
        referenciaNormativa: "Ley 2564 de 2026 · art. 6.c",
    },
    STALKING: {
        conductaLegal: "Stalking",
        definicionLiteral: "Conductas obsesivas de acoso o intimidación por parte de una persona con la intención de causar miedo de forma reiterada a otra.",
        referenciaNormativa: "Ley 2564 de 2026 · art. 6.d",
    },
    CIBERACOSO: {
        conductaLegal: "Ciberacoso",
        definicionLiteral:
            "Comportamientos repetitivos de hostigamiento, intimidación y exclusión social hacia una víctima, ejecutados a través de tecnologías de comunicación.",
        referenciaNormativa: "Ley 2564 de 2026 · art. 6.e",
    },
    HAPPY_SLAPPING: {
        conductaLegal: "Happy slapping",
        definicionLiteral:
            "Conducta que consiste en la grabación de una agresión, física, verbal o sexual hacia una persona, que se difunde posteriormente mediante las tecnologías de comunicación.",
        referenciaNormativa: "Ley 2564 de 2026 · art. 6.f",
    },
    DIFUSION_NO_CONSENTIDA: {
        conductaLegal: "Difusión no consentida",
        definicionLiteral:
            "Uso, sin autorización, de datos, imágenes, videos u otro contenido personal privado de un tercero, incluyendo su difusión por cualquier medio, incluidos los digitales, con violación del derecho a la intimidad.",
        referenciaNormativa: "Ley 1273 de 2009 · art. 269F + Ley 599/2000 · art. 269",
    },
    DOXING: {
        conductaLegal: "Doxing",
        definicionLiteral:
            "Publicación o divulgación pública, sin autorización, de datos personales identificativos de un tercero (dirección, teléfono, ubicación, colegio, datos familiares) con el propósito de exponerlo o facilitar su localización o daño.",
        referenciaNormativa: "Ley 1273 de 2009 · art. 269F + Ley 1581 de 2012",
    },
    CONTENIDO_GENERADO_IA: {
        conductaLegal: "Contenido generado por IA",
        definicionLiteral:
            "Contenido creado o alterado mediante técnicas de inteligencia artificial (deepfakes, montajes automáticos) que representa a una persona real e identificable, con potencial de vulnerar sus derechos a la imagen, intimidad, honor u honra.",
        referenciaNormativa: "Ley 2489 de 2025 · art. 4 + Decreto 0769/2026",
    },
    SPAM: {
        conductaLegal: "Spam (categoría técnica interna)",
        definicionLiteral:
            "Categoría operativa interna de PI. Identifica contenido publicitario, comercial masivo, promocional o basura digital que llega al sistema a través de los canales de reporte, sin víctima concreta identificable. NO cuenta en conteos públicos ni activa alertas de convivencia. No responde a una tipificación legal específica; su función es limpiar la cola operativa para que las categorías con víctima concreta reciban atención humana prioritaria.",
        referenciaNormativa: "Sin fundamento legal aplicable (categoría técnica interna)",
    },
};
