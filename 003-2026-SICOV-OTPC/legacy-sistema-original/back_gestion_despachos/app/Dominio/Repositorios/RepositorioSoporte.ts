import { Soporte } from "../Datos/Entidades/Soporte";
import { FiltrosSoporte } from "../Dto/Soporte/FiltrosSoporte";
import { Paginable } from "../Tipos/Tipos";

export interface RepositorioSoporte{
    guardar(soporte: Soporte): Promise<Soporte>
    obtenerPorId(id: number): Promise<Soporte | null>
    obtenerSoportes(pagina: number, limite: number, filtros: FiltrosSoporte): Promise<Paginable<Soporte>>
    obtenerSoportesVigilado(nit:string): Promise<any>
    actualizarSoporte(soporte: Soporte): Promise<Soporte>
    obtenerProximoId(): Promise<number>
    eliminarSoporte(soporte: Soporte): Promise<void>
}