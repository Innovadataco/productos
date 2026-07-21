import ExcelJS from 'exceljs';

export class ServicioExportacion {
  public async exportDataToXLSX(data: any[]) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Datos');

    // Definir encabezados de columna
    worksheet.columns = [
      { header: 'Nombre', key: 'name', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
    ];

    // Agregar filas con los datos
    data.forEach((item) => {
      worksheet.addRow(item);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  public async encuestaToXLSX(data: any[], cabeceras: any[], nombre:string) {    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(nombre);

    // Definir encabezados de columna
    worksheet.columns = cabeceras;

    // Agregar filas con los datos
    data.forEach((item) => {
      worksheet.addRow(item);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}
