import { SECTORES_COLOMBIA } from "./sectoresColombia";

export function buildDocumentAnalysisPrompt(text: string): string {
  const sectores = SECTORES_COLOMBIA.join(", ");
  return `Analiza el siguiente documento oficial colombiano y extrae la información en JSON válido.

REGLAS:
- Responde ÚNICAMENTE con un objeto JSON. Sin markdown, sin explicaciones.
- Si un campo no se encuentra, usa string vacío "" o null.
- La fecha debe estar en formato ISO "YYYY-MM-DD". Si solo hay texto en español, conviértela.
- El sector debe ser uno de esta lista: ${sectores}.

TEXT DEL DOCUMENTO:
---
${text.slice(0, 8000)}
---

SCHEMA DE SALIDA:
{
  "titulo": "string",
  "numero": "string",
  "entidad": "string",
  "sector": "string",
  "fecha": "YYYY-MM-DD",
  "resumen": "string max 500 chars",
  "proposito": "string max 300 chars",
  "actores": "string max 300 chars",
  "motivacion": "string max 300 chars",
  "resuelve": "string max 500 chars"
}`;
}

export function buildResearchPrompt(text: string): string {
  return `Eres un analista experto en documentos legales y operativos colombianos. Realiza un análisis estratégico del siguiente documento y responde ÚNICAMENTE con JSON válido.

REGLAS:
- Sin markdown, sin explicaciones fuera del JSON.
- Si no hay información para un campo, usa string vacío "".

DOCUMENTO:
---
${text.slice(0, 12000)}
---

SCHEMA DE SALIDA:
{
  "summary": "string max 400 chars",
  "milestones": ["string"],
  "risks": ["string"],
  "recommendations": ["string"]
}`;
}

export function sanitizeJsonText(text: string): string {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1) return cleaned;
  return cleaned.slice(first, last + 1);
}
