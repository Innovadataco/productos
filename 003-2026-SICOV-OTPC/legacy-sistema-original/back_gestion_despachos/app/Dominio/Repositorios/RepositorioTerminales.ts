/* eslint-disable @typescript-eslint/semi */
import { ClaseVehiculo } from '../Datos/Entidades/ClaseVehiculo';
import { Nodo } from '../Datos/Entidades/Nodo';
import { Ruta } from '../Datos/Entidades/Ruta';
import { RutaEmpresaVia } from '../Datos/Entidades/RutaEmpresaVia';
import { RespuestaClases } from '../Dto/RespuestaClases';
import { RespuestaParadas } from '../Dto/RespuestaParadas';
import { RespuestaRutas } from '../Dto/RespuestaRutas';
import { Paginador } from '../Paginador';

export interface RepositorioTerminales {
  visualizarParadasPorRuta(param: any, id: number): Promise<{ paradas: RespuestaParadas[], paginacion: Paginador }>
  visualizarClasesPorRuta(param: any): Promise<{ clases: RespuestaClases[], paginacion: Paginador }>
  numeroTotalRutasPorUsuario(id: number): Promise<any>;
  guardarDireccion(nodo: Nodo): Promise<any>
  guardarRuta(ruta: RespuestaRutas, id: number): Promise<{ rutaCreada: RespuestaRutas, ids: object }>
  guardar(arregloTerminales: any[], id: number): Promise<any>
  guardarParadas(parada: RespuestaParadas): Promise<{parada: RespuestaParadas, nodoDespachoId: number}>
  guardarClases(clase: ClaseVehiculo): Promise<RespuestaClases>
  enviarSt(param: any): Promise<any>
  visualizarRutasVigilado(param: any): Promise<{ rutasVigilado: RespuestaRutas[], paginacion: Paginador, editable: boolean, verificacionVisible: boolean, verificacionEditable: boolean }>
  visualizarRuta(param: any): Promise<{ ruta: any }>
  eliminarClase(id: number): Promise<any>
  eliminarParada(param : any): Promise<any>
  eliminarVia(param: any): Promise<any>
  guardarVia(via: RutaEmpresaVia): Promise<{via:RutaEmpresaVia}>
  eliminarRuta(param: any): Promise<any>

}
