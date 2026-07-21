import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Informe/ControladorInforme'

Route.group(() => {
  Route.get('', accion_path + '.informes')
  Route.get('estado', accion_path + '.obtenerEstado')
}).prefix('api/v1/informes')//.middleware('autenticacionJwt')