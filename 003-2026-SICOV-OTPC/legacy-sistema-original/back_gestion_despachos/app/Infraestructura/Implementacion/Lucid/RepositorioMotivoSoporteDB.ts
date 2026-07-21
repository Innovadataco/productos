import { MotivoSoporte } from "App/Dominio/Datos/Entidades/MotivoSoporte";
import { RepositorioMotivoSoporte } from "App/Dominio/Repositorios/RepositorioMotivoSoporte";
import TblMotivosSoportes from "App/Infraestructura/Datos/Entidad/MotivoSoporte";

export class RepositorioMotivoSoporteDB implements RepositorioMotivoSoporte{

    async listar(): Promise<MotivoSoporte[]> {
        return (await TblMotivosSoportes.all()).map(motivoSoporteDb =>{
            const motivoSoporte = new MotivoSoporte()
            motivoSoporte.descripcion = motivoSoporteDb.descripcion
            motivoSoporte.id = motivoSoporteDb.id
            return motivoSoporte
        })
    }

}