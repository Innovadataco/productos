import { Exception } from "@adonisjs/core/build/standalone";
import { RegistroBloqueo } from "App/Dominio/Datos/Entidades/Usuarios/RegistroBloqueo";
import { RepositorioBloqueoUsuario } from "App/Dominio/Repositorios/RepositorioBloqueoUsuario";
import { TblRegistroBloqueo } from "App/Infraestructura/Datos/Entidad/Usuarios/RegistroBloqueo";

export class RepositorioBloqueoUsuarioDB implements RepositorioBloqueoUsuario{
    public async crearRegistro(registro: RegistroBloqueo): Promise<RegistroBloqueo> {
        const registroDb = new TblRegistroBloqueo()
        registroDb.establecerRegistroBloqueo(registro)
        return (await registroDb.save()).obtenerRegistroBloqueo()
    }

    public async actualizarRegistro(registro: RegistroBloqueo): Promise<RegistroBloqueo> {
        try{
            const registroDb = await TblRegistroBloqueo.findOrFail(registro.id)
            registroDb.establecerRegistroBloqueo(registro)
            return (await registroDb.save()).obtenerRegistroBloqueo()
        }catch{
            throw new Exception('No se encontró el registro', 404)
        }
    }

    public async obtenerRegistroPorUsuario(identificacion: string): Promise<RegistroBloqueo | null> {
        const registroDb = await TblRegistroBloqueo.findBy('identificacion', identificacion)
        if(!registroDb) return null;
        return registroDb.obtenerRegistroBloqueo()
    }

}
