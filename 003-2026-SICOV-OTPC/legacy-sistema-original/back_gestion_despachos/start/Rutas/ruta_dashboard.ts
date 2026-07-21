import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Dashboard/ControladorDashboard'

Route.group(() => {
  Route.get('/', accion_path + '.obtenerResumen')
  Route.get('/placas', accion_path + '.obtenerPlacas')
  Route.get('/logs', accion_path + '.obtenerLogs')
}).prefix('api/v1/dashboard').middleware('autenticacionJwt')
