/**
 * SPEC-369 · poblador demo v2 — volumen con variedad real para que BI (Kimi)
 * tenga con qué construir.
 *
 * Qué lo separa del v1 (002-PI-345) y por qué se puede revertir sin miedo:
 *  · IDs con prefijo propio `demo2-` (el v1 usa `demo-`).
 *  · NITs desde 900.000.051 (el v1 ocupa 900.000.001..050).
 *  · Correos con `+demo2-` (el v1 usa `+demo-`).
 * Así `borrar-demo-v2` limpia SOLO lo suyo: no roza el v1 ni los datos reales.
 *
 * Candados: PII ficticia (nunca nombres/nicks que parezcan de personas reales),
 * sin correos, sin pg-boss ni Ollama, idempotente por id determinista.
 */

export const DEMO2 = {
    prefix: "demo2-",
    nitInicio: 900_000_051,
    emailMarca: "+demo2-",
    dominio: "innovadataco.com",
    nReportes: 2000,
    /** Ventana de fechas: desde el 1-ene-2024 hasta hoy. */
    desde: new Date("2024-01-01T00:00:00Z"),
    intocables: {
        colegios: ["cmticor7l000kglr93d1ypox6"],
        usuarios: ["soporte@innovadataco.com"],
    },
} as const;

/** IDs deterministas — la corrida es idempotente y el borrado va por prefijo. */
export const id2 = {
    reporte: (n: number) => `demo2-r-${String(n).padStart(5, "0")}`,
    clasificacion: (rId: string) => `demo2-cl-${rId.slice(6)}`,
} as const;

/**
 * Reparto de años. Jelkin insistió en que hubiera densidad en TODOS los tramos
 * ("inclusive reportes del 25 y del 24"), no solo en el último año. 2026 pesa
 * más porque es el año en curso, pero 2024 y 2025 quedan bien poblados.
 */
export const PESOS_ANIO = [
    { anio: 2024, peso: 0.25 },
    { anio: 2025, peso: 0.35 },
    { anio: 2026, peso: 0.4 },
] as const;

/**
 * Mezcla de categorías. NO uniforme: las sensibles pesan más porque son las que
 * el producto existe para detectar, y así el clasificador y los tableros de BI
 * muestran algo parecido a la realidad. SPAM queda como fracción benigna.
 */
export const PESOS_CATEGORIA = [
    { categoria: "SOLICITUD_MATERIAL", peso: 0.15 },
    { categoria: "COMPARTIMIENTO_SEXUAL", peso: 0.13 },
    { categoria: "SOLICITUD_ENCUENTRO", peso: 0.12 },
    { categoria: "CONTACTO_INSISTENTE", peso: 0.12 },
    { categoria: "CIBERACOSO", peso: 0.1 },
    { categoria: "OFRECIMIENTO_REGALOS", peso: 0.08 },
    { categoria: "EXTORSION", peso: 0.06 },
    { categoria: "DIFUSION_NO_CONSENTIDA", peso: 0.05 },
    { categoria: "SUPLANTACION_IDENTIDAD", peso: 0.05 },
    { categoria: "HAPPY_SLAPPING", peso: 0.04 },
    { categoria: "STALKING", peso: 0.03 },
    { categoria: "CONTENIDO_GENERADO_IA", peso: 0.02 },
    { categoria: "DOXING", peso: 0.02 },
    { categoria: "SPAM", peso: 0.03 },
] as const;

export type CategoriaDemo2 = (typeof PESOS_CATEGORIA)[number]["categoria"];

/**
 * Relatos por categoría — distintos y creíbles, para que el clasificador
 * clasifique DISTINTO (con un solo pool genérico todo caía en la misma bolsa).
 *
 * Regla dura: PII ficticia. Nombres y apodos inventados, sin apellidos reales,
 * sin teléfonos ni direcciones que puedan corresponder a alguien.
 */
export const RELATOS: Record<CategoriaDemo2, readonly string[]> = {
    SOLICITUD_MATERIAL: [
        "Le escribió a mi hija pidiéndole fotos en ropa interior y le dijo que no le contara a nadie.",
        "Insistió varias veces en que le mandara imágenes suyas sin ropa a cambio de dinero.",
        "Le pidió al niño que se grabara en video mostrándose y le prometió que lo borraría después.",
        "Le mandó fotos suyas y le exigió que respondiera con otras iguales.",
    ],
    COMPARTIMIENTO_SEXUAL: [
        "Le envió imágenes con contenido sexual explícito sin que el menor las pidiera.",
        "Mandó videos pornográficos al chat del grupo donde están los niños del salón.",
        "Le compartió material sexual y le dijo que así se aprendía de eso.",
        "Envió fotos de desnudos por mensaje directo a la cuenta del menor.",
    ],
    SOLICITUD_ENCUENTRO: [
        "Le propuso verse en un centro comercial sin que los papás supieran.",
        "Insistió en recogerlo a la salida del colegio y pidió que no avisara en la casa.",
        "Le ofreció llevarlo a un parque el fin de semana y le dijo que fuera solo.",
        "Quedó de encontrarse con la niña cerca del conjunto y le pidió guardar el secreto.",
    ],
    CONTACTO_INSISTENTE: [
        "Le escribe todos los días aunque el niño ya le dijo que no quiere hablar.",
        "Después de que lo bloqueó, volvió a buscarlo desde otras cuentas nuevas.",
        "Manda mensajes a toda hora, incluso de madrugada, y se molesta si no le responden.",
        "Lleva semanas insistiendo en chatear a solas pese a que no le contestan.",
    ],
    CIBERACOSO: [
        "Un grupo del salón lo insulta a diario en el chat y le dicen que se desaparezca.",
        "Le crearon una etiqueta para burlarse de él y varios compañeros la repiten.",
        "La molestan por su cuerpo en los comentarios y no la dejan en paz.",
        "Le mandan mensajes ofensivos en grupo y se ríen cuando ella pide que paren.",
    ],
    OFRECIMIENTO_REGALOS: [
        "Le ofreció recargas y skins del juego a cambio de que hablara con él a solas.",
        "Le prometió un celular nuevo si mantenía la conversación en secreto.",
        "Le manda dinero por la aplicación y le pide que no le cuente a la mamá.",
        "Le ofreció pagarle la suscripción del juego si le respondía en privado.",
    ],
    EXTORSION: [
        "Amenaza con publicar unas fotos si el menor no le sigue escribiendo.",
        "Le dijo que si lo bloqueaba les mandaba las imágenes a sus compañeros.",
        "Exige dinero para no difundir unas capturas de pantalla del chat.",
        "Amenazó con contarle todo a la familia si dejaba de responderle.",
    ],
    DIFUSION_NO_CONSENTIDA: [
        "Compartió en un grupo unas fotos privadas de la menor sin permiso.",
        "Reenvió un video íntimo que le habían mandado en confianza.",
        "Publicó capturas de una conversación privada para exponer a la niña.",
        "Subió a una historia imágenes del menor que él no autorizó.",
    ],
    SUPLANTACION_IDENTIDAD: [
        "Creó un perfil usando el nombre y las fotos del niño para escribirles a sus amigos.",
        "Se hace pasar por una compañera del colegio para ganarse la confianza.",
        "Abrió una cuenta falsa con los datos de mi hija y desde ahí manda mensajes.",
        "Usa la foto de otro menor para presentarse como si tuviera la misma edad.",
    ],
    HAPPY_SLAPPING: [
        "Grabaron cuando lo empujaron en el descanso y subieron el video al grupo.",
        "Le pegaron mientras otro filmaba y después lo compartieron entre varios.",
        "Publicaron el video de una agresión en el salón como si fuera un chiste.",
        "Filmaron la golpiza y la reenviaron por el chat del curso.",
    ],
    STALKING: [
        "Sabe a qué horas sale del colegio y se lo menciona en cada mensaje.",
        "Aparece en los mismos lugares que la menor y comenta sus publicaciones al instante.",
        "Le hace seguimiento a todo lo que sube y le escribe apenas publica algo.",
        "Preguntó por la dirección del conjunto y por la ruta que toma para volver.",
    ],
    CONTENIDO_GENERADO_IA: [
        "Hicieron una imagen falsa del menor con inteligencia artificial y la difundieron.",
        "Usaron una foto del colegio para generar un montaje con contenido sexual.",
        "Circula un video alterado con la cara de la niña puesta con IA.",
        "Generaron imágenes falsas del estudiante y las mandaron por el grupo.",
    ],
    DOXING: [
        "Publicó el colegio, el curso y la jornada del menor en un grupo abierto.",
        "Difundió datos del niño y de su familia para que otros lo buscaran.",
        "Compartió la ubicación del conjunto donde vive la menor.",
        "Expuso información personal del estudiante en una publicación pública.",
    ],
    SPAM: [
        "Manda promociones de una tienda en línea a cada rato.",
        "Envía cadenas de mensajes con premios y enlaces de sorteos.",
        "Publicidad repetida de un negocio en el chat del grupo.",
        "Mensajes automáticos ofreciendo un curso, sin relación con el menor.",
    ],
} as const;

/** Nicks ficticios de los sujetos reportados — inventados, nunca de personas reales. */
export const NICKS_DEMO2 = [
    "jugador_sombra_77", "perfil_gris_2201", "cuenta_nueva_4412", "usuario_niebla_18",
    "el_visitante_909", "sinnombre_3307", "avatar_azul_55", "contacto_x_7788",
    "anonimo_del_bloque", "sombra_del_rio_42", "perfil_temporal_66", "cuenta_espejo_31",
] as const;

/**
 * Ciudades por país — variedad geográfica de verdad, no solo Colombia. Se
 * resuelven contra el catálogo real; si alguna no está, el reporte igual se
 * guarda con el nombre y el país en texto.
 */
export const CIUDADES_DEMO2 = [
    "CO:Bogotá", "CO:Medellín", "CO:Cali", "CO:Barranquilla", "CO:Cartagena", "CO:Bucaramanga",
    "CO:Pereira", "CO:Manizales", "CO:Santa Marta", "CO:Cúcuta", "CO:Ibagué", "CO:Villavicencio",
    "MX:Ciudad de México", "MX:Guadalajara", "MX:Monterrey", "MX:Puebla",
    "AR:Buenos Aires", "AR:Córdoba", "AR:Rosario",
    "PE:Lima", "PE:Arequipa",
    "CL:Santiago", "CL:Valparaíso",
    "EC:Quito", "EC:Guayaquil",
    "UY:Montevideo",
] as const;

export const PAISES_DEMO2 = ["CO", "MX", "AR", "PE", "CL", "EC", "UY"] as const;

/** Elige por peso (los pesos no tienen que sumar exactamente 1). */
export function elegirPonderado<T extends { peso: number }>(r: () => number, opciones: readonly T[]): T {
    const total = opciones.reduce((s, o) => s + o.peso, 0);
    let x = r() * total;
    for (const o of opciones) {
        x -= o.peso;
        if (x <= 0) return o;
    }
    return opciones[opciones.length - 1] as T;
}

/**
 * Fecha repartida por año según PESOS_ANIO. Para el año en curso corta en HOY
 * (nunca genera futuro: un reporte con fecha futura es dato sucio para BI).
 */
export function fechaRepartida(r: () => number, ahora: Date): Date {
    const { anio } = elegirPonderado(r, PESOS_ANIO);
    const inicio = new Date(Date.UTC(anio, 0, 1));
    const finAnio = new Date(Date.UTC(anio + 1, 0, 1));
    const fin = finAnio > ahora ? ahora : finAnio;
    if (fin <= inicio) return new Date(inicio);
    const ms = inicio.getTime() + Math.floor(r() * (fin.getTime() - inicio.getTime()));
    const fecha = new Date(ms);
    // Hora en punto: coherente con G20 (los minutos del hecho no se conocen).
    fecha.setUTCMinutes(0, 0, 0);
    return fecha;
}
