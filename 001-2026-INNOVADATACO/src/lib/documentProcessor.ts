const PDFParser = require("pdf2json");

export interface DocumentAnalysis {
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
  const firstChunk = clean.slice(0, 2000);

  return {
    resumen: extractParagraphs(text, 3).slice(0, 800),
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
