/**
 * SPEC-700 (I-425) · Lista CANÓNICA de requisitos que el Verificador chequea.
 *
 * Decisión de Jelkin (17-09-2026): quedan TRES — tarjeta profesional, antecedentes y
 * cédula. Se retiró el 4º «otro» («Cuarto espacio libre — pendiente de definir por
 * Jelkin»), que hoy le mostraba a todos los profesionales un texto con el nombre de una
 * persona del equipo y un «pendiente de definir».
 *
 * Fuente ÚNICA de verdad de la lista por defecto: el seed la siembra (idempotente) y el
 * corrector de prod (`scripts/spec-700-retirar-requisito-otro.ts`) reconcilia el
 * parámetro EXISTENTE contra estas claves. El candado `requisitos-default.candado.test.ts`
 * vigila que ningún texto vuelva a nombrar a una persona ni a decir «pendiente de definir».
 */
import type { RequisitoVerificacion } from "./requisitos";

/** Clave del parámetro en `ParametroSistema` (JSON con `{ clave, nombre, descripcion }`). */
export const CLAVE_PARAMETRO_REQUISITOS = "verificacion.requisitos";

/** Claves que sobreviven la baja de SPEC-700 (EXACTAMENTE estas tres, en este orden). */
export const CLAVES_REQUISITOS_VIGENTES = ["tarjeta_profesional", "antecedentes", "cedula"] as const;

/** Lista por defecto (fresh DB / test / dev). Prod se reconcilia con el corrector. */
export const REQUISITOS_VERIFICACION_DEFAULT: RequisitoVerificacion[] = [
    {
        clave: "tarjeta_profesional",
        nombre: "Tarjeta profesional vigente",
        descripcion: "Imagen o PDF de la tarjeta profesional emitida por el ente competente.",
    },
    {
        clave: "antecedentes",
        nombre: "Antecedentes del profesional",
        descripcion: "Certificado de antecedentes (Ley 1918/2018 · 2375/2024, §5). El resultado es reservado por ley.",
    },
    {
        clave: "cedula",
        nombre: "Cédula de ciudadanía",
        descripcion: "Documento de identidad vigente.",
    },
];

/**
 * Nombres PROPIOS de personas del equipo. NO se listan los ROLES (CEO, Datos, Calidad,
 * Diseño, Estrategia): son palabras comunes en español y darían falsos positivos sobre
 * el texto legítimo de un requisito. El riesgo real es un nombre propio filtrado, como
 * el «por Jelkin» que traía el «otro».
 */
export const NOMBRES_EQUIPO = ["Jelkin"] as const;

/** Marcadores de «sin terminar» que no deben quedar en un texto que ve el profesional. */
const FRASES_PLACEHOLDER = [
    "pendiente de definir",
    "por definir",
    "sin definir",
    "a definir",
    "por decidir",
    "tbd",
    "todo:",
];

function escaparRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Devuelve los fragmentos PROHIBIDOS que aparecen en `texto` (arreglo vacío = limpio).
 * Case-insensitive; los nombres se matchean por límite de palabra para no morder
 * subcadenas. Lo usa el candado (control positivo con el texto de hoy) y el corrector
 * (se niega a escribir un valor que los contenga).
 */
export function detectarTextoProhibido(texto: string): string[] {
    const hallazgos: string[] = [];
    const t = texto.toLowerCase();
    for (const frase of FRASES_PLACEHOLDER) {
        if (t.includes(frase)) hallazgos.push(frase);
    }
    for (const nombre of NOMBRES_EQUIPO) {
        if (new RegExp(`\\b${escaparRegex(nombre.toLowerCase())}\\b`).test(t)) hallazgos.push(nombre);
    }
    return hallazgos;
}
