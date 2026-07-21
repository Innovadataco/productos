import Route from '@ioc:Adonis/Core/Route'
const controlador = '../../../app/Presentacion/Soporte/ControladorSoporte'

Route.group(() => {
  Route.get('/', `${controlador}.listar`)
  Route.get('/motivos', `${controlador}.listarMotivos`)
  Route.post('/', `${controlador}.guardar`)
  Route.post('/responder/:idSoporte', `${controlador}.responder`)
}).prefix('/api/v1/soportes').middleware('autenticacionJwt')
// sin autenticación ↓ ↓ ↓
Route.group(() => {
  Route.get('/archivo/:archivo', `${controlador}.descargarAdjunto`)
  Route.get('/vigilado', `${controlador}.listarVigilado`)
  Route.get('/archivo_respuesta/:archivo', `${controlador}.descargarAdjuntoRespuesta`)
  Route.post('/acceso', `${controlador}.guardarSinAcceso`)
}).prefix('/api/v1/soportes')
