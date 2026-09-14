import fs from 'fs';
import path from 'path';
import db from '../lib/db';

const outDir = path.join(process.cwd(), 'public', 'data');

function ensureDir() {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
}

function writeJson(name: string, data: unknown) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(data, null, 2));
}

function generate() {
  ensureDir();

  const perfiles = db.prepare('SELECT * FROM perfiles').all();
  const temas = db.prepare('SELECT * FROM temas ORDER BY orden').all();
  const resumenes = db.prepare('SELECT * FROM resumenes ORDER BY orden').all();
  const flashcards = db.prepare('SELECT * FROM flashcards').all();
  const resultados = db.prepare('SELECT * FROM resultados ORDER BY created_at DESC').all();

  const preguntasRaw = db.prepare('SELECT * FROM preguntas').all() as Array<{
    id: number;
    tema_id: number;
    perfil_codigo: string;
    enunciado: string;
    opciones: string;
    respuesta: number;
    explicacion: string;
    norma: string;
    articulo: string;
    dificultad: string;
  }>;
  const preguntas = preguntasRaw.map((row) => ({
    ...row,
    opciones: JSON.parse(row.opciones) as string[],
  }));

  writeJson('perfiles', perfiles);
  writeJson('temas', temas);
  writeJson('preguntas', preguntas);
  writeJson('resumenes', resumenes);
  writeJson('flashcards', flashcards);
  writeJson('resultados', resultados);

  console.log('Datos estáticos generados en public/data/');
}

generate();
