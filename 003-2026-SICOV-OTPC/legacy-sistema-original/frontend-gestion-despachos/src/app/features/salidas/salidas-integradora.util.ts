export function leerRespuestaIntegradora(): any {
  const raw = localStorage.getItem('respuestaApiIntegradora');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.obj ?? parsed ?? null;
  } catch {
    return null;
  }
}

export function guardarRespuestaIntegradora(resp: unknown): void {
  localStorage.setItem('respuestaApiIntegradora', JSON.stringify(resp));
}

export function mapearVehiculoIntegradora(root: any): Record<string, unknown> {
  const v = root?.vehiculo;
  const pol = root?.polizas;
  const tobj = root?.tarjetaOperacion;
  const mprev = root?.mantenimientoPreventivo;
  const alist = root?.alistamientoDiario;
  if (!v) return {};
  return {
    placa: v.placa ?? '',
    soat: v.numeroSoat ?? '',
    fechaVencimientoSoat: v.soatVencimiento ?? v.soat_vencimiento ?? '',
    revisionTecnicoMecanica: v.numeroRtm ?? v.revisionTecnicoMecanica ?? '',
    fechaRevisionTecnicoMecanica: v.rtmVencimiento ?? v.fechaRevisionTecnicoMecanica ?? '',
    idPolizasContractual: pol?.contractual?.numeroPoliza ?? '',
    vigenciaContractual: pol?.contractual?.vencimiento ?? '',
    idPolizasExtracontractual: pol?.extracontractual?.numeroPoliza ?? '',
    vigenciaExtracontractual: pol?.extracontractual?.vencimiento ?? '',
    tarjetaOperacion: tobj?.numero ?? '',
    fechaTarjetaOperacion: tobj?.fechaExpedicion ?? '',
    fechaVencimientoTarjetaOperacion: tobj?.vencimiento ?? '',
    idMatenimientoPreventivo: mprev?.id ?? '',
    fechaMantenimiento: mprev?.fecha ?? '',
    idProtocoloAlistamientodiario: alist?.id ?? '',
    fechaProtocoloAlistamientodiario: alist?.fecha ?? '',
    clase: Number(v.claseVehiculoCodigo ?? v.claseVehiculo ?? 0) || null,
  };
}

function mapearConductorPersona(c: any): Record<string, unknown> {
  if (!c?.persona) return {};
  return {
    tipoIdentificacion: Number(c.persona?.tipoDocumento ?? 0) || null,
    numeroIdentificacion: c.persona?.numeroIdentificacion ?? '',
    primerNombre: c.persona?.primerNombre ?? '',
    segundoNombre: c.persona?.segundoNombre ?? '',
    primerApellido: c.persona?.primerApellido ?? '',
    segundoApellido: c.persona?.segundoApellido ?? '',
    idPruebaAlcoholimetria: c.alcoholimetria?.codigo ?? '',
    idExamenMedico: c.examenMedico?.codigo ?? c.aptitudFisica?.codigo ?? '',
    licenciaConduccion: c.licencia?.numeroLicencia ?? '',
    fechaVencimientoLicencia: c.licencia?.fechaVencimiento ?? '',
  };
}

export function mapearConductorIntegradora(root: any): Record<string, unknown> {
  const c = mapearConductorPersona(root?.conductor1);
  if (!c['numeroIdentificacion']) return {};
  return {
    tipoIdentificacionPrincipal: c['tipoIdentificacion'],
    numeroIdentificacion: c['numeroIdentificacion'],
    primerNombrePrincipal: c['primerNombre'],
    segundoNombrePrincipal: c['segundoNombre'],
    primerApellidoPrincipal: c['primerApellido'],
    segundoApellidoPrincipal: c['segundoApellido'],
    idPruebaAlcoholimetria: c['idPruebaAlcoholimetria'],
    idExamenMedico: c['idExamenMedico'],
    licenciaConduccion: c['licenciaConduccion'],
    fechaVencimientoLicencia: c['fechaVencimientoLicencia'],
  };
}

export function tieneConductorSecundario(root: unknown): boolean {
  if (!root || typeof root !== 'object') return false;
  const c = (root as Record<string, unknown>)['conductor2'] as Record<string, unknown> | undefined;
  const persona = c?.['persona'] as Record<string, unknown> | undefined;
  return !!String(persona?.['numeroIdentificacion'] ?? '').trim();
}

export function mapearConductorSecundarioIntegradora(root: any): Record<string, unknown> {
  const c = mapearConductorPersona(root?.conductor2);
  if (!c['numeroIdentificacion']) return {};
  return {
    tipoIdentificacionSecundario: c['tipoIdentificacion'],
    numeroIdentificacionSecundario: c['numeroIdentificacion'],
    primerNombreSecundario: c['primerNombre'],
    segundoNombreSecundario: c['segundoNombre'],
    primerApellidoSecundario: c['primerApellido'],
    segundoApellidoSecundario: c['segundoApellido'],
    idPruebaAlcoholimetriaSecundario: c['idPruebaAlcoholimetria'],
    idExamenMedicoSecundario: c['idExamenMedico'],
    licenciaConduccionSecundario: c['licenciaConduccion'],
    fechaVencimientoLicenciaSecundario: c['fechaVencimientoLicencia'],
  };
}

export function mapearConductoresIntegradora(root: any): Record<string, unknown> {
  return {
    ...mapearConductorIntegradora(root),
    ...mapearConductorSecundarioIntegradora(root),
  };
}
