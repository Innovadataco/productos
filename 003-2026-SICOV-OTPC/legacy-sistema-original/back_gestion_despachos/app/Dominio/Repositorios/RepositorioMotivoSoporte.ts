import { MotivoSoporte } from "../Datos/Entidades/MotivoSoporte";

export interface RepositorioMotivoSoporte{
    listar(): Promise<MotivoSoporte[]>
}