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
  descripcion: string;
  eje: string;
  color: string;
  icono: string;
}

export const temasPorPerfil: Record<string, TemaSeed[]> = {
  '273': [
    { clave: 'planeacion', nombre: 'Planeación estratégica', descripcion: 'Plan Nacional de Desarrollo, planes institucionales, indicadores, seguimiento y evaluación de políticas públicas.', eje: 'Específico', color: 'bg-blue-500', icono: 'BookOpen' },
    { clave: 'presupuesto', nombre: 'Presupuesto público', descripcion: 'Clasificación del gasto, disponibilidad presupuestal, certificados de disponibilidad, PAC y ejecución fiscal.', eje: 'Específico', color: 'bg-emerald-500', icono: 'Landmark' },
    { clave: 'contratacion', nombre: 'Contratación estatal', descripcion: 'Licitación, selección abreviada, mínima cuantía, decreto 1082 de 2015, SECOP II, garantías y supervisión.', eje: 'Específico', color: 'bg-amber-500', icono: 'FileText' },
    { clave: 'administrativo', nombre: 'Derecho administrativo', descripcion: 'Acto administrativo, procedimiento administrativo, CPACA, recursos, nulidad y restablecimiento del derecho.', eje: 'Específico', color: 'bg-indigo-500', icono: 'Scale' },
    { clave: 'proyectos', nombre: 'Formulación y evaluación de proyectos', descripcion: 'Metodología MGA del DNP, marco lógico, indicadores, BPIN, evaluación de costos y beneficios.', eje: 'Específico', color: 'bg-rose-500', icono: 'ClipboardList' },
    { clave: 'anticorrupcion', nombre: 'Estatuto anticorrupción', descripcion: 'Ley 1474 de 2011, planes anticorrupción, denuncias, ética pública, prevención y control de la corrupción.', eje: 'Específico', color: 'bg-red-500', icono: 'ShieldAlert' },
    { clave: 'ti-estado', nombre: 'TI en el Estado', descripcion: 'Gobierno digital, arquitectura empresarial, interoperabilidad, seguridad de la información y MSPI.', eje: 'Disciplinar', color: 'bg-cyan-500', icono: 'Monitor' },
    { clave: 'pgn', nombre: 'Estructura y funciones de la PGN', descripcion: 'Ministerio Público, control disciplinario, estructura de la Procuraduría General de la Nación y competencias.', eje: 'Común', color: 'bg-slate-600', icono: 'Building2' },
    { clave: 'gestion-publica', nombre: 'Gestión pública y funcionamiento del Estado', descripcion: 'Constitución Política, organización del Estado, descentralización, función pública y control.', eje: 'Común', color: 'bg-teal-500', icono: 'Globe' },
    { clave: 'sistemas-gestion', nombre: 'Sistemas de gestión', descripcion: 'Modelo Integrado de Planeación y Gestión, MECI, FURAG, gestión de calidad y gestión del riesgo.', eje: 'Común', color: 'bg-violet-500', icono: 'Settings' },
    { clave: 'gestion-documental', nombre: 'Gestión documental', descripcion: 'Ciclo vital del documento, archivo, tablas de retención, AGN y normativa de gestión documental.', eje: 'Común', color: 'bg-orange-500', icono: 'FolderOpen' },
    { clave: 'documentos-oficina', nombre: 'Elaboración de documentos de oficina', descripcion: 'Conceptos técnicos, informes, comunicaciones, memorandos y redacción de documentos administrativos.', eje: 'Común', color: 'bg-pink-500', icono: 'FileEdit' },
    { clave: 'atencion-usuario', nombre: 'Atención al usuario', descripcion: 'Servicio al ciudadano, PQRD, derecho de petición, trámites y canales de atención.', eje: 'Común', color: 'bg-sky-500', icono: 'Headphones' },
    { clave: 'ofimatica', nombre: 'Herramientas ofimáticas', descripcion: 'Hojas de cálculo, procesadores de texto, presentaciones y herramientas de productividad ofimática.', eje: 'Común', color: 'bg-lime-500', icono: 'Calculator' },
    { clave: 'simulacro', nombre: 'Simulacro mixto', descripcion: 'Preguntas aleatorias de todos los ejes del perfil para medir tu nivel general antes del concurso.', eje: 'Mixto', color: 'bg-fuchsia-600', icono: 'Shuffle' },
  ],
  '35': [
    { clave: 'planeacion', nombre: 'Planeación estratégica', descripcion: 'Plan Nacional de Desarrollo, planes institucionales, indicadores, seguimiento y evaluación de políticas públicas.', eje: 'Específico', color: 'bg-blue-500', icono: 'BookOpen' },
    { clave: 'contratacion', nombre: 'Contratación estatal', descripcion: 'Licitación, selección abreviada, mínima cuantía, decreto 1082 de 2015, SECOP II, garantías y supervisión.', eje: 'Específico', color: 'bg-amber-500', icono: 'FileText' },
    { clave: 'administrativo', nombre: 'Derecho administrativo', descripcion: 'Acto administrativo, procedimiento administrativo, CPACA, recursos, nulidad y restablecimiento del derecho.', eje: 'Específico', color: 'bg-indigo-500', icono: 'Scale' },
    { clave: 'disciplinario', nombre: 'Derecho disciplinario', descripcion: 'Ley 1952 de 2019, Código General Disciplinario, proceso disciplinario, faltas, sanciones e investigación.', eje: 'Específico', color: 'bg-red-500', icono: 'Gavel' },
    { clave: 'proyectos', nombre: 'Formulación y evaluación de proyectos', descripcion: 'Metodología MGA del DNP, marco lógico, indicadores, BPIN, evaluación de costos y beneficios.', eje: 'Específico', color: 'bg-rose-500', icono: 'ClipboardList' },
    { clave: 'anticorrupcion', nombre: 'Estatuto anticorrupción', descripcion: 'Ley 1474 de 2011, planes anticorrupción, denuncias, ética pública, prevención y control de la corrupción.', eje: 'Específico', color: 'bg-orange-500', icono: 'ShieldAlert' },
    { clave: 'disciplinar-derecho', nombre: 'Conocimientos específicos del área disciplinar (Derecho)', descripcion: 'Fuentes del derecho, interpretación jurídica, Constitución Política, derechos fundamentales, bloque de constitucionalidad y Ministerio Público.', eje: 'Específico', color: 'bg-cyan-500', icono: 'MessageSquare' },
    { clave: 'pgn', nombre: 'Estructura y funciones de la PGN', descripcion: 'Ministerio Público, control disciplinario, estructura de la Procuraduría General de la Nación y competencias.', eje: 'Común', color: 'bg-slate-600', icono: 'Building2' },
    { clave: 'sistemas-gestion', nombre: 'Sistemas de gestión', descripcion: 'Modelo Integrado de Planeación y Gestión, MECI, FURAG, gestión de calidad y gestión del riesgo.', eje: 'Común', color: 'bg-violet-500', icono: 'Settings' },
    { clave: 'gestion-documental', nombre: 'Gestión documental', descripcion: 'Ciclo vital del documento, archivo, tablas de retención, AGN y normativa de gestión documental.', eje: 'Común', color: 'bg-pink-500', icono: 'FolderOpen' },
    { clave: 'gestion-publica', nombre: 'Gestión pública y funcionamiento del Estado', descripcion: 'Constitución Política, organización del Estado, descentralización, función pública y control.', eje: 'Común', color: 'bg-lime-500', icono: 'Globe' },
    { clave: 'documentos-oficina', nombre: 'Elaboración de documentos de oficina', descripcion: 'Conceptos técnicos, informes, comunicaciones, memorandos y redacción de documentos administrativos.', eje: 'Común', color: 'bg-sky-500', icono: 'FileEdit' },
    { clave: 'atencion-usuario', nombre: 'Atención al usuario', descripcion: 'Servicio al ciudadano, PQRD, derecho de petición, trámites y canales de atención.', eje: 'Común', color: 'bg-yellow-500', icono: 'Headphones' },
    { clave: 'ofimatica', nombre: 'Herramientas ofimáticas', descripcion: 'Hojas de cálculo, procesadores de texto, presentaciones y herramientas de productividad ofimática.', eje: 'Común', color: 'bg-fuchsia-500', icono: 'Calculator' },
    { clave: 'simulacro', nombre: 'Simulacro mixto', descripcion: 'Preguntas aleatorias de todos los ejes del perfil para medir tu nivel general antes del concurso.', eje: 'Mixto', color: 'bg-fuchsia-600', icono: 'Shuffle' },
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

export function limpiarTemasObsoletos() {
  for (const [perfilCodigo, temas] of Object.entries(temasPorPerfil)) {
    const claves = temas.map((tema) => `${tema.clave}-${perfilCodigo}`);
    const placeholders = claves.map(() => '?').join(',');
    db.prepare(
      `DELETE FROM temas WHERE perfil_codigo = ? AND clave NOT IN (${placeholders})`
    ).run(perfilCodigo, ...claves);
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
        tema.descripcion
      );
    });
  }
}

export function seed() {
  crearTablas();
  insertarPerfiles();
  limpiarTemasObsoletos();
  insertarTemasEstructura();
}

if (require.main === module) {
  seed();
  console.log('Base de datos sembrada.');
}
