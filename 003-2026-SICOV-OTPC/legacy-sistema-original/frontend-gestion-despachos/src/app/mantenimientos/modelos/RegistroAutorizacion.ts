export interface RegistroAutorizacion {
  id?: string
  fechaDiligenciamiento?: string;
  placa?: string;
  estadoMantenimiento?: string;
  tipoId?: string;
  mantenimiento_id?: string;
}
export interface Autorizacion {
  id?: string;
  fechaViaje?: Date  | string;
  origen?: string;
  destino?: string;
  tipoIdentificacionNna?: string;
  numeroIdentificacionNna?: number;
  nombresApellidosNna?: string;
  situacionDiscapacidad?: string;
  tipoDiscapacidad?: string;
  perteneceComunidadEtnica?: string;
  tipoPoblacionEtnica?: string;
  tipoIdentificacionOtorgante?: string;
  numeroIdentificacionOtorgante?: number;
  nombresApellidosOtorgante?: string;
  numeroTelefonicoOtorgante?: number;
  correoElectronicoOtorgante?: string;
  direccionFisicaOtorgante?: string;
  sexoOtorgante?: string;
  generoOtorgante?: string | null;
  calidadActua?: string;
  tipoIdentificacionAutorizadoViajar?: string;
  numeroIdentificacionAutorizadoViajar?: number;
  nombresApellidosAutorizadoViajar?: string;
  numeroTelefonicoAutorizadoViajar?: number;
  direccionFisicaAutorizadoViajar?: string;
  tipoIdentificacionAutorizadoRecoger?: string;
  numeroIdentificacionAutorizadoRecoger?: number;
  nombresApellidosAutorizadoRecoger?: string;
  numeroTelefonicoAutorizadoRecoger?: number;
  direccionFisicaAutorizadoRecoger?: string;
  copiaAutorizacionViajeNombreOriginal?: string;
  copiaAutorizacionViajeDocumento?: string;
  copiaAutorizacionViajeRuta?: string;
  copiaDocumentoParentescoNombreOriginal?: string;
  copiaDocumentoParentescoDocumento?: string;
  copiaDocumentoParentescoRuta?: string;
  copiaDocumentoIdentidadAutorizadoNombreOriginal?: string;
  copiaDocumentoIdentidadAutorizadoDocumento?: string;
  copiaDocumentoIdentidadAutorizadoRuta?: string;
  copiaConstanciaEntregaNombreOriginal?: string;
  copiaConstanciaEntregaDocumento?: string;
  copiaConstanciaEntregaRuta?: string;
  mantenimientoId?: number;
}
