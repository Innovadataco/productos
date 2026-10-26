/**
 * SPEC-908 · Fuente ÚNICA del contenido canónico de las 8 Guías de Acción.
 *
 * Por qué vive acá y no inline en `seed.ts`: tres consumidores necesitan EL MISMO
 * texto y si lo duplican, derivan (una queda en voseo, otra en tú):
 *   1. `seed.ts`            — crea las filas en una BD nueva (create-if-not-exists).
 *   2. `scripts/corregir-guias-accion-voz-tu.ts` — actualiza IN-PLACE las filas vivas
 *      que sobrevivieron a un reset con el voseo viejo (el seed no las pisa).
 *   3. `guias-accion-voz.candado.test.ts` — exige que ESTE contenido no tenga voseo.
 * El texto canónico sigue en la capa de SEED (no en una migración; lección I-420):
 * este módulo es importado por `seed.ts`, no una migración re-datada.
 *
 * Voz: TÚ (tuteo), por D-107 — la guía es recurso público/del adulto responsable
 * (nunca voseo). Reescritura de Diseño (COPY-GUIAS-DE-ACCION-VOZ-TU-2026-10-26),
 * radicada por el CEO (SPEC-908). Solo cambió la VOZ + 2 arreglos (typo «inmediado»,
 * espaciado «abuso / contenido»); sentido, pasos, orden, tipos y referencias legales
 * (141 ICBF, Fiscalía, Policía Judicial, Gaula, CAI, comité de convivencia, Ley
 * 2196/2022) intactos.
 *
 * Este módulo NO importa nada (ni @prisma/client): es dato puro, para que el candado
 * y el corrector lo lean sin arrastrar el cliente de Prisma ni efectos del seed.
 */

export const MARCA_PRELIMINAR = "contenido preliminar · pendiente revisión psicólogo+jurídico";

// `type` (no `interface`): un type-alias de objeto obtiene índice implícito y es
// asignable al Json de Prisma (pasosJson/botonesAccionJson); una interface nombrada no.
export type PasoGuia = {
    orden: number;
    tipo: "TRANQUILIDAD" | "ATENCION" | "ACCION" | "URGENCIA";
    titulo: string;
    descripcion: string;
};

export type BotonGuia = {
    tipo: "tel" | "url";
    texto: string;
    subtexto?: string;
    valor: string;
    estilo: "primario" | "urgente" | "secundario";
};

export type GuiaAccionSeed = {
    categoria: string;
    tituloEmocional: string;
    subtitulo: string;
    categoriaBadgeTexto: string;
    pasos: PasoGuia[];
    calloutTitulo: string;
    calloutTexto: string;
    botones: BotonGuia[];
    piePagina: string;
};

export const GUIAS_ACCION_BASE: GuiaAccionSeed[] = [
    {
        categoria: "GROOMING",
        tituloEmocional: "Si alguien está construyendo confianza para dañar",
        subtitulo: "El grooming suele parecer amistad o atención al principio. Toma distancia, documenta y pide ayuda.",
        categoriaBadgeTexto: "Manipulación progresiva",
        pasos: [
            { orden: 1, tipo: "TRANQUILIDAD", titulo: "Respira y escucha", descripcion: "La urgencia que siente el adulto responsable es natural. Antes de actuar, calmarte ayuda a tomar mejores decisiones." },
            { orden: 2, tipo: "ATENCION", titulo: "No bloquees el contacto todavía", descripcion: "Preserva las conversaciones como evidencia. Bloquear puede alertar al agresor y dificultar una investigación." },
            { orden: 3, tipo: "ACCION", titulo: "Captura evidencia sin invadir", descripcion: "Fotos de pantalla de los mensajes, nombres de usuario, plataforma y fechas. No interrogues a la persona menor." },
            { orden: 4, tipo: "ACCION", titulo: "Cambia contraseñas y revisa privacidad", descripcion: "Asegura las cuentas del menor y de la familia. Activa la autenticación de dos factores donde sea posible." },
            { orden: 5, tipo: "URGENCIA", titulo: "Denuncia ante autoridad competente", descripcion: "Contacta a la Fiscalía, la Policía Judicial o la línea 141 del ICBF. El bloqueo definitivo lo define la autoridad." },
        ],
        calloutTitulo: "¿Por qué no bloquear de inmediato?",
        calloutTexto: "Bloquear puede destruir pruebas y alertar al agresor. Primero documenta, luego pide orientación a las autoridades.",
        botones: [
            { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
            { tipo: "url", texto: "CAI Virtual", subtexto: "Denuncia en línea", valor: "https://www.cai.gov.co", estilo: "primario" },
            { tipo: "url", texto: "Te Protejo", subtexto: "Orientación y denuncia", valor: "https://teprotejo.org", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
    {
        categoria: "SEXTORSION",
        tituloEmocional: "Si alguien exige material íntimo bajo amenaza",
        subtitulo: "La sextorsión funciona con vergüenza y aislamiento. Parar, respirar y pedir ayuda es la mejor estrategia.",
        categoriaBadgeTexto: "Extorsión con contenido íntimo",
        pasos: [
            { orden: 1, tipo: "TRANQUILIDAD", titulo: "No respondas con más contenido", descripcion: "Ceder rara vez detiene la extorsión. El agresor suele seguir exigiendo más." },
            { orden: 2, tipo: "ATENCION", titulo: "No borres todo de inmediato", descripcion: "Conserva mensajes, perfiles, enlaces y capturas. Son evidencia para la denuncia." },
            { orden: 3, tipo: "ACCION", titulo: "Bloquea la comunicación y reporta la cuenta", descripcion: "Usa los mecanismos de la plataforma para reportar abuso. Luego bloquea al contacto." },
            { orden: 4, tipo: "URGENCIA", titulo: "Haz la denuncia", descripcion: "La Fiscalía y la Línea 141 atienden estos casos con protocolo de protección a la víctima." },
        ],
        calloutTitulo: "No estás solo",
        calloutTexto: "Muchas víctimas de sextorsión son menores. Pedir ayuda no es culpa; es el primer paso para cortar el ciclo.",
        botones: [
            { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
            { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
            { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
    {
        categoria: "DIFUSION_NO_CONSENTIDA",
        tituloEmocional: "Si una imagen o video íntimo se compartió sin consentimiento",
        subtitulo: "La difusión no consentida es delito. Se puede pedir la baja del contenido y denunciar sin exponer a la víctima.",
        categoriaBadgeTexto: "Imágenes compartidas sin permiso",
        pasos: [
            { orden: 1, tipo: "TRANQUILIDAD", titulo: "Prioriza el bienestar de la víctima", descripcion: "Evita juicios. Ofrece contención y escucha sin presionar por detalles." },
            { orden: 2, tipo: "ACCION", titulo: "Solicita la baja del contenido", descripcion: "Reporta el material en la plataforma como abuso / contenido íntimo no consentido. No compartas el enlace." },
            { orden: 3, tipo: "ACCION", titulo: "Documenta URLs y perfiles", descripcion: "Capturas de pantalla de dónde se publicó, quién lo compartió y cuándo." },
            { orden: 4, tipo: "URGENCIA", titulo: "Denuncia ante Fiscalía o CAI", descripcion: "La Ley 2196 de 2022 tipifica este delito. Presenta la evidencia sin exponer a la víctima." },
        ],
        calloutTitulo: "No difundir = proteger",
        calloutTexto: "Compartir el material, aunque sea para pedir ayuda, reproduce el daño. Documenta por capturas propias.",
        botones: [
            { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
            { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
            { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
    {
        categoria: "EXTORSION",
        tituloEmocional: "Si alguien exige dinero o favores bajo amenaza",
        subtitulo: "La extorsión busca miedo y prisa. No pagar y pedir ayuda profesional es lo recomendado.",
        categoriaBadgeTexto: "Amenaza con exigencia",
        pasos: [
            { orden: 1, tipo: "TRANQUILIDAD", titulo: "No actúes solo", descripcion: "Cuéntale a un adulto de confianza. La presión del agresor disminuye cuando hay acompañamiento." },
            { orden: 2, tipo: "ATENCION", titulo: "No realices pagos ni entregues información", descripcion: "Pagar suele aumentar las exigencias. No confirmes datos personales ni financieros." },
            { orden: 3, tipo: "ACCION", titulo: "Guarda toda la evidencia", descripcion: "Mensajes de texto, audios, números, nombres de usuario y capturas de pantalla." },
            { orden: 4, tipo: "URGENCIA", titulo: "Denuncia de inmediato", descripcion: "Policía Judicial, Fiscalía o Gaula. Lleva la evidencia organizada." },
        ],
        calloutTitulo: "La plataforma no negocia",
        calloutTexto: "Esta comunidad registra señales para alertar, pero no intercambia con agresores. La denuncia formal es la vía.",
        botones: [
            { tipo: "tel", texto: "Gaula", subtexto: "Policía Nacional", valor: "+571165", estilo: "urgente" },
            { tipo: "tel", texto: "Línea 141 ICBF", valor: "141", estilo: "primario" },
            { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
    {
        categoria: "DOXING",
        tituloEmocional: "Si alguien publicó datos personales para exponer o intimidar",
        subtitulo: "El doxing expone información privada. La prioridad es proteger la seguridad física y digital de la persona afectada.",
        categoriaBadgeTexto: "Exposición de datos personales",
        pasos: [
            { orden: 1, tipo: "ATENCION", titulo: "Evalúa la gravedad de lo expuesto", descripcion: "Dirección, teléfono, escuela o lugar de trabajo requieren acción más urgente que un email o nickname." },
            { orden: 2, tipo: "ACCION", titulo: "Solicita la eliminación del contenido", descripcion: "Reporta en la plataforma por violación de privacidad o acoso. Guarda capturas antes de que se borre." },
            { orden: 3, tipo: "ACCION", titulo: "Refuerza la seguridad digital", descripcion: "Cambia contraseñas, revisa la configuración de privacidad y limita la información pública." },
            { orden: 4, tipo: "URGENCIA", titulo: "Denuncia ante autoridades", descripcion: "Si hay riesgo físico, contacta a la Policía y Fiscalía. El doxing puede estar vinculado a delitos de amenaza o lesiones." },
        ],
        calloutTitulo: "No respondas con más exposición",
        calloutTexto: "Evita publicar más datos de la víctima o del agresor. La documentación privada es la herramienta legal.",
        botones: [
            { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
            { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
            { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
    {
        categoria: "CIBERACOSO",
        tituloEmocional: "Si hay acoso repetido en entornos digitales",
        subtitulo: "El ciberacoso puede ser mensajes, burlas, exclusión o suplantación. Documentar y reportar ayuda a detenerlo.",
        categoriaBadgeTexto: "Acoso en línea",
        pasos: [
            { orden: 1, tipo: "TRANQUILIDAD", titulo: "Escucha sin minimizar", descripcion: "Para quien lo sufre, el acoso en línea es real. Valida sus emociones antes de buscar soluciones." },
            { orden: 2, tipo: "ACCION", titulo: "Bloquea y reporta en la plataforma", descripcion: "Usa las herramientas de reporte. Captura todo antes de bloquear por si la cuenta desaparece." },
            { orden: 3, tipo: "ACCION", titulo: "Conserva un registro de fechas", descripcion: "Una línea de tiempo ayuda a mostrar el patrón repetido ante la escuela, la plataforma o la autoridad." },
            { orden: 4, tipo: "ACCION", titulo: "Informa a la institución correspondiente", descripcion: "Si involucra a la escuela, contacta al comité de convivencia. Si es grave, acude a la Fiscalía." },
        ],
        calloutTitulo: "No respondas con el mismo tono",
        calloutTexto: "Responder al acoso puede escalar la situación. Documenta, reporta y pide apoyo institucional.",
        botones: [
            { tipo: "url", texto: "Te Protejo", subtexto: "Orientación y denuncia", valor: "https://teprotejo.org", estilo: "primario" },
            { tipo: "tel", texto: "Línea 141 ICBF", valor: "141", estilo: "secundario" },
            { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
    {
        categoria: "SOLICITUD_ENCUENTRO",
        tituloEmocional: "Si alguien propone encontrarse en persona",
        subtitulo: "Un adulto que busca encontrarse con un menor en secreto pone en riesgo su seguridad. Actúa con calma y firmeza.",
        categoriaBadgeTexto: "Propuesta de encuentro físico",
        pasos: [
            { orden: 1, tipo: "URGENCIA", titulo: "Evita el encuentro y no lo justifiques", descripcion: "Ningún adulto con buenas intenciones necesita secreto para ver a un menor." },
            { orden: 2, tipo: "ATENCION", titulo: "Conserva toda la conversación", descripcion: "No borres mensajes, audios ni ubicaciones. Son evidencia clave." },
            { orden: 3, tipo: "ACCION", titulo: "Informa a la familia y a las autoridades", descripcion: "Este tipo de situación requiere denuncia formal. La prevención física es prioridad." },
            { orden: 4, tipo: "ACCION", titulo: "Refuerza la supervisión", descripcion: "Revisa con quién tiene contacto el menor y ajusta la privacidad de sus redes." },
        ],
        calloutTitulo: "El secreto es una señal de alarma",
        calloutTexto: "Pedir encuentros a escondidas, regalos o fotos es parte de una estrategia de acercamiento. Detenerlo temprano es clave.",
        botones: [
            { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
            { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
            { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
    {
        categoria: "COMPARTIMIENTO_SEXUAL",
        tituloEmocional: "Si se compartió o solicitó material sexual de un menor",
        subtitulo: "Toda imagen o video sexual de menores es abuso. La respuesta es denunciar, preservar evidencia y proteger a la víctima.",
        categoriaBadgeTexto: "Material sexual de menores",
        pasos: [
            { orden: 1, tipo: "ATENCION", titulo: "No compartas el material", descripcion: "Ni siquiera para pedir ayuda. Su posesión o difusión también es delito." },
            { orden: 2, tipo: "ACCION", titulo: "Reporta en la plataforma", descripcion: "Usa la opción de reporte por explotación sexual infantil. Guarda URLs, perfiles y capturas sin el contenido íntimo." },
            { orden: 3, tipo: "URGENCIA", titulo: "Denuncia de inmediato", descripcion: "Fiscalía, CAI o Policía Judicial. Este delito requiere acción profesional urgente." },
            { orden: 4, tipo: "ACCION", titulo: "Acompaña a la víctima", descripcion: "Ofrece contención y busca apoyo psicológico. La culpa no es de quien fue engañado o presionado." },
        ],
        calloutTitulo: "La víctima no es responsable",
        calloutTexto: "Los menores son manipulados, engañados o presionados. La responsabilidad es siempre del adulto agresor.",
        botones: [
            { tipo: "tel", texto: "Línea 141 ICBF", subtexto: "Atención 24 horas", valor: "141", estilo: "urgente" },
            { tipo: "url", texto: "CAI Virtual", valor: "https://www.cai.gov.co", estilo: "primario" },
            { tipo: "url", texto: "Te Protejo", valor: "https://teprotejo.org", estilo: "secundario" },
        ],
        piePagina: MARCA_PRELIMINAR,
    },
];
