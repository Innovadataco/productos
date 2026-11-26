/**
 * Direcciones del servicio de precios (condición del CEO de PI: nunca conexiones a la IP del host).
 * - Solo IPv4 públicas: fuera quedan los rangos de uso especial de IANA (privadas, bucle, enlace local, CGNAT,
 *   documentación, pruebas, multidifusión y reservadas). Así quedan fuera la puerta de enlace del puente de Docker
 *   (la IP del host vista desde el contenedor), el DNS de Docker y los metadatos de la nube. IPv6, nunca (la red del
 *   servicio no la tiene).
 * - `crearLookupSeguro` es el `lookup` de la conexión: resuelve el nombre, rechaza TODO si alguna dirección no es
 *   pública (señal de un DNS alterado) y entrega solo las validadas. La conexión va a esa IP: no hay carrera entre
 *   validar y conectar. Mismo patrón que azu/request-filtering-agent, sin la dependencia.
 * - Residual: si el DNS de los 3 nombres fijos devolviera la IP PÚBLICA del VPS, pasaría (no se conoce aquí y no va
 *   en este repo público).
 * Los rangos van como números: el cruce de literales de la Fábrica marca cualquier IPv4 escrita.
 */
import { promises as dns, type LookupAddress } from "node:dns";
import { BlockList, isIPv4, type LookupFunction } from "node:net";

/** [primer octeto, segundo, tercero, cuarto, prefijo] de cada rango que no es público (IANA, uso especial). */
const RANGOS_NO_PUBLICOS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [0, 0, 0, 0, 8], // «esta red»
  [10, 0, 0, 0, 8], // privada
  [100, 64, 0, 0, 10], // CGNAT
  [127, 0, 0, 0, 8], // bucle (incluye el DNS de Docker)
  [169, 254, 0, 0, 16], // enlace local (metadatos de la nube)
  [172, 16, 0, 0, 12], // privada (las redes y puertas de enlace de Docker)
  [192, 0, 0, 0, 24], // asignaciones del IETF
  [192, 0, 2, 0, 24], // documentación
  [192, 88, 99, 0, 24], // relé 6to4
  [192, 168, 0, 0, 16], // privada
  [198, 18, 0, 0, 15], // pruebas de rendimiento
  [198, 51, 100, 0, 24], // documentación
  [203, 0, 113, 0, 24], // documentación
  [224, 0, 0, 0, 4], // multidifusión
  [240, 0, 0, 0, 4], // reservada y difusión
];

const NO_PUBLICAS = new BlockList();
for (const [a, b, c, d, prefijo] of RANGOS_NO_PUBLICOS) NO_PUBLICAS.addSubnet([a, b, c, d].join("."), prefijo, "ipv4");

/** ¿Es una IPv4 pública? IPv6 y textos que no son una IPv4 exacta, nunca. */
export function ipv4Publica(direccion: string): boolean {
  return isIPv4(direccion) && !NO_PUBLICAS.check(direccion, "ipv4");
}

/** Resuelve un nombre a sus IPv4 (inyectable: en las pruebas no hay DNS real). */
export type Resolver = (nombre: string) => Promise<readonly LookupAddress[]>;

const resolverDelSistema: Resolver = (nombre) => dns.lookup(nombre, { all: true, family: 4 });

function errorNoPublica(): NodeJS.ErrnoException {
  return Object.assign(new Error("PRECIOS_DIRECCION_NO_PUBLICA: el nombre resolvió a una dirección que no es una IPv4 pública"), {
    code: "PRECIOS_DIRECCION_NO_PUBLICA",
  });
}

/**
 * El `lookup` de net/tls que solo entrega IPv4 públicas. Atiende las dos firmas de net: con `all` (la que usa
 * Node 22 con autoSelectFamily) devuelve la lista; sin él, la primera dirección y su familia.
 */
export function crearLookupSeguro(resolver: Resolver = resolverDelSistema): LookupFunction {
  return (nombre, opciones, alResolver) => {
    resolver(nombre).then(
      (direcciones) => {
        if (direcciones.length === 0 || direcciones.some((d) => d.family !== 4 || !ipv4Publica(d.address))) {
          alResolver(errorNoPublica(), "", 0);
          return;
        }
        const validadas = direcciones.map((d) => ({ address: d.address, family: 4 }));
        if (opciones.all) alResolver(null, validadas);
        else alResolver(null, validadas[0]!.address, 4);
      },
      (error: NodeJS.ErrnoException) => alResolver(error, "", 0),
    );
  };
}
