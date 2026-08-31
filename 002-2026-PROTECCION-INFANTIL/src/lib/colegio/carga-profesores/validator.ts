/**
 * SPEC-335: valida y clasifica cada fila de la carga de profesores.
 * El rector ve, por fila: crear · omitido (con motivo) · error (con motivo).
 * Decisión CEO: el duplicado se REPORTA, nunca se omite en silencio.
 */
import type { FilaCargaProfesor } from "./parser";

export type EstadoFila = "crear" | "omitido" | "error";

export type FilaClasificada = {
    fila: number;
    nombre: string;
    apellidos: string;
    documento: string;
    estado: EstadoFila;
    motivo?: string;
};

export type ProfesorACrear = {
    nombre: string;
    apellidos: string;
    tipoDocumento: string;
    numeroDocumento: string;
    anioNacimiento: number;
    sexo: string;
    email: string;
    telefono: string;
};

export type ResultadoValidacionProfesores = {
    clasificadas: FilaClasificada[];
    aCrear: ProfesorACrear[];
    resumen: { crear: number; omitidos: number; errores: number };
};

const SEXOS = new Set(["M", "F", "OTRO"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANIO_MIN = 1900;

function claveIdentidad(tipoDocumento: string, numeroDocumento: string): string {
    return `${tipoDocumento.trim().toUpperCase()}|${numeroDocumento.trim().toUpperCase()}`;
}

/**
 * @param filas             filas parseadas del archivo
 * @param tiposActivos      claves de TipoDocumento activas en el catálogo
 * @param documentosEnBd    identidades ya existentes en el colegio (clave `tipo|numero`)
 */
export function validarFilasProfesores(
    filas: FilaCargaProfesor[],
    tiposActivos: Set<string>,
    documentosEnBd: Set<string>
): ResultadoValidacionProfesores {
    const clasificadas: FilaClasificada[] = [];
    const aCrear: ProfesorACrear[] = [];
    const vistasEnArchivo = new Set<string>();
    const anioMax = new Date().getFullYear();

    for (const f of filas) {
        const base = {
            fila: f.fila,
            nombre: f.nombre,
            apellidos: f.apellidos,
            documento: `${f.tipoDocumento} ${f.numeroDocumento}`.trim(),
        };

        // 1) Obligatorios presentes.
        const faltantes: string[] = [];
        if (!f.nombre) faltantes.push("nombre");
        if (!f.apellidos) faltantes.push("apellidos");
        if (!f.tipoDocumento) faltantes.push("tipo_documento");
        if (!f.numeroDocumento) faltantes.push("numero_documento");
        if (!f.anioNacimiento) faltantes.push("anio_nacimiento");
        if (!f.sexo) faltantes.push("sexo");
        if (!f.email) faltantes.push("email");
        if (!f.telefono) faltantes.push("telefono");
        if (faltantes.length > 0) {
            clasificadas.push({ ...base, estado: "error", motivo: `Faltan datos: ${faltantes.join(", ")}` });
            continue;
        }

        // 2) Tipo de documento del catálogo, activo.
        const tipo = f.tipoDocumento.trim().toUpperCase();
        if (!tiposActivos.has(tipo)) {
            clasificadas.push({ ...base, estado: "error", motivo: `Tipo de documento no válido o inactivo: ${f.tipoDocumento}` });
            continue;
        }

        // 3) Sexo del set cerrado.
        const sexo = f.sexo.trim().toUpperCase();
        if (!SEXOS.has(sexo)) {
            clasificadas.push({ ...base, estado: "error", motivo: `Sexo inválido: ${f.sexo}. Use M, F u OTRO` });
            continue;
        }

        // 4) Email con formato.
        const email = f.email.trim();
        if (!EMAIL_RE.test(email)) {
            clasificadas.push({ ...base, estado: "error", motivo: `Email inválido: ${f.email}` });
            continue;
        }

        // 5) Año de nacimiento plausible.
        const anio = Number.parseInt(f.anioNacimiento, 10);
        if (!Number.isFinite(anio) || anio < ANIO_MIN || anio > anioMax) {
            clasificadas.push({ ...base, estado: "error", motivo: `Año de nacimiento inválido: ${f.anioNacimiento}` });
            continue;
        }

        const clave = claveIdentidad(f.tipoDocumento, f.numeroDocumento);

        // 6) Duplicado dentro del archivo → se reporta; solo se crea la primera.
        if (vistasEnArchivo.has(clave)) {
            clasificadas.push({ ...base, estado: "omitido", motivo: "repetido en el archivo" });
            continue;
        }

        // 7) Ya existe en el colegio → se reporta (decisión CEO), no se crea.
        if (documentosEnBd.has(clave)) {
            clasificadas.push({ ...base, estado: "omitido", motivo: "ya existe por documento" });
            continue;
        }

        vistasEnArchivo.add(clave);
        clasificadas.push({ ...base, estado: "crear" });
        aCrear.push({
            nombre: f.nombre.trim(),
            apellidos: f.apellidos.trim(),
            tipoDocumento: tipo,
            numeroDocumento: f.numeroDocumento.trim(),
            anioNacimiento: anio,
            sexo,
            email,
            telefono: f.telefono.trim(),
        });
    }

    return {
        clasificadas,
        aCrear,
        resumen: {
            crear: clasificadas.filter((c) => c.estado === "crear").length,
            omitidos: clasificadas.filter((c) => c.estado === "omitido").length,
            errores: clasificadas.filter((c) => c.estado === "error").length,
        },
    };
}

export { claveIdentidad };
