const RE_TELEFONO_CO = /\b3\d{9}\b/g;
const RE_EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const RE_DOCUMENTO_LARGO = /\b\d{7,10}\b/g;
const COLUMNAS_DOCUMENTO = /^(cedula|documento|dni|identificacion|nro_documento)$/i;

export interface ResultadoSanitizer<T> {
    filas: T[];
    piiDetectada: boolean;
    reemplazos: number;
}

export function sanearFilas<T extends Record<string, unknown>>(
    filas: T[],
): ResultadoSanitizer<T> {
    let piiDetectada = false;
    let reemplazos = 0;
    const salida: T[] = [];

    for (const fila of filas) {
        const copia: Record<string, unknown> = {};
        for (const [clave, valor] of Object.entries(fila)) {
            if (typeof valor !== "string") {
                copia[clave] = valor;
                continue;
            }
            let nueva = valor;
            const esColDocumento = COLUMNAS_DOCUMENTO.test(clave);
            const antes = nueva;
            nueva = nueva.replace(RE_TELEFONO_CO, "***teléfono***");
            nueva = nueva.replace(RE_EMAIL, "***email***");
            if (esColDocumento) {
                nueva = nueva.replace(RE_DOCUMENTO_LARGO, "***documento***");
            }
            if (nueva !== antes) {
                piiDetectada = true;
                reemplazos += 1;
            }
            copia[clave] = nueva;
        }
        salida.push(copia as T);
    }

    return { filas: salida, piiDetectada, reemplazos };
}
