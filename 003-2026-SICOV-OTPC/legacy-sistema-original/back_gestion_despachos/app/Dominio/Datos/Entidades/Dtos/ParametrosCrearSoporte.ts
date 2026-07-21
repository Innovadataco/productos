export interface ParametrosCrearSoporte {
    ruta: string
    nit: string
    razonSocial: string
    email: string
    telefono?: string
    descripcion: string
    documento?: string // nombre original
    identificadorDocumento?: string //nombre en sistema de ficheros
    motivo?: number
    errorAcesso?: string
    problemaAcceso: boolean
}