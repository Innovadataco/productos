import Route from '@ioc:Adonis/Core/Route'

const despachosPath = '../../../app/Presentacion/Integracion/ControladorIntegracionDespachos'
const llegadasPath = '../../../app/Presentacion/Integracion/ControladorIntegracionLlegadas'
const integradoraPath = '../../../app/Presentacion/Integracion/ControladorPuenteIntegradora'
const maestrasPath = '../../../app/Presentacion/Integracion/ControladorPuenteMaestras'

Route.group(() => {
  Route.post('despachos', despachosPath + '.registrar')
  Route.get('despachos', despachosPath + '.consultarPorNit')
  Route.get('despachos/solicitudes', despachosPath + '.listarSolicitudes')
  Route.post('despachos/solicitudes/:id/reintentar', despachosPath + '.reintentarSolicitud')
  Route.get('despachos/solicitud/:id', despachosPath + '.obtenerSolicitud')
  Route.get('despachos/placa/:placa', despachosPath + '.consultarPorPlaca')
  Route.get('despachos/consulta/:id', despachosPath + '.consultarPorId')

  Route.post('llegadas', llegadasPath + '.registrar')
  Route.get('llegadas', llegadasPath + '.listar')
  Route.get('llegadas/solicitud/:id', llegadasPath + '.obtenerSolicitud')

  Route.post('integradora/resumen', integradoraPath + '.resumen')

  Route.get('maestras/nivel-servicio', maestrasPath + '.nivelServicio')
  Route.get('maestras/tipo-identificaciones', maestrasPath + '.tipoIdentificaciones')
  Route.get('maestras/clase-vehiculo', maestrasPath + '.claseVehiculo')
  Route.get('maestras/centros-poblados', maestrasPath + '.centrosPoblados')
  Route.get('maestras/rutas-activas-empresa', maestrasPath + '.rutasActivasEmpresa')
  Route.get('maestras/autorizaciones', maestrasPath + '.autorizaciones')
}).prefix('api/v1/integracion').middleware('autenticacionJwt')
