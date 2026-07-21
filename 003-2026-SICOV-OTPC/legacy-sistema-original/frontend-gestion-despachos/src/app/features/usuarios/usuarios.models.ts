export interface UsuarioListado {
  id: number | string;
  nombre: string;
  identificacion: number | string;
  telefono: string | null;
  correo: string | null;
  idRol?: number | string;
  rolNombre?: string;
  parentId?: number | string; // Usuario titular (rol 2) si es subusuario (rol 3)
  tokenAutorizado?: string | null; // sólo aplica para rol 2 (cliente)
  estado?: boolean; // estado activo/inactivo del usuario
}

export interface RolItem {
  id: number | string;
  nombre: string;
}

export interface ModuloItem {
  id: number | string;
  nombre: string;
}

export interface UsuarioPayload {
  nombre: string;
  identificacion: number;
  telefono: string;
  correo: string;
  tokenAutorizado?: string;
  idRol: number;
  parentId?: number; // se envía sólo cuando se crea un subusuario
  estado?: boolean; // usado al editar el usuario
}

export interface SubusuarioListado extends UsuarioListado {
  parentId: number | string;
  idRol: number | string; // forzado a 3
}

export interface SubusuarioPayload extends Omit<UsuarioPayload, 'idRol'> {
  idRol?: number; // ignorado en front, siempre 3
  parentId: number; // obligatorio para crear subusuario
}
