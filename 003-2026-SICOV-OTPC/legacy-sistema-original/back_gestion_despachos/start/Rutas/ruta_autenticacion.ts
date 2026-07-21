import Route from '@ioc:Adonis/Core/Route'
const controlador = '../../../app/Presentacion/Autenticacion/ControladorAutenticacion'

Route.group(() => {
  Route.post('/inicio-sesion', controlador+'.inicioSesion')
  Route.post('/cambiar-clave', controlador+'.cambiarClave')
  Route.post('/inicio-vigia', controlador+'.inicioVigia')
}).prefix('/api/v1/autenticacion')
