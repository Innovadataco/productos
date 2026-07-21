export interface Encriptador {
  encriptar(cadena:string):Promise<string>
  comparar(cadena:string, hash:string):Promise<boolean>
}
