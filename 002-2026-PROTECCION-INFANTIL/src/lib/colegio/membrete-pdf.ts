/**
 * SPEC-379 (D1) — Membrete institucional del colegio para PDFs `pdfmake`.
 *
 * Un mismo helper para todos los informes colegio-scope: `pdf-informe-caso`
 * (ya emitido, refactor futuro con cuidado del sello), `pdf-informe-mensual`
 * (react-pdf — lleva su equivalente JSX en paralelo), `pdf-estadisticas`.
 *
 * El escudo es OPCIONAL: si el colegio no lo cargó, el membrete sale igual,
 * sin imagen. Nunca romperse por eso.
 *
 * NO crea `pdfmake.Content` en un solo bloque — devuelve un arreglo para que
 * cada PDF lo intercale con su título/subtítulo propio.
 */
import type { Content } from "pdfmake/interfaces";

export interface ColegioMembrete {
    nombre: string;
    nit: string;
    /** Data URI ya listo del escudo, o `null` si el colegio no lo cargó. */
    escudoDataUri: string | null;
}

/** Devuelve el bloque cabecera (imagen si hay + nombre + `NIT ...`). */
export function armarMembreteColegio(colegio: ColegioMembrete): Content[] {
    const bloque: Content[] = [];
    if (colegio.escudoDataUri) {
        bloque.push({
            image: colegio.escudoDataUri,
            fit: [64, 64],
            margin: [0, 0, 0, 6],
        });
    }
    bloque.push({ text: colegio.nombre, style: "membreteNombre" });
    bloque.push({ text: `NIT ${colegio.nit}`, style: "membreteNit" });
    return bloque;
}

/**
 * Estilos que espera `armarMembreteColegio`. El PDF los mezcla con los suyos.
 * `fontSize` / `color` acompañan la paleta de cada PDF: usamos negro para el
 * nombre (autoridad institucional, no color de marca) y gris para el NIT.
 */
export const estilosMembrete = {
    membreteNombre: { fontSize: 16, bold: true, color: "#1f2937", margin: [0, 0, 0, 2] as [number, number, number, number] },
    membreteNit: { fontSize: 9, color: "#6b7280", margin: [0, 0, 0, 2] as [number, number, number, number] },
};
