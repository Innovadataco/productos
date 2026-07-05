const PDFParser = require("pdf2json");
import { ENTIDADES_COLOMBIA } from "./entidadesColombia";
import { SECTORES_COLOMBIA } from "./sectoresColombia";

export interface DocumentAnalysis {
  titulo: string;
  numero: string;
  entidad: string;
  sector: string;
  fecha: string;
  resumen: string;
  proposito: string;
  actores: string;
  motivacion: string;
  resuelve: string;
}

function findSection(text: string, keywords: string[]): string {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    const idx = lower.indexOf(keyword.toLowerCase());
    if (idx !== -1) {
      const start = text.slice(idx, idx + 600);
      return start.replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

function firstSentence(text: string): string {
  const m = text.match(/[^.!?]+[.!?]+/);
  return m ? m[0].trim() : text.slice(0, 200).trim();
}

function extractTitulo(text: string): string {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 3);
  const officialLine = lines.find((l) => /^(resoluci[o\u00f3]n|decreto|ley|circular|acuerdo)\s+/i.test(l));
  if (officialLine) return officialLine.slice(0, 200);
  const inline = text.match(/(resoluci[o\u00f3]n|decreto|ley|circular|acuerdo)\s+(?:n[\u00b0\u00bao]|n[u\u00fa]mero|num\.?|no\.?)?\.?\s*\d+\s+de\s+\d{4}/i);
  if (inline) return inline[0].slice(0, 200);
  const first = lines.slice(0, 3).filter((l) => l.length < 120 && !/p\u00e1gina|p\u00e1g|p\u00e1gs?\.?\s*\d+/i.test(l));
  return first.join(" - ").slice(0, 200) || "Sin t\u00edtulo";
}

function extractNumero(text: string): string {
  const patterns = [
    /(?:n[\u00b0\u00bao]|n[\u00fau]mero|numero|no\.?)\s*[:\-]?\s*(\d+[\-\/\.\d]*)/i,
    /(?:resoluci[o\u00f3]n|decreto|ley|circular)\s*(?:n[\u00b0\u00bao]?\s*)?(\d+[\-\/\.\d]*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ");
}

function extractEntidad(text: string): string {
  const normText = normalize(text);
  for (const entidad of ENTIDADES_COLOMBIA) {
    const normEntidad = normalize(entidad);
    if (normText.includes(normEntidad.slice(0, 35)) || normText.includes(normEntidad.slice(-30))) {
      return entidad;
    }
  }
  return "";
}

function extractSector(text: string): string {
  const normText = normalize(text);
  for (const sector of SECTORES_COLOMBIA) {
    const normSector = normalize(sector);
    if (normText.includes(normSector.slice(0, 20))) return sector;
  }
  return "";
}

function extractFecha(text: string): string {
  // evitar pies de p\u00e1gina con c\u00f3digos tipo 14305 31/12/2024
  const clean = text.replace(/\b\d{5,}\s+(\d{1,2}\/\d{1,2}\/\d{4})/g, "");
  const meses: Record<string, string> = {
    enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
    julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
  };
  const patterns = [
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
  ];
  for (const p of patterns) {
    const m = clean.match(p);
    if (m) {
      if (m[0].toLowerCase().includes("de")) {
        const [d, mo, y] = [m[1], m[2], m[3]];
        return `${y}-${meses[mo.toLowerCase()]}-${d.padStart(2, "0")}`;
      }
      if (m[0].includes("/")) {
        const [d, mo, y] = [m[1], m[2], m[3]];
        return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      return m[0];
    }
  }
  return "";
}

export function extractParagraphs(text: string, limit = 5): string {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 60)
    .slice(0, limit)
    .join("\n\n");
}

export function analyzeDocument(text: string): DocumentAnalysis {
  const clean = text.replace(/\s+/g, " ").trim();
  const firstChunk = clean.slice(0, 3000);

  return {
    titulo: extractTitulo(text),
    numero: extractNumero(firstChunk),
    entidad: extractEntidad(firstChunk),
    sector: extractSector(firstChunk),
    fecha: extractFecha(firstChunk),
    resumen: extractParagraphs(text, 3).slice(0, 1000),
    proposito: findSection(firstChunk, ["OBJETO", "PROP\u00d3SITO", "Objeto", "prop\u00f3sito", "finalidad", "FINALIDAD"]) || firstSentence(clean),
    actores: findSection(firstChunk, ["PARTES", "ACTORES", "INVOLUCRADOS", "autoridad", "ministro", "ente"]) || "No identificado",
    motivacion: findSection(firstChunk, ["CONSIDERANDO", "MOTIVACI\u00d3N", "Por medio", "visto", "considerando"]) || firstSentence(clean),
    resuelve: findSection(clean, ["RESUELVE", "RESOLVI\u00d3", "ACUERDA", "dispone", "RESOLUCI\u00d3N"]) || firstSentence(clean),
  };
}

export function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Timeout extrayendo texto del PDF"));
      }
    }, 15000);
    pdfParser.on("pdfParser_dataError", (err: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err?.parserError || err || new Error("Error parseando PDF"));
      }
    });
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const text = pdfData.Pages
          .map((page: any) =>
            page.Texts.map((t: any) =>
              t.R.map((r: any) => decodeURIComponent(r.T)).join(" ")
            ).join(" ")
          )
          .join("\n\n");
        resolve(text);
      }
    });
    try {
      pdfParser.parseBuffer(buffer);
    } catch (err) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        reject(err);
      }
    }
  });
}
