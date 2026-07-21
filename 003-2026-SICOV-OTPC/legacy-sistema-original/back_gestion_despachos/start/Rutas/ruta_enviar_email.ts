/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/naming-convention */
import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Email/ControladorEmail'

Route.group(() => {
  Route.post('/envio-email', accion_path + '.EnviarEmail')
}).prefix('api/v1')
