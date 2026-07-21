export interface FiltrosSoporte{
    fechaCreacion?: 'asc' | 'desc',
    estado?: number
    termino?: string // Palabra clave
    problemaAcceso?: boolean
}