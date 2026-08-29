import type { RespuestaMotor, Rol } from "./tipos";

export interface MensajeUsuario {
    tipo: "usuario";
    id: string;
    texto: string;
    ts: number;
}

export interface MensajeMotor {
    tipo: "motor";
    id: string;
    respuesta: RespuestaMotor;
    ts: number;
}

export type Mensaje = MensajeUsuario | MensajeMotor;

export type HistorialChat = Mensaje[];

export interface UsuarioUI {
    id: string;
    rol: Rol;
}
