import { RespuestaRutas } from 'App/Dominio/Dto/RespuestaRutas';
import { Paginador } from '../../Paginador';
import { RepositorioTerminales } from 'App/Dominio/Repositorios/RepositorioTerminales';
import { RespuestaParadas } from 'App/Dominio/Dto/RespuestaParadas';
import { RespuestaClases } from 'App/Dominio/Dto/RespuestaClases';

export class ServicioTerminales{
  constructor (private repositorio: RepositorioTerminales) { }

  async visualizarParadasPorRuta(param: any, id: number): Promise<{paradas: RespuestaParadas[], paginacion: Paginador}>{
    return this.repositorio.visualizarParadasPorRuta(param, id)
  }

  async visualizarClasesPorRuta(param: any): Promise<{clases: RespuestaClases[], paginacion: Paginador}>{
    return this.repositorio.visualizarClasesPorRuta(param)
  }

  async numeroTotalRutasPorUsuario(id: number): Promise<any>{
    return this.repositorio.numeroTotalRutasPorUsuario(id)
  }

  async guardarDireccion(param: any) {
    return this.repositorio.guardarDireccion(param)
  }

  async guardarRuta(param: any, id: number) {
    return this.repositorio.guardarRuta(param, id)
  }

  async guardar(param: any, id: number) {
    return this.repositorio.guardar(param, id)
  }

  async guardarParada(param: any) {
    return this.repositorio.guardarParadas(param)
  }

  async guardarClase(param: any) {
    return this.repositorio.guardarClases(param)
  }

  async enviarSt(param: any): Promise<any> {
    return this.repositorio.enviarSt(param)
  }

  async visualizarRutasVigilado(param: any): Promise<{rutasVigilado: RespuestaRutas[], paginacion: Paginador, editable:boolean, verificacionVisible:boolean, verificacionEditable:boolean}>{
    return this.repositorio.visualizarRutasVigilado(param)
  }

  async visualizarRuta(param: any): Promise<{ ruta: any }>{
    return this.repositorio.visualizarRuta(param)
  }

  async eliminarClase(id: number): Promise<any>{
    return this.repositorio.eliminarClase(id)
  }

  async eliminarParada(param: any): Promise<any>{
    return this.repositorio.eliminarParada(param)
  }

  async eliminarVia(param: any): Promise<any>{
    return this.repositorio.eliminarVia(param)
  }

  async guardarVia(param: any) {
    return this.repositorio.guardarVia(param)
  }

  async eliminarRuta(param: any): Promise<any>{
    return this.repositorio.eliminarRuta(param)
  }
}
