import db from './db';
import { Perfil } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

function cargarPerfiles(): Perfil[] {
  const raw = readFileSync(join(process.cwd(), 'data', 'perfiles.json'), 'utf-8');
  return JSON.parse(raw) as Perfil[];
}

const perfilesIniciales = cargarPerfiles();

interface TemaSeed {
  clave: string;
  nombre: string;
  eje: string;
  color: string;
  icono: string;
}

const temasPorPerfil: Record<string, TemaSeed[]> = {
  '273': [
    { clave: 'planeacion', nombre: 'Planeación estratégica', eje: 'Específico', color: 'bg-blue-500', icono: 'BookOpen' },
    { clave: 'presupuesto', nombre: 'Presupuesto público', eje: 'Específico', color: 'bg-emerald-500', icono: 'Landmark' },
    { clave: 'contratacion', nombre: 'Contratación estatal', eje: 'Específico', color: 'bg-amber-500', icono: 'FileText' },
    { clave: 'administrativo', nombre: 'Derecho administrativo', eje: 'Específico', color: 'bg-indigo-500', icono: 'Scale' },
    { clave: 'proyectos', nombre: 'Formulación y evaluación de proyectos', eje: 'Específico', color: 'bg-rose-500', icono: 'ClipboardList' },
    { clave: 'anticorrupcion', nombre: 'Estatuto anticorrupción', eje: 'Específico', color: 'bg-red-500', icono: 'ShieldAlert' },
    { clave: 'ti-estado', nombre: 'TI en el Estado', eje: 'Disciplinar', color: 'bg-cyan-500', icono: 'Monitor' },
    { clave: 'pgn', nombre: 'Estructura y funciones de la PGN', eje: 'Común', color: 'bg-slate-600', icono: 'Building2' },
    { clave: 'gestion-publica', nombre: 'Gestión pública y funcionamiento del Estado', eje: 'Común', color: 'bg-teal-500', icono: 'Globe' },
    { clave: 'sistemas-gestion', nombre: 'Sistemas de gestión', eje: 'Común', color: 'bg-violet-500', icono: 'Settings' },
    { clave: 'gestion-documental', nombre: 'Gestión documental', eje: 'Común', color: 'bg-orange-500', icono: 'FolderOpen' },
    { clave: 'documentos-oficina', nombre: 'Elaboración de documentos de oficina', eje: 'Común', color: 'bg-pink-500', icono: 'FileEdit' },
    { clave: 'atencion-usuario', nombre: 'Atención al usuario', eje: 'Común', color: 'bg-sky-500', icono: 'Headphones' },
    { clave: 'ofimatica', nombre: 'Herramientas ofimáticas', eje: 'Común', color: 'bg-lime-500', icono: 'Calculator' },
    { clave: 'simulacro', nombre: 'Simulacro mixto', eje: 'Mixto', color: 'bg-fuchsia-600', icono: 'Shuffle' },
  ],
  '35': [
    { clave: 'constitucional', nombre: 'Derecho constitucional', eje: 'Específico', color: 'bg-blue-500', icono: 'BookOpen' },
    { clave: 'disciplinario', nombre: 'Derecho disciplinario', eje: 'Específico', color: 'bg-red-500', icono: 'Gavel' },
    { clave: 'administrativo', nombre: 'Derecho administrativo', eje: 'Específico', color: 'bg-indigo-500', icono: 'Scale' },
    { clave: 'procesal', nombre: 'Derecho procesal', eje: 'Específico', color: 'bg-amber-500', icono: 'FileText' },
    { clave: 'probatorio', nombre: 'Derecho probatorio', eje: 'Específico', color: 'bg-emerald-500', icono: 'Search' },
    { clave: 'contratacion', nombre: 'Contratación estatal', eje: 'Específico', color: 'bg-rose-500', icono: 'Landmark' },
    { clave: 'anticorrupcion', nombre: 'Estatuto anticorrupción', eje: 'Específico', color: 'bg-orange-500', icono: 'ShieldAlert' },
    { clave: 'interpretacion', nombre: 'Interpretación y argumentación jurídica', eje: 'Específico', color: 'bg-cyan-500', icono: 'MessageSquare' },
    { clave: 'territorial', nombre: 'Ordenamiento territorial', eje: 'Específico', color: 'bg-teal-500', icono: 'Map' },
    { clave: 'pgn', nombre: 'Estructura y funciones de la PGN', eje: 'Común', color: 'bg-slate-600', icono: 'Building2' },
    { clave: 'sistemas-gestion', nombre: 'Sistemas de gestión', eje: 'Común', color: 'bg-violet-500', icono: 'Settings' },
    { clave: 'gestion-documental', nombre: 'Gestión documental', eje: 'Común', color: 'bg-pink-500', icono: 'FolderOpen' },
    { clave: 'gestion-publica', nombre: 'Gestión pública y funcionamiento del Estado', eje: 'Común', color: 'bg-lime-500', icono: 'Globe' },
    { clave: 'documentos-oficina', nombre: 'Elaboración de documentos de oficina', eje: 'Común', color: 'bg-sky-500', icono: 'FileEdit' },
    { clave: 'atencion-usuario', nombre: 'Atención al usuario', eje: 'Común', color: 'bg-yellow-500', icono: 'Headphones' },
    { clave: 'ofimatica', nombre: 'Herramientas ofimáticas', eje: 'Común', color: 'bg-fuchsia-500', icono: 'Calculator' },
    { clave: 'simulacro', nombre: 'Simulacro mixto', eje: 'Mixto', color: 'bg-fuchsia-600', icono: 'Shuffle' },
  ],
};

export function crearTablas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfiles (
      codigo TEXT PRIMARY KEY,
      convocatoria TEXT NOT NULL,
      nombre TEXT NOT NULL,
      dependencia TEXT NOT NULL,
      ubicacion TEXT NOT NULL,
      asignacion_basica TEXT NOT NULL,
      disciplina TEXT NOT NULL,
      vacantes INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS temas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      perfil_codigo TEXT NOT NULL,
      clave TEXT NOT NULL,
      nombre TEXT NOT NULL,
      eje TEXT NOT NULL,
      color TEXT NOT NULL,
      icono TEXT NOT NULL,
      orden INTEGER NOT NULL,
      descripcion TEXT NOT NULL DEFAULT '',
      UNIQUE(perfil_codigo, clave)
    );

    CREATE TABLE IF NOT EXISTS preguntas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tema_id INTEGER NOT NULL,
      perfil_codigo TEXT NOT NULL,
      enunciado TEXT NOT NULL UNIQUE,
      opciones TEXT NOT NULL,
      respuesta INTEGER NOT NULL,
      explicacion TEXT NOT NULL DEFAULT '',
      norma TEXT NOT NULL DEFAULT '',
      articulo TEXT NOT NULL DEFAULT '',
      dificultad TEXT NOT NULL DEFAULT 'media'
    );

    CREATE TABLE IF NOT EXISTS resumenes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tema_id INTEGER NOT NULL,
      perfil_codigo TEXT NOT NULL,
      titulo TEXT NOT NULL,
      contenido_html TEXT NOT NULL DEFAULT '',
      fuente_url TEXT NOT NULL DEFAULT '',
      orden INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tema_id INTEGER NOT NULL,
      perfil_codigo TEXT NOT NULL,
      frente TEXT NOT NULL,
      reverso TEXT NOT NULL,
      norma TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS resultados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      perfil_codigo TEXT NOT NULL,
      tema_id INTEGER,
      correctas INTEGER NOT NULL,
      total INTEGER NOT NULL,
      falladas TEXT NOT NULL DEFAULT '',
      duracion_seg INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS respuestas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resultado_id INTEGER NOT NULL,
      pregunta_id INTEGER NOT NULL,
      marcada INTEGER NOT NULL,
      correcta INTEGER NOT NULL
    );
  `);
}

export function insertarPerfiles() {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO perfiles (codigo, convocatoria, nombre, dependencia, ubicacion, asignacion_basica, disciplina, vacantes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const perfil of perfilesIniciales) {
    stmt.run(
      perfil.codigo,
      perfil.convocatoria,
      perfil.nombre,
      perfil.dependencia,
      perfil.ubicacion,
      perfil.asignacion_basica,
      perfil.disciplina,
      perfil.vacantes
    );
  }
}

export function insertarTemasEstructura() {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO temas (perfil_codigo, clave, nombre, eje, color, icono, orden, descripcion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [perfilCodigo, temas] of Object.entries(temasPorPerfil)) {
    temas.forEach((tema, index) => {
      stmt.run(
        perfilCodigo,
        `${tema.clave}-${perfilCodigo}`,
        tema.nombre,
        tema.eje,
        tema.color,
        tema.icono,
        index + 1,
        'Contenido temporal — se cargará con material oficial.'
      );
    });
  }
}

export function seed() {
  crearTablas();
  insertarPerfiles();
  insertarTemasEstructura();
}

if (require.main === module) {
  seed();
  console.log('Base de datos sembrada.');
}
