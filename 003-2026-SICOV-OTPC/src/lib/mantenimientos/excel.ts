import ExcelJS from "exceljs";
import { DateTime } from "luxon";
import { Readable } from "node:stream";
import { TIPOS_IDENTIFICACION } from "@/lib/mantenimientos/tipos";
import { COLUMNAS_PREVENTIVO_CORRECTIVO, type RegistroFila } from "@/lib/mantenimientos/validacion";

/// Lectura y generación de archivos de carga masiva (spec 005-A, US2).
/// XLSX (paridad legacy, ExcelJS) y CSV (formato nuevo D-019e) comparten TODO el pipeline:
/// el CSV se lee con el lector de la MISMA librería hacia un worksheet (research R5).
/// Normalización de fechas/horas portada del legacy con luxon (mismos formatos — R12/D11).

export const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024; // 5 MB (paridad request.file size '5mb')

export interface LecturaArchivo {
  registros: RegistroFila[];
  errores: string[]; // "Fila N: <columnas faltantes>" — campos requeridos vacíos
  totalFilas: number;
}

/// Fechas: Date / serial de Excel / dd/MM/yyyy / MM/dd/yyyy / dd-MM-yyyy / MM-dd-yyyy / ISO /
/// RFC2822 → AAAA-MM-DD sin corrimiento de zona (componentes de fecha, no instantes).
export function normalizarFechaExcel(valor: unknown): string | null {
  if (valor instanceof Date) {
    return DateTime.fromObject(
      { year: valor.getFullYear(), month: valor.getMonth() + 1, day: valor.getDate() },
      { zone: "utc" },
    ).toISODate();
  }
  if (typeof valor === "number") {
    // Serial de Excel (época 1900; 25569 = días hasta 1970-01-01).
    const jsDate = new Date(Math.round((valor - 25569) * 86_400 * 1000));
    return DateTime.fromObject(
      { year: jsDate.getUTCFullYear(), month: jsDate.getUTCMonth() + 1, day: jsDate.getUTCDate() },
      { zone: "utc" },
    ).toISODate();
  }
  if (typeof valor === "string") {
    const limpio = valor.trim();
    if (limpio === "") return null;
    const candidatos = [
      DateTime.fromISO(limpio),
      DateTime.fromFormat(limpio, "dd/MM/yyyy"),
      DateTime.fromFormat(limpio, "MM/dd/yyyy"),
      DateTime.fromFormat(limpio, "dd-MM-yyyy"),
      DateTime.fromFormat(limpio, "MM-dd-yyyy"),
      DateTime.fromRFC2822(limpio),
    ];
    for (const c of candidatos) if (c.isValid) return c.toISODate();
    const desdeJS = DateTime.fromJSDate(new Date(limpio));
    if (desdeJS.isValid) return desdeJS.toISODate();
    return limpio; // la validación de formato lo reportará como "Fila N: ..."
  }
  return null;
}

/// Horas: Date / fracción de día de Excel / H:mm / HH:mm(:ss) / h:mm(:ss) a → HH:mm.
export function normalizarHoraExcel(valor: unknown): string | null {
  if (valor instanceof Date) {
    // Las horas de celda XLSX llegan como Date UTC sobre la época de Excel.
    return DateTime.fromJSDate(valor, { zone: "utc" }).toFormat("HH:mm");
  }
  if (typeof valor === "number") {
    const totalSegundos = Math.round(valor * 24 * 60 * 60);
    const horas = Math.floor(totalSegundos / 3600) % 24;
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
  }
  if (typeof valor === "string") {
    const limpio = valor.trim();
    if (limpio === "") return null;
    const candidatos = [
      DateTime.fromFormat(limpio, "HH:mm"),
      DateTime.fromFormat(limpio, "H:mm"),
      DateTime.fromFormat(limpio, "HH:mm:ss"),
      DateTime.fromFormat(limpio, "H:mm:ss"),
      DateTime.fromFormat(limpio, "hh:mm a"),
      DateTime.fromFormat(limpio, "h:mm a"),
      DateTime.fromFormat(limpio, "hh:mm:ss a"),
      DateTime.fromFormat(limpio, "h:mm:ss a"),
      DateTime.fromISO(limpio),
    ];
    for (const c of candidatos) if (c.isValid) return c.toFormat("HH:mm");
    return limpio; // la regex del borde lo reportará
  }
  return null;
}

function normalizarValorCelda(clave: string, celda: ExcelJS.Cell): unknown {
  const llave = clave.toLowerCase();
  const valor = celda.value ?? (celda.text || "").trim();
  if (llave === "fecha") return normalizarFechaExcel(valor);
  if (llave === "hora") return normalizarHoraExcel(valor);
  if (valor instanceof Date) return DateTime.fromJSDate(valor).toISO();
  if (typeof valor === "string") {
    const limpio = valor.trim();
    return limpio === "" ? null : limpio;
  }
  if (typeof valor === "number") {
    const texto = (celda.text || "").trim();
    return texto !== "" ? texto : valor;
  }
  if (valor && typeof valor === "object" && "text" in (valor as object)) {
    const texto = String((valor as { text: unknown }).text).trim();
    return texto === "" ? null : texto;
  }
  const texto = (celda.text || "").trim();
  return texto === "" ? null : texto;
}

function leerWorksheet(worksheet: ExcelJS.Worksheet): LecturaArchivo {
  const headerRow = worksheet.getRow(1);
  // row.values de exceljs es 1-based (slot 0 vacío): se filtra como en el legacy para que el
  // índice de header coincida con la columna (index+1).
  const headers = ((headerRow.values as unknown as unknown[]) || [])
    .map((v) => (typeof v === "number" ? String(v) : v))
    .map((v) => (typeof v === "string" ? v.trim() : v))
    .filter((v): v is string => typeof v === "string" && v !== "");

  const headersNormalizados = new Map<string, string>();
  for (const h of headers) headersNormalizados.set(h.toLowerCase(), h);

  const faltantes = COLUMNAS_PREVENTIVO_CORRECTIVO.filter(
    (c) => !headersNormalizados.has(c.nombre.toLowerCase()),
  );
  if (faltantes.length > 0) {
    const detalle = faltantes.map((c) => `${c.nombre} (${c.descripcion})`).join(", ");
    const err = new Error(`El archivo no contiene las columnas requeridas: ${detalle}`) as Error & {
      status?: number;
    };
    err.status = 400;
    throw err;
  }

  const registros: RegistroFila[] = [];
  const erroresFilas: string[] = [];
  let totalFilas = 0;

  worksheet.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return;
    const registro: RegistroFila = {};
    headers.forEach((encabezado, index) => {
      registro[encabezado] = normalizarValorCelda(encabezado, fila.getCell(index + 1));
    });

    const tieneDatos = Object.values(registro).some(
      (v) => v !== null && v !== undefined && String(v).trim() !== "",
    );
    if (!tieneDatos) return; // filas vacías se ignoran (paridad)

    totalFilas += 1;
    const vaciosEnFila: string[] = [];
    for (const col of COLUMNAS_PREVENTIVO_CORRECTIVO) {
      const llaveReal = headersNormalizados.get(col.nombre.toLowerCase()) ?? col.nombre;
      const v = registro[llaveReal];
      if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
        vaciosEnFila.push(`${col.nombre} (${col.descripcion})`);
      }
    }
    if (vaciosEnFila.length > 0) {
      erroresFilas.push(`Fila ${numeroFila}: ${vaciosEnFila.join(", ")}`);
      return;
    }
    Object.defineProperty(registro, "__fila__", { value: numeroFila, enumerable: false });
    registros.push(registro);
  });

  return { registros, errores: erroresFilas, totalFilas };
}

/// Lee un XLSX desde buffer (hoja 1) al pipeline común.
export async function leerRegistrosXlsx(buffer: Buffer): Promise<LecturaArchivo> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { registros: [], errores: [], totalFilas: 0 };
  return leerWorksheet(worksheet);
}

/// Lee un CSV (delimitador `,` con tolerancia a `;` — auto-detección sobre el encabezado)
/// con el lector CSV de exceljs hacia el MISMO pipeline. Los valores llegan como texto crudo
/// (map identidad): la normalización por string de fechas/horas ya lo cubre.
export async function leerRegistrosCsv(buffer: Buffer): Promise<LecturaArchivo> {
  const texto = buffer.toString("utf8");
  const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = primeraLinea.includes(";") && !primeraLinea.includes(",") ? ";" : ",";

  const workbook = new ExcelJS.Workbook();
  const worksheet = await workbook.csv.read(Readable.from([texto]), {
    parserOptions: { delimiter },
    map: (v: unknown) => v, // crudo: sin auto-parseo de fechas/números
  });
  if (!worksheet) return { registros: [], errores: [], totalFilas: 0 };
  // Re-aplica la normalización de fecha/hora que en XLSX hace la celda.
  const lectura = leerWorksheet(worksheet);
  for (const r of lectura.registros) {
    for (const k of Object.keys(r)) {
      const lk = k.toLowerCase();
      if (lk === "fecha") r[k] = normalizarFechaExcel(r[k]);
      if (lk === "hora") r[k] = normalizarHoraExcel(r[k]);
    }
  }
  return lectura;
}

/// Plantilla oficial (manual §10.10): hoja `mantenimiento` con las 10 columnas + hoja auxiliar
/// `tipos_identificacion` con los 12 códigos (D-022 #5). 100% server-side.
export async function generarPlantillaPreventivoCorrectivo(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("mantenimiento");
  hoja.columns = COLUMNAS_PREVENTIVO_CORRECTIVO.map((c) => ({
    header: c.nombre,
    key: c.nombre,
    width: Math.max(14, c.nombre.length + 6),
  }));
  hoja.addRow({});

  const hojaTipos = workbook.addWorksheet("tipos_identificacion");
  hojaTipos.columns = [
    { header: "codigo", key: "codigo", width: 10 },
    { header: "descripcion", key: "descripcion", width: 40 },
  ];
  for (const t of TIPOS_IDENTIFICACION) {
    hojaTipos.addRow({ codigo: t.codigo, descripcion: t.descripcion });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/// Exporta el historial a XLSX con cabeceras dinámicas (paridad exportarAXLSX — pero CON auth).
export async function historialAXlsx(filas: Array<Record<string, unknown>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("datos");
  const claves = Object.keys(filas[0] ?? {});
  hoja.columns = claves.map((k) => ({ header: k, key: k, width: 20 }));
  for (const fila of filas) hoja.addRow(fila);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
