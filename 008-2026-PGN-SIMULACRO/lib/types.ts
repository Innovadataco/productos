export interface Perfil {
  codigo: string;
  convocatoria: string;
  nombre: string;
  dependencia: string;
  ubicacion: string;
  asignacion_basica: string;
  disciplina: string;
  vacantes: number;
}

export interface Tema {
  id: number;
  perfil_codigo: string;
  clave: string;
  nombre: string;
  eje: string;
  color: string;
  icono: string;
  orden: number;
  descripcion: string;
}

export interface Pregunta {
  id: number;
  tema_id: number;
  perfil_codigo: string;
  enunciado: string;
  opciones: string[];
  respuesta: number;
  explicacion: string;
  norma: string;
  articulo: string;
  dificultad: 'baja' | 'media' | 'alta';
}

export interface Resultado {
  id: number;
  perfil_codigo: string;
  tema_id: number | null;
  correctas: number;
  total: number;
  falladas: string;
  duracion_seg: number;
  created_at: number;
}

export interface Respuesta {
  id: number;
  resultado_id: number;
  pregunta_id: number;
  marcada: number;
  correcta: number;
}

export interface Resumen {
  id: number;
  tema_id: number;
  perfil_codigo: string;
  titulo: string;
  contenido_html: string;
  fuente_url: string;
  orden: number;
}

export interface Flashcard {
  id: number;
  tema_id: number;
  perfil_codigo: string;
  frente: string;
  reverso: string;
  norma: string;
}

export interface ResultadoGuardar {
  perfil_codigo: string;
  tema_id: number | null;
  correctas: number;
  total: number;
  falladas: number[];
  duracion_seg: number;
  respuestas: {
    pregunta_id: number;
    marcada: number;
    correcta: number;
  }[];
}

export interface TemaStats {
  tema_id: number;
  clave: string;
  nombre: string;
  eje?: string;
  color?: string;
  total_preguntas?: number;
  intentos: number;
  correctas?: number;
  total?: number;
  promedio?: number;
  porcentaje?: number;
  ultimo_intento?: number | null;
  ultimo_puntaje?: number | null;
}

export interface AnalisisData {
  perfil_codigo: string;
  promedio_general: number;
  intentos_totales: number;
  total_correctas: number;
  total_preguntas: number;
  temas: TemaStats[];
  temas_debiles: TemaStats[];
  preguntas_falladas: {
    pregunta_id: number;
    enunciado: string;
    norma: string;
    tema_nombre: string;
    veces: number;
  }[];
  normas_error: { norma: string; intentos: number; falladas: number; tasa_error: number }[];
  evolucion: { dia: string; intentos: number; correctas: number; total: number; porcentaje: number }[];
}

export interface RespuestaLocal {
  pregunta_id: number;
  marcada: number;
  correcta: number;
}

export interface ResultadoLocal extends ResultadoGuardar {
  id: string;
  created_at: number;
}
