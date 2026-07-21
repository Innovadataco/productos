import Route from '@ioc:Adonis/Core/Route'
import './mantenimiento_queue_worker'
import './despachos_queue_worker'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { extname } from 'path'
import Drive from '@ioc:Adonis/Core/Drive'

Route.get('/', async ({ response }: HttpContextContract) => {
  response.status(200).send('¡Bienvenido a gesmovil API 1!')
})

Route.get('/recursos/*', async ({request, response}:HttpContextContract) => {
  const ruta = request.param('*').join('/')
  const path = `${ruta}`
  try {
      const { size } = await Drive.getStats(path)
      response.type(extname(path))
      response.header('content-length', size)
      response.stream(await Drive.getStream(path))
  } catch(e){
      console.log(e)
      response.status(404).send(undefined)
  }
})

Route.get('api/v1/validador-empresa', async ({ response }: HttpContextContract) => {
  response.status(200).send({acceso:true})
})
