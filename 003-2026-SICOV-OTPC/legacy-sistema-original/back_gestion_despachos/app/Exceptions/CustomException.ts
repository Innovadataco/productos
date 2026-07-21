import { ResponseContract } from '@ioc:Adonis/Core/Response'

export default class CustomException {
  static success(
    response: ResponseContract,
    statusCode: number,
    titulo: string,
    mensajes: string[],
    array_data: any = null,
    obj: any = null,
    extras: Record<string, any> = {} // propiedades adicionales
  ) {
    const extraData =
      array_data !== null
        ? { array_data }
        : obj !== null
          ? { obj }
          : {}

    return response.status(statusCode).send({
      status: statusCode,
      titulo,
      mensajes,
      ...extraData,
      ...extras // mezcla los adicionales
    })
  }

  static error(
    response: ResponseContract,
    statusCode: number,
    titulo: string,
    mensajes: string[]
  ) {
    return response.status(statusCode).send({
      status: statusCode,
      titulo,
      mensajes
    })
  }
}
