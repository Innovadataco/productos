export class Auditoria {
  id?: number;
  accion: string;
  modulo: string;
  jsonAnterior: JSON;
  jsonNuevo: JSON;
  usuario: string;
  vigilado: string;
  descripcion:string;
}
