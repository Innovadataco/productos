export interface IniciarSesionRespuesta {

  usuario: Usuario;

  token: string;

  tokenExterno?: string;

  claveTemporal: boolean;

  rol: Rol;

  // Nueva fuente preferida para el menú lateral

  modulos?: Modulo[];

  aplicativos?: Aplicativos;

}



export interface Usuario {

  id: string;

  usuario: string;

  nombre: string;

  apellido: string;

  telefono: string;

  correo: string;

  idEmpresa?: string;

  logoEmpresa?: string;

  abrirModal: boolean;

  departamentoId: number;

  municipioId: number;

  esDepartamental: number;

  nombreCiudad: string;

  nombreDepartamento: string;

  reportaOtroMunicipio?: boolean;

  /** NIT de la empresa transporte (viene anidado en login como `usuario.usuario.nit`). */

  nit?: string | number;

}



export interface Rol {

  id: string | number;

  nombre: string;

  estado: boolean;

  creacion: string;

  actualizacion: string;

  modulos: Modulo[];

}



export interface Modulo {

  id: string;

  nombre: string;

  nombreMostrar: string;

  ruta: string;

  icono: string;

  estado: boolean;

  creacion: Date;

  actualizacion: Date;

  submodulos: Submodulo[];

}



export interface Submodulo {

  id: string;

  nombre: string;

  nombreMostrar: string;

  ruta: string;

  icono: string;

  estado: boolean;

  creacion: Date;

  actualizacion: Date;

}



export interface Aplicativos {

  id: number;

  titulo: string;

  descripcion?: string;

  estado?: boolean;

}



export interface PeticionRecuperarContrasena {

  usuario: string; // identificación/NIT

  correo: string;

}


