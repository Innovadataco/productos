import { TblActualEstados } from "App/Infraestructura/Datos/Entidad/ActualEstados"
import TblEstadosEnviados from "App/Infraestructura/Datos/Entidad/EstadosEnviados"
import { TblLogEstados } from "App/Infraestructura/Datos/Entidad/LogEstados"
import TblSolicitudes from "App/Infraestructura/Datos/Entidad/Solicitudes"

export class ServicioEstados {

  public async EnviadosSt(vigilado: string,estado: number) {
    //Validar si ya existe el log

    const exiteEstado = await TblEstadosEnviados.query().where(
      {
        'env_estado': estado,
        'env_vigilado_id': vigilado
      })
      .first()


    if (!exiteEstado) {
      const enviado = new TblEstadosEnviados()
      enviado.estado = estado
      enviado.vigiladoId = vigilado
      await enviado.save()
    }

  }

  public async Log(vigiladoId: number, estadoId: number) {

    const existe = await TblLogEstados.query().where(
     {'tle_vigilado_id': vigiladoId, 'tle_estado_id': estadoId}).first()

       if (!existe) {
        try {

          const logEstados = new TblLogEstados()
          logEstados.vigiladoId = vigiladoId
          logEstados.estadoId = estadoId
          await logEstados.save()

        } catch (error) {
          console.log(error);

        }

       }

   }

   public async ActualizarEstado(solicitudId: number, estadoId: number, rolId?:number ) {

    const solicitud = await TblSolicitudes.findOrFail(solicitudId)
        if(rolId == 7){
          solicitud.estadoVeri = estadoId
        }else{
          solicitud.estado = estadoId
        }

    await solicitud.save()

    this.Log(solicitud.vigiladoId,estadoId);

   }




        public async consultarEnviado(vigiladoId: string): Promise<boolean> {

          const existe = await TblEstadosEnviados.query().where(
            {'env_vigilado_id': vigiladoId,
            'env_estado': 1})
            .first()

              if (!existe) {
                return true
              }

              return false


        }

        public async consultarEditable(estadoAspirante: number, rol:number, estadoVerificador?: number | null): Promise<{editable:boolean, verificacionVisible:boolean,verificacionEditable:boolean}> {

          let editable = false;
          let verificacionVisible = false;
          let verificacionEditable = false;

        /*
        Estados disponibles
        id  nombre
        1	Enviado a st
        2	Inicio
        3	En proceso
        4	Inicio de sesión
        5	Asignado a verifiador
        6	En proceso de verificación
        7	Devuelto
        8	Aprobado */

        /*
        Roles disponibles
        id  nombre
        1	super
        2	administrador
        3	vigilado
        4	soporte
        5	proveedor
        6	verificador pesv
        7	verificador proveedor */
        if(rol === 3){
          if ([2, 3, 4].includes(estadoAspirante) && [1, 0, 5].includes(estadoVerificador??0)) {
            editable = true;
          }else if ([1, 8].includes(estadoAspirante) && [6, 5].includes(estadoVerificador??0)) {
            verificacionVisible = true;
          }else if([7].includes(estadoAspirante) && [1].includes(estadoVerificador??0)){
            verificacionVisible = true;
            editable = true;
          }
        }

        if(rol === 7){
          verificacionVisible = true;
          if ([1].includes(estadoAspirante) && [6, 5, 1].includes(estadoVerificador??0)) {
            verificacionEditable = true;
          }
        }

        if(rol === 1 || rol === 2){
          verificacionVisible = true;

        }

      return {
          editable,
          verificacionVisible,
          verificacionEditable
      };

        }

}
