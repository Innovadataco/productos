const PDFParser = require("pdf2json");
import { ENTIDADES_COLOMBIA } from "./entidadesColombia";

export interface DocumentAnalysis {
  titulo: string;
  numero: string;
  entidad: string;
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
  const inline = text.match(/(resoluci[o\u00f3]n|decreto|ley|circular|acuerdo)\s+(no\.?\s*)?\d+[^.]{0,80}/i);
  if (inline) return inline[0].slice(0, 200);
  const first = lines.slice(0, 3).filter((l) => l.length < 120);
  return first.join(" - ").slice(0, 200) || "Sin título";
}

function extractNumero(text: string): string {
  const patterns = [
    /(?:n[°º]|n[úu]mero|numero|no\.?)\s*[:\-]?\s*(\d+[\-\/\.\d]*)/i,
    /(?:resoluci[oó]n|decreto|ley|circular)\s*(?:n[°º]\s*)?(\d+[\-\/\.\d]*)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return "";
}

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function extractFecha(text: string): string {
  const patterns = [
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i,
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      if (m[0].toLowerCase().includes("de")) {
        return `${m[1]} ${m[2]} ${m[3]}`;
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
    fecha: extractFecha(firstChunk),
    resumen: extractParagraphs(text, 3).slice(0, 1000),
    proposito: findSection(firstChunk, ["OBJETO", "PROPÓSITO", "Objeto", "propósito", "finalidad", "FINALIDAD"]) || firstSentence(clean),
    actores: findSection(firstChunk, ["PARTES", "ACTORES", "INVOLUCRADOS", "autoridad", "ministro", "ente"]) || "No identificado",
    motivacion: findSection(firstChunk, ["CONSIDERANDO", "MOTIVACIÓN", "Por medio", "visto", "considerando"]) || firstSentence(clean),
    resuelve: findSection(clean, ["RESUELVE", "RESOLVIÓ", "ACUERDA", "dispone", "RESOLUCIÓN"]) || firstSentence(clean),
  };
}

export function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on("pdfParser_dataError", (err: any) => reject(err));
    pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
      const text = pdfData.Pages
        .map((page: any) =>
          page.Texts.map((t: any) =>
            t.R.map((r: any) => decodeURIComponent(r.T)).join(" ")
          ).join(" ")
        )
        .join("\n\n");
      resolve(text);
    });
    pdfParser.parseBuffer(buffer);
  });
}
