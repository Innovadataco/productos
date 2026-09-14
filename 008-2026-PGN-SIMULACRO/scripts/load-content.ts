import fs from 'fs';
import path from 'path';
import db from '../lib/db';

interface ContenidoFile {
  preguntas?: {
    tema_clave: string;
    perfil_codigo: string;
    enunciado: string;
    opciones: string[];
    respuesta: number;
    explicacion?: string;
    norma?: string;
    articulo?: string;
    dificultad?: string;
  }[];
  resumenes?: {
    tema_clave: string;
    perfil_codigo: string;
    titulo: string;
    contenido_html: string;
    fuente_url?: string;
    orden?: number;
  }[];
  flashcards?: {
    tema_clave: string;
    perfil_codigo: string;
    frente: string;
    reverso: string;
    norma?: string;
  }[];
}

const contenidoDir = path.join(process.cwd(), 'data', 'contenido');

function getTemaId(clave: string, perfilCodigo: string): number | null {
  const row = db.prepare('SELECT id FROM temas WHERE clave = ? AND perfil_codigo = ?').get(clave, perfilCodigo) as
    | { id: number }
    | undefined;
  return row?.id ?? null;
}

function loadFile(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as ContenidoFile;
}

export function loadContent() {
  if (!fs.existsSync(contenidoDir)) {
    console.log(`No existe ${contenidoDir}; se omite carga de contenido.`);
    return;
  }

  const files = fs.readdirSync(contenidoDir).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const data = loadFile(path.join(contenidoDir, file));

    if (data.preguntas) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO preguntas (tema_id, perfil_codigo, enunciado, opciones, respuesta, explicacion, norma, articulo, dificultad)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const q of data.preguntas) {
        const temaId = getTemaId(q.tema_clave, q.perfil_codigo);
        if (!temaId) {
          console.warn(`Tema no encontrado: ${q.tema_clave} para perfil ${q.perfil_codigo}`);
          continue;
        }
        stmt.run(
          temaId,
          q.perfil_codigo,
          q.enunciado,
          JSON.stringify(q.opciones),
          q.respuesta,
          q.explicacion || '',
          q.norma || '',
          q.articulo || '',
          q.dificultad || 'media'
        );
      }
    }

    if (data.resumenes) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO resumenes (tema_id, perfil_codigo, titulo, contenido_html, fuente_url, orden)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of data.resumenes) {
        const temaId = getTemaId(r.tema_clave, r.perfil_codigo);
        if (!temaId) continue;
        stmt.run(temaId, r.perfil_codigo, r.titulo, r.contenido_html, r.fuente_url || '', r.orden ?? 0);
      }
    }

    if (data.flashcards) {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO flashcards (tema_id, perfil_codigo, frente, reverso, norma)
        VALUES (?, ?, ?, ?, ?)
      `);
      for (const f of data.flashcards) {
        const temaId = getTemaId(f.tema_clave, f.perfil_codigo);
        if (!temaId) continue;
        stmt.run(temaId, f.perfil_codigo, f.frente, f.reverso, f.norma || '');
      }
    }
  }

  console.log('Contenido cargado desde data/contenido/');
}

if (require.main === module) {
  loadContent();
}
