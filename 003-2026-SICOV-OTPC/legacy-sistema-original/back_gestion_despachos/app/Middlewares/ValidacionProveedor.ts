import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { TblProveedoresVigilados } from 'App/Infraestructura/Datos/Entidad/ProveedoresVigilado';
export default class ValidacionProveedor {
  public async handle({request, response}: HttpContextContract, next: () => Promise<void>) {
     const { vigiladoId } = request.all();
    const header = request.header('Authorization')
    const fuenteDato = request.header('fuentedato') || request.header('fuenteDato') || request.header('FuenteDato');
    const token = request.header('token')
    const nit = request.header('vigiladoId')

    const nitEmpresa = vigiladoId ?? nit

    if(fuenteDato){
      await next()
    }else{




    if(!token || !nitEmpresa){
      return response.status(400).send({
        mensaje: `Falta el token de autorización o el documento del vigilado `,
        error: 400
      })
    }
        const payload = await request.obtenerPayloadJWT()

    const documentoProveedor = payload.documento;

    const proveedorVigilado = await TblProveedoresVigilados.query()
      .where({'tpv_vigilado': nitEmpresa, 'tpv_empresa': documentoProveedor}).first()

       const fechaActual = new Date();


    if(
      !proveedorVigilado?.estado ||
      proveedorVigilado?.token !== token ||
      !(fechaActual >= new Date(proveedorVigilado.fechaInicial) && fechaActual <= new Date(proveedorVigilado.fechaFinal))
      ){
        return response.status(401).send({
        mensaje: 'No tiene autorización, consulte con el vigilado',
        error: 401
      })


    }

    await next()
  }
  }
}
