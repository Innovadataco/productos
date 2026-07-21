import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Nivelservicio/ControladorNivelservicio'

Route.group(() => {
  Route.get('', accion_path + '.Listar')

}).prefix('api/v1/nivelservicio').middleware('autorizacion')
