/**
 * La marca «Solo lectura» del encabezado (frente familia-lectura): la ve el familiar en todas las pantallas; el dueño no.
 * Solo informa: no es un control ni ofrece acciones. Sin estado ni imports: la usan el encabezado del tablero (cliente,
 * por eso vive aquí: tests/unit/tablero/frontera-cliente.test.ts) y los de servidor. Quién la ve lo decide cada página con la sesión revalidada (`esSoloLectura`, src/auth/roles.ts); lo que
 * escribe lo bloquea el servidor (`exigirDueno` / `exigirDuenoApi`), no esta marca.
 */
export const TEXTO_SOLO_LECTURA = "Solo lectura";

export function MarcaSoloLectura() {
  return <span className="solo-lectura">{TEXTO_SOLO_LECTURA}</span>;
}
