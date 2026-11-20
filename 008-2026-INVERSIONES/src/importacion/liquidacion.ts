/** T+N en días hábiles de la BVC: salta sábados, domingos y los días no hábiles del calendario. */
const DIA_MS = 24 * 60 * 60 * 1000;

const clave = (d: Date) => d.toISOString().slice(0, 10);

export function sumarDiasHabiles(fecha: Date, dias: number, noHabiles: ReadonlySet<string>): Date {
  let actual = fecha;
  let restantes = dias;
  while (restantes > 0) {
    actual = new Date(actual.getTime() + DIA_MS);
    const dow = actual.getUTCDay();
    if (dow !== 0 && dow !== 6 && !noHabiles.has(clave(actual))) restantes -= 1;
  }
  return actual;
}

export const DIAS_LIQUIDACION = 2;
