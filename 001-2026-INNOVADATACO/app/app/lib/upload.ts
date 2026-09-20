import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export function getUploadDir(tipo: "oportunidad" | "proyecto", id: string) {
  const carpeta = tipo === "oportunidad" ? "oportunidades" : "proyectos";
  return path.join(UPLOAD_DIR, carpeta, id);
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveFile(file: File, dir: string, fileName: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function deleteFile(filePath: string) {
  await fs.unlink(filePath);
}

export function safeFileName(name: string) {
  return `${Date.now()}_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
}
