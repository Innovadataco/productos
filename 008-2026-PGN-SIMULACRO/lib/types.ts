export type Perfil = 'Jelkin' | 'Diana'
export type PerfilSheet = 'Jelkin' | 'Diana' | 'Ambos'
export type Dificultad = 'facil' | 'medio' | 'dificil'

export interface Question {
  id: number; perfil: PerfilSheet; tema: string; pregunta: string
  opciones: [string,string,string,string]; respuesta: number
  explicacion: string; norma: string; dificultad: Dificultad
}
export interface TopicConfig { key:string; name:string; color:string; hours:string; icon:string }
export interface TopicStats { correct:number; total:number }
export type Progress = { [P in Perfil]?: { [tema:string]: TopicStats } }

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
