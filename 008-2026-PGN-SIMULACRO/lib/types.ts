export type Perfil = 'Jelkin' | 'Diana'
export type PerfilSheet = 'Jelkin' | 'Diana' | 'Ambos'
export type Dificultad = 'facil' | 'medio' | 'dificil'
export type StageKey = 'resumen' | 'flashcards' | 'quiz' | 'resultado'

export interface Question {
  id: number; perfil: PerfilSheet; tema: string; pregunta: string
  opciones: [string,string,string,string]; respuesta: number
  explicacion: string; norma: string; dificultad: Dificultad
}

export interface Resumen {
  id: number; perfil: PerfilSheet; tema: string; titulo_seccion: string
  contenido_html: string; fuente_url: string; orden: number
}

export interface Flashcard {
  id: number; perfil: PerfilSheet; tema: string
  frente: string; reverso: string; norma: string
}

export interface TopicConfig { key:string; name:string; color:string; hours:string; icon:string }

export interface StageStats {
  resumen_done: boolean
  flashcards_done: boolean
  flashcards_score: number
  quiz_correct: number
  quiz_total: number
  resultado_seen: boolean
}

// Alias de compatibilidad con progreso antiguo {correct,total}
export interface TopicStats { correct:number; total:number }

export type Progress = { [P in Perfil]?: { [tema:string]: StageStats } }

export const STAGE_COLORS: Record<StageKey, string> = {
  resumen: '#4f46e5',
  flashcards: '#d97706',
  quiz: '#0b6e5a',
  resultado: '#059669',
}

export const STAGE_LABELS: Record<StageKey, { title:string; subtitle:string; icon:string }> = {
  resumen: { title: 'Resumen', subtitle: 'Lee los conceptos clave', icon: '📖' },
  flashcards: { title: 'Flashcards', subtitle: 'Memoriza términos y normas', icon: '🃏' },
  quiz: { title: 'Quiz', subtitle: 'Pon a prueba tu conocimiento', icon: '✏️' },
  resultado: { title: 'Mi resultado', subtitle: 'Revisa tu avance', icon: '📊' },
}

export const TOPICS: Record<Perfil, TopicConfig[]> = {
  Jelkin: [
    {key:'Contratación',  name:'Contratación estatal',      color:'#0b6e5a',hours:'25h',icon:'📋'},
    {key:'Procuraduría',  name:'Estructura Procuraduría',   color:'#1d4ed8',hours:'10h',icon:'⚖️'},
    {key:'Técnicos TI',   name:'Conocimientos técnicos TI', color:'#7c3aed',hours:'8h', icon:'💻'},
    {key:'Mixto Jelkin',  name:'Simulacro mixto',           color:'#b45309',hours:'—',  icon:'🎯'},
  ],
  Diana: [
    {key:'Derecho constitucional', name:'Derecho constitucional', color:'#0b6e5a',hours:'15h',icon:'📜'},
    {key:'Derecho administrativo', name:'Derecho administrativo', color:'#1d4ed8',hours:'12h',icon:'🏛️'},
    {key:'Derecho penal',          name:'Derecho penal',          color:'#dc2626',hours:'10h',icon:'🔍'},
    {key:'Derecho laboral',        name:'Derecho laboral',        color:'#7c3aed',hours:'8h', icon:'👷'},
    {key:'Infancia y familia',     name:'Infancia y familia',     color:'#b45309',hours:'8h', icon:'👶'},
    {key:'Derecho civil',          name:'Derecho civil',          color:'#0891b2',hours:'6h', icon:'📄'},
    {key:'Mixto Diana',            name:'Simulacro mixto',        color:'#b45309',hours:'—',  icon:'🎯'},
  ],
}
export const CONV_BADGE: Record<Perfil,string> = {Jelkin:'Conv. 52 · TIC', Diana:'Conv. 89 · Judicial'}
