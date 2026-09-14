/**
 * webhook_resultados.gs
 * Recibe resultados de quizzes desde pr.innovadataco.com y los guarda en Sheet.
 *
 * Deploy:
 *   1. Apps Script > Implementar > Nueva implementación
 *   2. Tipo: Aplicación web
 *   3. Ejecutar como: Yo
 *   4. Acceso: Cualquier persona
 *   5. Copia la URL de implementación y ponla en NEXT_PUBLIC_RESULTS_WEBHOOK
 */

const SHEET_ID = '16S3fArXSV_2yAFOcK-49GD8yOzlG7du3mr8ztPGjEYI';

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);

    var sheet = ss.getSheetByName('resultados');
    if (!sheet) {
      sheet = ss.insertSheet('resultados');
      sheet.appendRow([
        'timestamp', 'perfil', 'tema', 'correctas', 'total',
        'porcentaje', 'falladas', 'duracion_seg'
      ]);
    }

    var porcentaje = data.total > 0
      ? Math.round((data.correctas / data.total) * 100)
      : 0;

    var falladas = Array.isArray(data.falladas)
      ? data.falladas.join(',')
      : String(data.falladas || '');

    sheet.appendRow([
      new Date(),
      data.perfil || '',
      data.tema || '',
      Number(data.correctas || 0),
      Number(data.total || 0),
      porcentaje,
      falladas,
      Number(data.duracion_seg || 0)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Webhook activo. Use POST.' }))
    .setMimeType(ContentService.MimeType.JSON);
}
