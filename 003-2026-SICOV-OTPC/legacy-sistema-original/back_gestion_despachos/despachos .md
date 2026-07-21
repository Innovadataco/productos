Manual Técnico de Integración: APIs de Despacho y Llegadas (Supertransporte)

Este manual técnico define los lineamientos, especificaciones y protocolos requeridos para la integración con los servicios web de la Superintendencia de Transporte de Colombia. Está dirigido a proveedores tecnológicos y empresas de transporte (vigilados) que deban reportar la operación de despachos, llegadas y novedades en cumplimiento con la normatividad vigente.

1. Configuración Global y Autenticación

1.1 Variables de Ambiente y Endpoints Base

Para la implementación, se deben configurar los siguientes endpoints base en el entorno de desarrollo/producción:

Variable de Ambiente	URL Base
URL-Autenticación	https://sinstbackend.azurewebsites.net
URL-Despacho	https://msdespachosback.thankfulbeach-21114078.eastus.azurecontainerapps.io
URL-Paramétrica	https://msparametricasqa.thankfulbeach-21114078.eastus.azurecontainerapps.io
URL_ApiIntegradora	https://pruebasterminales.supertransporte.gov.co
URL-Rutas	https://rutasbackend.azurewebsites.net

1.2 Proceso de Autenticación (Inicio de Sesión)

El acceso a las APIs transaccionales requiere un token JWT dinámico.

* Endpoint: POST {{URL-Autenticación}}/api/v1/autenticacion/inicio-sesion
* Cuerpo de la Solicitud (JSON):

{
  "usuario": "910000031",
  "contrasena": "********"
}


* Respuesta Exitosa: El sistema retornará un objeto con el campo token. Este debe incluirse en el encabezado de todas las peticiones transaccionales como Authorization: Bearer <token>.

[!CAUTION] Diferenciación de Tokens:

1. Token Transaccional: Dinámico, obtenido vía login, usado para Despachos, Llegadas e Integradora.
2. Token Paramétrico: Estático y único para catálogos: REDACTED-TOKEN-PARAMETRICO.

2. APIs de Consulta Paramétrica

Estas APIs permiten la estandarización de datos de catálogos oficiales. Requieren el Token Paramétrico estático en el encabezado Authorization: Bearer.

2.1 Listado de Tipos de Identificación

* Endpoint: GET {{URL-Paramétrica}}/api/v1/parametrica/listar-tipo-identificaciones
* Uso: Define códigos para Cédula (1), NIT (3), etc.

2.2 Listado de Clases de Vehículo

* Endpoint: GET {{URL-Paramétrica}}/api/v1/parametrica/listar-clase-vehiculo
* Uso: Códigos para Bus (1), Microbús (2), etc.

2.3 Listado de Centros Poblados

* Endpoint: GET {{URL-Paramétrica}}/api/v1/parametrica/listar-centros-poblados
* Uso: Homologación de municipios origen/destino.

2.4 Listado de Niveles de Servicio

* Endpoint: GET {{URL-Despacho}}/api/v1/nivelservicio
* Parámetros Query: page (opcional), numero_items (opcional).

3. API Integradora: Consulta de Información Consolidada

Este servicio centraliza la validación de conductores y vehículos ante entes externos antes de la creación de un despacho.

3.1 Especificación del Endpoint Principal

* Método: POST
* Endpoint: {{URL_ApiIntegradora}}/api-integradora/resumen

Parámetros del Body (camelCase):

Parámetro	Tipo	Requerido	Descripción
numeroIdentificacion1	String	Sí	Documento del conductor principal.
numeroIdentificacion2	String	No	Documento del segundo conductor.
placa	String	Sí	Placa del vehículo (formato AAA123).
nit	String	No	NIT de la empresa de transporte.
fechaConsulta	String	Sí	Formato YYYY-MM-DD.
horaConsulta	String	Condicional	Formato HH:mm. Requerido en consultas pasadas.

3.2 Lógica de Negocio: Ventana de Tiempo e Históricos

* Consultas Hoy: Si fechaConsulta es el día actual, horaConsulta es opcional. El sistema consulta en vivo a las fuentes externas.
* Consultas Pasadas: Si fechaConsulta es menor a hoy, horaConsulta es obligatoria. El sistema busca en el histórico (integradora_historicos) en una ventana de ±5 minutos respecto a la hora enviada.
* Fuente de Datos: El campo meta.fromHistorico (booleano) indica si el dato provino de la base de datos local (true) o de una consulta en tiempo real (false).

3.3 Estructura de Respuesta Exitosa (JSON Full)

El sistema responde con objetos detallados. Observe que el objeto de respuesta puede combinar camelCase con snake_case según el componente:

{
  "status": 200,
  "titulo": "Consulta integradora exitosa",
  "obj": {
    "conductor1": {
      "persona": {
        "tipoDocumento": 1,
        "numeroIdentificacion": "1018483318",
        "nombres": "MONICA MARIA",
        "apellidos": "CORREA SALAMANCA"
      },
      "licencia": {
        "numeroLicencia": "19455752",
        "estado": "ACTIVA",
        "fechaVencimiento": "2026-07-14"
      },
      "alcoholimetria": {
        "resultado": "Negativo",
        "fecha": "2025-05-21",
        "hora": "06:15",
        "codigo": 6020
      },
      "aptitudFisica": {
        "resultado": "Apto",
        "fecha": "2025-05-21",
        "hora": "10:20:00",
        "codigo": 9016
      }
    },
    "vehiculo": {
      "placa": "NHT279",
      "claseVehiculoCodigo": 1,
      "claseVehiculo": "BUS",
      "numeroSoat": "3519654866",
      "soat_vencimiento": "2025-12-19",
      "numeroRtm": 188521441,
      "rtm_vencimiento": null
    },
    "polizas": {
      "contractual": { "estado": "ACTIVO", "vencimiento": "2025-12-03" },
      "extracontractual": { "estado": "ACTIVO", "vencimiento": "2025-12-03" }
    },
    "tarjetaOperacion": {
      "numero": "490694",
      "estado": "ACTIVO",
      "vencimiento": "2027-04-29",
      "empresaAsociada": "TRANSPORTE ESPECIAL PG SAS"
    },
    "mantenimientoPreventivo": { "id": 256, "fecha": "2025-05-21", "detalleActividades": "..." },
    "mantenimientoCorrectivo": { "id": 105, "fecha": "2025-05-21", "detalleActividades": "..." },
    "alistamientoDiario": { "id": 110, "fecha": "2025-05-21", "detalleActividades": "..." },
    "meta": {
      "fromHistorico": false,
      "fechaConsultaIntegradora": "2025-05-21",
      "horaConsultaIntegradora": "14:30"
    }
  }
}


4. Gestión de Despachos (Salidas)

4.1 Creación de Despacho (Empresa)

* Método: POST
* Endpoint: {{URL-Despacho}}/api/v1/despachosempresa
* Headers Requeridos:
  * Authorization: Bearer <Transactional_Token>
  * token: Identificador único entregado al vigilado.
  * documento: NIT de la empresa de transporte.

Desglose del Cuerpo de Solicitud (JSON):

1. obj_despacho (Generales):

* nitEmpresaTransporte (String/Req): NIT del vigilado.
* razonSocial (String/Req): Nombre legal.
* fechaSalida (YYYY-MM-DD/Req) y horaSalida (HH:mm/Req).
* numeroPasajero (Int), valorTiquete (Float), despachoEnTransito (Bool).

2. obj_vehiculo (Técnico):

* placa, soat, fechaVencimientoSoat, revisionTecnicoMecanica, fechaRevisionTecnicoMecanica.
* tarjetaOperacion, fechaVencimientoTarjetaOperacion.
* idMatenimientoPreventivo, idProtocoloAlistamientodiario.
* clase (ID paramétrico), nivelServicio (ID paramétrico).

3. obj_conductores:

* tipoIdentificacionPrincipal, numeroIdentificacion, primerNombrePrincipal, idExamenMedico, idPruebaAlcoholimetria, licenciaConduccion.
* (Repetir campos con sufijo Secundario si aplica).

4. obj_rutas:

* idOrigen, idDestino, centroPobladoOrigen, centroPobladoDestino.

5. array_autorizaciones (Opcional):

* Arreglo de objetos para transporte de NNA (Niños, Niñas y Adolescentes), incluyendo datos del otorgante y nombres de archivos soporte.

4.2 Consulta de Despacho por Placa

* Endpoint: GET {{URL-Despacho}}/api/v1/despachos/placa/{placa}?fechaSalida=YYYY-MM-DD

4.3 Listado de Rutas Activas

* Endpoint: GET {{URL-Rutas}}/api/v1/maestras/rutas-activas-empresa?nit={NIT}

4.4 Listado de Autorizaciones

* Endpoint: GET {{URL-Rutas}}/api/v1/maestras/autorizaciones?nit={NIT}&placa={placa}&fecha={fecha}

5. Gestión de Novedades y Llegadas

5.1 Registro de Novedades

Permite reportar cambios sobre un despacho existente.

Novedad de Vehículo: POST {{URL-Despacho}}/api/v1/novedadesvehiculo

{
  "idNovedad": 779,
  "placa": "AMD816",
  "soat": "3359874900",
  "fechaVencimientoSoat": "2026-02-10",
  "revisionTecnicoMecanica": "178299235",
  "fechaRevisionTecnicoMecanica": "2025-12-27",
  "clase": 6,
  "nivelServicio": 2,
  "idPolizaContractual": "9999"
}


Novedad de Conductor: POST {{URL-Despacho}}/api/v1/novedadesconductor

{
  "idNovedad": 779,
  "numeroIdentificacion": "80400600",
  "idPruebaAlcoholimetria": "67529",
  "resultadoPruebaAlcoholimetria": "Negativo",
  "licenciaConduccion": "52099336",
  "idExamenMedico": "9196"
}


5.2 Registro de Llegadas

* Endpoint: POST {{URL-Despacho}}/api/v1/llegadasempresas

Atributo	Llegada Tipo 1 (Con Despacho)	Llegada Tipo 2 (Sin Despacho)
idTipollegada	1	2
idDespacho	ID numérico del despacho	null
placa	Requerido	Requerido
numeroPasajero	Requerido	Requerido

6. Manejo de Errores y Respuestas HTTP

Código HTTP	Significado Contextual	Acción Recomendada
200 OK	Operación exitosa.	Procesar el objeto obj retornado.
400 Bad Request	Formato de fecha/hora incorrecto o parámetros faltantes.	Validar que fechas sean YYYY-MM-DD y horas HH:mm (24h).
404 Not Found	Recurso no encontrado (Placa o ID Despacho).	Validar exactitud de la placa o existencia del despacho previo.
500 Internal Error	Error en servicios externos (RUNT, Mantenimientos).	Implementar reintentos (Retry logic) ante indisponibilidad temporal.

Recomendaciones Finales:

* Validación de Placas: Realice una limpieza de espacios y guiones antes del envío.
* Timeouts: Las consultas integradoras pueden demorar hasta 10 segundos debido a la orquestación con fuentes externas; configure sus timeouts en consecuencia.
* Observaciones: Para despachos pasados, asegúrese que la horaSalida coincida con el registro histórico de la API Integradora.
