import { Fichero } from "./Fichero";

export interface RepositorioFichero {
    guardarFichero(fichero: Fichero, ruta: string, nombre: string, extension?: string)
    obtenerFichero(ruta: string): Fichero
}