export interface Fichero {
    contenido: Buffer
    extension?: string
    nombre: string
    tamano: number // tamaño del archivo
    /**
     * CID opcional para incrustar el fichero (normalmente una imagen) inline en correos.
     * Si se define, se usará como `cid` al adjuntar y se expondrá al template como `logoCid` (si no existe ya).
     */
    cid?: string
    /** Content-Type explícito (image/png, image/jpeg, etc.) */
    contentType?: string
}
