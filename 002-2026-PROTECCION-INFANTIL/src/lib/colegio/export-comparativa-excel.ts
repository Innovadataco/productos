import ExcelJS from "exceljs";
import type { ComparativaCursos } from "./comparativa";

/**
 * Genera un buffer XLSX con la comparativa de cursos.
 * Hoja única, sin fórmulas ni macros, determinista.
 */
export async function generarExcelComparativa(datos: ComparativaCursos): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Comparativa");

    sheet.columns = [
        { header: "Grupo", key: "grupo", width: 24 },
        { header: "Cursos", key: "cursos", width: 12 },
        { header: "Estudiantes", key: "estudiantes", width: 14 },
        { header: "Identificadores", key: "identificadores", width: 16 },
        { header: "Alertas", key: "alertas", width: 12 },
        { header: "Promedio estudiantes/curso", key: "promedioEstudiantes", width: 28 },
    ];

    for (const grupo of datos.grupos) {
        sheet.addRow(grupo);
    }

    const promedioTotal =
        datos.totales.cursos > 0
            ? Math.round((datos.totales.estudiantes / datos.totales.cursos) * 10) / 10
            : 0;

    sheet.addRow({
        grupo: "TOTAL",
        cursos: datos.totales.cursos,
        estudiantes: datos.totales.estudiantes,
        identificadores: datos.totales.identificadores,
        alertas: datos.totales.alertas,
        promedioEstudiantes: promedioTotal,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
