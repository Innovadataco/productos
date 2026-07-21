import { Soporte } from "App/Dominio/Datos/Entidades/Soporte";
import { FiltrosSoporte } from "App/Dominio/Dto/Soporte/FiltrosSoporte";
import { RepositorioSoporte } from "App/Dominio/Repositorios/RepositorioSoporte";
import { Paginable } from "App/Dominio/Tipos/Tipos";
import { Soportes } from "App/Infraestructura/Datos/Entidad/Soporte";
import { MapeadorPaginacionDB } from "./MapeadorPaginacionDB";
import { Exception } from "@adonisjs/core/build/standalone";

export class RepositorioSoporteDB implements RepositorioSoporte{

    async guardar(soporte: Soporte): Promise<Soporte> {
        soporte.id = await this.obtenerProximoId()
        const soporteDb = new Soportes()
        soporteDb.establecer(soporte)
        return (await soporteDb.save()).obtenerSoporte()
    }

    async obtenerPorId(id: number): Promise<Soporte | null> {
        const soporteDb = await Soportes.find(id)
        return soporteDb ? await soporteDb.obtenerSoporte() : soporteDb;
    }

    async obtenerSoportes(pagina: number, limite: number, filtros: FiltrosSoporte): Promise<Paginable<Soporte>> {
        const query = Soportes.query()
        if(filtros.estado){
            query.andWhere('id_estado', filtros.estado)
        }
        if(filtros.problemaAcceso != undefined){
            query.andWhere('problema_acceso', filtros.problemaAcceso)
        }
        if(filtros.termino){
            query.andWhere( subquery => {
                subquery.where('radicado', 'ilike', `%${filtros.termino}%`)
                subquery.orWhere('razon_social', 'ilike', `%${filtros.termino}%`)
                subquery.orWhere('nit', 'ilike', `%${filtros.termino}%`)
                subquery.orWhere('email', 'ilike', `%${filtros.termino}%`)
                subquery.orWhere('usuario_respuesta', 'ilike', `%${filtros.termino}%`)
            })
        }
        query.orderBy('fecha_creacion',  filtros.fechaCreacion ?? 'asc')
        const paginableDb = await query.paginate(pagina, limite) 
        const paginacion = MapeadorPaginacionDB.obtenerPaginacion(paginableDb)
        const datos = paginableDb.all().map( soporteDb => soporteDb.obtenerSoporte())
        return {
            datos,
            paginacion
        }
    }

    async obtenerSoportesVigilado(nit:string): Promise<any> {
        const datos = await Soportes.query()
        .where('nit', nit)
        .andWhere('problema_acceso', false)
        return datos
    }

    async actualizarSoporte(soporte: Soporte): Promise<Soporte> {
        const soporteDb = await Soportes.findOrFail(soporte.id)
        soporteDb.establecer(soporte, true)
        return (await soporteDb.save()).obtenerSoporte()
    }

    async obtenerProximoId(): Promise<number>{
        const resultados = await Soportes.query().max('id_soporte').as('max')
        return +resultados[0].$extras['max'] + 1;
    }

    async eliminarSoporte(soporte: Soporte): Promise<void> {
        if(!soporte.id){
            return;
        }
        await Soportes.query().delete().where('id_soporte', soporte.id)
    }

}