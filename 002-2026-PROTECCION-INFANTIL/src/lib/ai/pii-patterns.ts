/**
 * Patrones determinísticos para detección de PII de NNA y DOXING.
 *
 * Reglas de negocio:
 * - Teléfono/nick/usuario del AGRESOR no es PII.
 * - Nombre del adulto agresor no es PII.
 * - Datos escolares/familiares solo son PII si están adyacentes a un identificador
 *   concreto (nombre propio, grado, salón, número).
 */

const COLEGIO_KEYWORDS =
    "colegio|instituto|escuela|liceo|universidad|sede|college|inst\\.|inst|gimnasio|academia";
const DIRECCION_KEYWORDS = "calle|carrera|avenida|av\\.?|diagonal|dg|transversal|tv|transv|crc|cl\\.?|cra|cll|kr";
const TELEFONO_REGEX = /(?:\+?57\s?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}|3\d{9}/g;
const STOPWORDS_COLEGIO = "y|el|la|los|las|de|del|vive|viven|estudia|estudian|es|son|me|le|se|que|por|para|con|sin|en";

// Letra mayúscula real (Unicode). Se usa con flag u para evitar falsos positivos
// cuando la regex principal tiene flag i.
const NOMBRE_PROPIO = String.raw`\p{Lu}[\p{Ll}]+`;

interface PiiDetectionResult {
    contienePii: boolean;
    piiDetectada: string[];
}

function normalizeFragmento(f: string): string {
    return f.toLowerCase().replace(/[.,;:!?]+$/, "").trim();
}

/**
 * Normaliza un texto para matching insensible a tildes/diacríticos.
 * Los fragmentos reportados al llamador siguen usando el texto original.
 */
function sinDiacriticos(texto: string): string {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function empiezaConMayusculaReal(token: string): boolean {
    return /^\p{Lu}/u.test(token);
}

/**
 * Filtra tokens de una captura mixta (con posibles palabras sueltas por flag i)
 * dejando solo nombres propios y, opcionalmente, conectores permitidos seguidos
 * de otro nombre propio.
 */
function extraerNombresPropios(texto: string, permitirConectores = false): string[] {
    const conectores = new Set(["de", "del", "de la", "la", "el", "los", "las"]);
    const tokens = texto.split(/\s+/).filter((t) => t.length > 0);
    const resultado: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (empiezaConMayusculaReal(t)) {
            resultado.push(t);
        } else if (permitirConectores && conectores.has(t.toLowerCase()) && i + 1 < tokens.length && empiezaConMayusculaReal(tokens[i + 1])) {
            resultado.push(t);
        } else {
            break;
        }
    }
    return resultado;
}

function deduplicarFragmentos(fragmentos: string[]): string[] {
    const seen = new Set<string>();
    const resultado: string[] = [];
    for (const f of fragmentos) {
        const key = normalizeFragmento(f);
        if (!seen.has(key)) {
            seen.add(key);
            resultado.push(f.trim());
        }
    }
    return resultado;
}

/**
 * Detecta nombres propios de menores o terceros inocentes en contexto de parentesco.
 * No detecta nombres aislados ni nombres de adultos agresores.
 */
function detectarNombresEnContexto(texto: string): string[] {
    const nombre = NOMBRE_PROPIO;
    const patrones = [
        new RegExp(`(?:mi|del|de la|nuestro|nuestra)\\s+(?:hijo|hija|sobrino|sobrina|nieto|nieta|hermano|hermana|primo|prima|hijastro|hijastra|menor|niño|niña|adolescente|chico|chica)\\s+(${nombre}(?:\\s+(?:de\\s+la|del|de)\\s+${nombre})?)`, "gui"),
        new RegExp(`(?:el|la)\\s+(?:niño|niña|adolescente|menor|chico|chica)\\s+(${nombre}(?:\\s+(?:de\\s+la|del|de)\\s+${nombre})?)`, "gui"),
        new RegExp(`(?:mi|nuestra)\\s+(?:mamá|mama|papá|papa|tía|tia|tío|tio|abuela|abuelo|familiar)\\s+(${nombre})`, "gui"),
    ];

    const encontrados: string[] = [];
    for (const regex of patrones) {
        let match;
        while ((match = regex.exec(texto)) !== null) {
            const nombres = extraerNombresPropios(match[1].trim(), true);
            if (nombres.length > 0) {
                encontrados.push(nombres.join(" "));
            }
        }
    }
    return encontrados;
}

/**
 * Detecta instituciones educativas mencionadas con nombre propio.
 * Limita la captura a palabras que comiencen con mayúscula real (o stopwords permitidas)
 * y se detiene ante verbos/palabras comunes para no arrastrar el resto de la oración.
 */
function detectarColegios(texto: string): string[] {
    const stopwords = new Set(STOPWORDS_COLEGIO.split("|"));
    const regex = new RegExp(
        `(?:${COLEGIO_KEYWORDS})\\s+((?:${NOMBRE_PROPIO}|de\\s+la|del|de|San|Santa|Santo|La|El|Los|Las|Nuestra|Nuestro)(?:\\s+(?:${NOMBRE_PROPIO}|de\\s+la|del|de)){0,4})`,
        "gui"
    );
    const encontrados: string[] = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
        const raw = match[1].trim();
        const tokens = raw.split(/\s+/);
        const kept: string[] = [];
        for (const t of tokens) {
            if (stopwords.has(t.toLowerCase())) break;
            if (empiezaConMayusculaReal(t) || /^(de|del|de\s+la|la|el)$/i.test(t)) {
                kept.push(t);
            } else {
                break;
            }
        }
        if (kept.length > 0 && kept.some((t) => empiezaConMayusculaReal(t))) {
            encontrados.push(`${match[0].split(/\s+/)[0]} ${kept.join(" ")}`);
        }
    }
    return encontrados;
}

/**
 * Detecta direcciones con formato colombiano.
 */
function detectarDirecciones(texto: string): string[] {
    const regex = new RegExp(
        `(?:${DIRECCION_KEYWORDS})\\s*\\d+[\\s#n°no.\\-]*\\d+[\\s\\-]*\\d*`,
        "gi"
    );
    const encontrados: string[] = [];
    let match;
    while ((match = regex.exec(texto)) !== null) {
        encontrados.push(match[0].trim());
    }
    return encontrados;
}

/**
 * Detecta teléfonos atribuidos al NNA. No detecta teléfonos del agresor.
 * Contextos válidos: "mi número/celular/teléfono", "el celular de mi hijo|hija|...",
 * "el número del niño/niña/adolescente", "el número de mi hijo/hija/sobrina... es".
 */
function detectarTelefonosNNA(texto: string): string[] {
    const familiares = "hijo|hija|sobrino|sobrina|nieto|nieta|hermano|hermana|primo|prima";
    const menores = "niño|niña|adolescente|menor";

    const contextos = [
        // mi celular / mi teléfono / mi número
        /mi\s+(?:celular|tel[ée]fono|n[úu]mero)/gui,
        // el celular/teléfono/número de mi hijo/a/...
        new RegExp(`el\\s+(?:celular|tel[ée]fono|n[úu]mero)\\s+de\\s+mi\\s+(?:${familiares})`, "gui"),
        // el celular/teléfono/número del niño/niña/adolescente/menor
        new RegExp(`el\\s+(?:celular|tel[ée]fono|n[úu]mero)\\s+del\\s+(?:${menores})`, "gui"),
        // el celular/teléfono/número de la niña/adolescente/menor
        new RegExp(`el\\s+(?:celular|tel[ée]fono|n[úu]mero)\\s+de\\s+la\\s+(?:niña|adolescente|menor)`, "gui"),
        // el número de mi hijo/a/... (es) ...
        new RegExp(`el\\s+n[úu]mero\\s+de\\s+mi\\s+(?:${familiares})(?:\\s+es)?`, "gui"),
        // mi hijo/a/... (tiene|su) celular/teléfono/número ...
        new RegExp(`(?:mi|nuestro|nuestra)\\s+(?:${familiares}|${menores})\\s+(?:tiene|su)\\s+(?:celular|tel[ée]fono|n[úu]mero)`, "gui"),
    ];

    const encontrados: string[] = [];
    for (const regex of contextos) {
        let match;
        while ((match = regex.exec(texto)) !== null) {
            const inicio = match.index;
            const ventana = texto.slice(inicio, inicio + 120);
            const telMatch = ventana.match(TELEFONO_REGEX);
            if (telMatch) {
                encontrados.push(telMatch[0]);
            }
        }
    }
    return encontrados;
}

/**
 * Detecta datos escolares/familiares solo cuando están adyacentes a un identificador
 * concreto (nombre propio, grado, salón).
 */
function detectarDatosEscolaresFamiliares(texto: string): string[] {
    const encontrados: string[] = [];
    const regex = new RegExp(
        `(?:la\\s+)?(?:profesora|profesor|maestra|maestro|directora|director)\\s+(${NOMBRE_PROPIO})`,
        "gui"
    );
    let match;
    while ((match = regex.exec(texto)) !== null) {
        const nombres = extraerNombresPropios(match[1].trim(), false);
        if (nombres.length > 0) {
            encontrados.push(nombres.join(" "));
        }
    }

    const regexGrado = /(?:grado|sal[oó]n)\s+(\d+[A-Z]?)/gi;
    while ((match = regexGrado.exec(texto)) !== null) {
        encontrados.push(match[0].trim());
    }

    return encontrados;
}

/**
 * Detecta auto-identificación del denunciante (nombre, teléfono o email propio).
 * No detecta el identificador del agresor ni teléfonos atribuidos a terceros.
 */
function detectarAutoIdentificacionDenunciante(texto: string): string[] {
    const encontrados: string[] = [];

    // Patrones de auto-identificación de nombres propios.
    const introduccionesNombres = [
        "yo soy",
        "soy",
        "me llamo",
        "mi nombre es",
        "llamo",
        "me dicen",
        "me conocen como",
    ].join("|");
    const regexNombres = new RegExp(
        `(?:${introduccionesNombres})\\s+(${NOMBRE_PROPIO}(?:\\s+(?:de\\s+la|del|de)\\s+${NOMBRE_PROPIO})?)`,
        "gui"
    );
    let match;
    while ((match = regexNombres.exec(texto)) !== null) {
        const nombres = extraerNombresPropios(match[1].trim(), true);
        if (nombres.length > 0) {
            encontrados.push(nombres.join(" "));
        }
    }

    // Patrones de auto-identificación de teléfono propio del denunciante.
    const contextosTelefono = [
        /mi\s+(?:tel[ée]fono|celular|n[úu]mero)\s+(?:de\s+contacto\s+)?es/gui,
        /puedes\s+(?:llamarme|escribirme|contactarme)\s+al/gui,
        /(?:llámame|escríbeme|contactame)\s+al/gui,
        /mi\s+(?:tel[ée]fono|celular|n[úu]mero)\s+de\s+contacto\s+es/gui,
    ];
    for (const regex of contextosTelefono) {
        while ((match = regex.exec(texto)) !== null) {
            const inicio = match.index;
            const ventana = texto.slice(inicio, inicio + 80);
            const telMatch = ventana.match(TELEFONO_REGEX);
            if (telMatch) {
                encontrados.push(telMatch[0]);
            }
        }
    }

    // Auto-identificación de email propio.
    const regexEmail = /(?:mi\s+(?:email|correo)\s+(?:electrónico\s+)?(?:es|de\s+contacto\s+es)|escribirme\s+a)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gui;
    while ((match = regexEmail.exec(texto)) !== null) {
        encontrados.push(match[1]);
    }

    return encontrados;
}

/**
 * Detección determinística de PII de NNA.
 */
export function detectarPiiDeterministico(texto: string): PiiDetectionResult {
    const fragmentos = [
        ...detectarNombresEnContexto(texto),
        ...detectarColegios(texto),
        ...detectarDirecciones(texto),
        ...detectarTelefonosNNA(texto),
        ...detectarDatosEscolaresFamiliares(texto),
        ...detectarAutoIdentificacionDenunciante(texto),
    ];

    const piiDetectada = deduplicarFragmentos(fragmentos);
    return {
        contienePii: piiDetectada.length > 0,
        piiDetectada,
    };
}

/**
 * Detecta indicios de DOXING reutilizando patrones PII + verbos/intención de publicación.
 */
export function detectarDoxing(texto: string): { esDoxing: boolean; fragmentos: string[] } {
    const pii = detectarPiiDeterministico(texto);
    const textoNormalizado = sinDiacriticos(texto);

    const verbosPublicacion =
        /(?:public(?:ar|o|aron|ando|aba|aste|aran)|sub(?:ir|io|ieron|iendo)|difund(?:ir|io|ieron|iendo)|compart(?:ir|io|ieron|iendo)|filtr(?:ar|o|aron|ando)|revel(?:ar|o|aron|ando)|expus(?:o|ieron)|doxe(?:ar|o|aron|ando))\s+(?:(?:la|el|los|las|un|una|su|sus)\s+)?(?:datos?|informacion|fotos?|videos?|numero|direccion|nombre|imagenes?)/i;

    const multiplesDatos =
        /(?:nombre|direccion|telefono|celular|numero).*?(?:nombre|direccion|telefono|celular|numero)/i;

    // Regla ampliada: intento de publicar/difundir/enviar "datos personales" o "información personal"
    // aunque no haya PII concreto identificado. Esto captura textos vagos como
    // "mando mi información personal a extraños" o "compartió datos personales del menor".
    const datosPersonalesGenericos = /datos personales|informacion personal/i;
    const verbosPublicacionAmpliados =
        /(?:public(?:ar|o|aron|ando|aba|aste|aran)|sub(?:ir|io|ieron|iendo)|difund(?:ir|io|ieron|iendo)|compart(?:ir|io|ieron|iendo)|filtr(?:ar|o|aron|ando)|revel(?:ar|o|aron|ando)|expus(?:o|ieron)|doxe(?:ar|o|aron|ando)|mand(?:ar|o|aron|ando|aste)|envi(?:ar|o|aron|ando|aste)|pas(?:ar|o|aron|ando|aste))\b/i;

    const esDoxing =
        pii.contienePii && (verbosPublicacion.test(textoNormalizado) || multiplesDatos.test(textoNormalizado)) ||
        (verbosPublicacionAmpliados.test(textoNormalizado) && datosPersonalesGenericos.test(textoNormalizado));

    return {
        esDoxing,
        fragmentos: esDoxing ? (pii.piiDetectada.length > 0 ? pii.piiDetectada : ["datos personales"]) : [],
    };
}
