/* eslint-disable @typescript-eslint/semi */

export class GeneradorContrasena{
  constructor () { }

  public async generarClave (cadena: string, longitud: number): Promise<string> {
    let claveTemporal = '';
    for (let i = 0; i < longitud; i++){
      let random = Math.floor(Math.random() * cadena.length)
      claveTemporal += cadena.charAt(random);
    }

    return claveTemporal;
  }

  public async generar (): Promise<string> {
    let base = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numeros = '123456789';
    const simbolos = '.?-_+!¡¿*%#$/()[]{}|@<>';

    let clave = await this.generarClave(`${base}${numeros}${simbolos}`, 12);
    return clave
  }
}
