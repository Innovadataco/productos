import { Usuario } from './models/auth.models';



/** Aplana la respuesta de login cuando `usuario.usuario` es un objeto anidado. */

export function normalizarUsuarioSesion(raw: object): Usuario {

  const u = raw as Record<string, unknown>;

  const inner = u['usuario'];

  const nested =

    inner && typeof inner === 'object' && !Array.isArray(inner)

      ? (inner as Record<string, unknown>)

      : null;



  const pick = (key: string, fallback = '') => {

    const v = nested?.[key] ?? u[key];

    return v == null ? fallback : String(v);

  };



  const nitRaw = nested?.['nit'] ?? u['nit'];

  const identificacion =

    nested?.['usuario'] != null

      ? String(nested['usuario'])

      : typeof u['usuario'] === 'string'

        ? u['usuario']

        : '';



  return {

    id: pick('id'),

    usuario: identificacion,

    nombre: pick('nombre'),

    apellido: pick('apellido'),

    telefono: pick('telefono'),

    correo: pick('correo'),

    idEmpresa: u['idEmpresa'] != null ? String(u['idEmpresa']) : undefined,

    logoEmpresa: u['logoEmpresa'] != null ? String(u['logoEmpresa']) : undefined,

    abrirModal: Boolean(u['abrirModal'] ?? false),

    departamentoId: Number(u['departamentoId'] ?? nested?.['departamentoId'] ?? 0),

    municipioId: Number(u['municipioId'] ?? nested?.['municipioId'] ?? 0),

    esDepartamental: Number(u['esDepartamental'] ?? nested?.['esDepartamental'] ?? 0),

    nombreCiudad: pick('nombreCiudad'),

    nombreDepartamento: pick('nombreDepartamento'),

    reportaOtroMunicipio: Boolean(u['reportaOtroMunicipio'] ?? false),

    nit: nitRaw == null ? undefined : nitRaw as string | number,

  };

}



/** Extrae el NIT de empresa desde la respuesta de inicio de sesión guardada en localStorage. */

export function extraerNitEmpresa(raw: unknown): string {

  if (!raw || typeof raw !== 'object') return '';

  const u = raw as Record<string, unknown>;

  if (u['nit'] != null && String(u['nit']).trim()) {

    return String(u['nit']).trim();

  }

  const inner = u['usuario'];

  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {

    const nested = inner as Record<string, unknown>;

    if (nested['nit'] != null && String(nested['nit']).trim()) {

      return String(nested['nit']).trim();

    }

  }

  return '';

}



/** Nombre visible del operador (soporta estructura anidada legacy en localStorage). */

export function extraerNombreUsuario(raw: unknown): string {

  if (!raw || typeof raw !== 'object') return '';

  const u = raw as Record<string, unknown>;

  const inner = u['usuario'];

  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {

    const nested = inner as Record<string, unknown>;

    const nombre = [nested['nombre'], nested['apellido']].filter(Boolean).join(' ').trim();

    if (nombre) return nombre;

  }

  return [u['nombre'], u['apellido']].filter(Boolean).join(' ').trim();

}


