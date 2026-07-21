import { ServicioEstados } from "App/Dominio/Datos/Servicios/ServicioEstados";
import { RepositorioVerificador } from "App/Dominio/Repositorios/RepositorioVerificador";
import TblSolicitudes from "App/Infraestructura/Datos/Entidad/Solicitudes";

export class RepositorioVerificadorDB implements RepositorioVerificador {
  private servicioEstados = new ServicioEstados();

  async listar(id: string, rol: number): Promise<{}> {
    const consulta = TblSolicitudes.query()
      .preload("estadosVerificador")
      .preload("estadosProveedor")
      .preload("asignador")
      .preload("vigilado")

if(rol == 7){
  consulta.where("verificadorId", id);
}
      const asignadas = await consulta

    return asignadas.map((a) => {
      return {
        solicitudId: a.id,
        nit: a.vigilado?.identificacion??'',
        razonSocial: a.vigilado?.nombre??'',
        // fechaRegistro: a.aspirante?.creado??'',
        // modulo: a.tipoSolicitudes?.nombre??'',
        // asignador: a.asignador.nombre,
        estadoCargue: a.estadosProveedor?.nombre??'',
        estadoValidacion: a.estadosVerificador?.nombre??'',
      };
    });
  }
}
