/* eslint-disable @typescript-eslint/quotes */
/* eslint-disable @typescript-eslint/naming-convention */
import Route from '@ioc:Adonis/Core/Route'
const accion_path = '../../../app/Presentacion/Terminales/ControladorTerminales'


Route.group(() => {
  Route.get('total-rutas', accion_path + '.numeroTotalRutasPorUsuario')
  Route.get('/visualizar-paradas', accion_path + '.visualizarParadasPorRuta')
  Route.get('/visualizar-clases', accion_path + '.visualizarClasesPorRuta')
  Route.get('/visualizar-ruta', accion_path + '.visualizarRuta')
  Route.post('/crear-direccion', accion_path + '.guardarDireccion')
  Route.post('/guardar-ruta', accion_path + '.guardarRuta')
  Route.post('/guardar-parada', accion_path + '.guardarParada')
  Route.post('/guardar-clase', accion_path + '.guardarClase')
  Route.post('/guardar-via', accion_path + '.guardarVia')
  Route.patch('/guardar', accion_path + '.guardar')
  Route.post('/enviar-st', accion_path + '.enviarSt')
  Route.get('/visualizar-rutas-vigilado', accion_path + '.visualizarRutasVigilado')
  Route.delete('/eliminar-ruta', accion_path + '.eliminarRuta')
  Route.delete('/eliminar-clase', accion_path + '.eliminarClase')
  Route.delete('/eliminar-parada', accion_path + '.eliminarParada')
  Route.delete('/eliminar-via', accion_path + '.eliminarVia')
}).prefix('api/v1/terminales').middleware('autenticacionJwt')
