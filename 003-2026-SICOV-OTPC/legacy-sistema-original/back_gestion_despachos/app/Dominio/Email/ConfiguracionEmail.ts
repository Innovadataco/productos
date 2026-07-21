import { Fichero } from "../Ficheros/Fichero"

export interface ConfiguracionEmail{
    de?: string, // de quien viene el email
    alias?: string,
    destinatarios: string | string[]
    copias?: string | string[]
    asunto: string
    /**
     * Adjunta un único archivo (compatibilidad hacia atrás).
     */
    adjunto?: Fichero
    /**
     * Adjunta múltiples archivos. Si algún elemento tiene `cid`, será embebido inline.
     */
    adjuntos?: Fichero[]
}
