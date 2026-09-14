import { db } from './db';

export function todasLasClaves(): string[] {
  try {
    const rows = db.prepare('SELECT clave FROM temas ORDER BY perfil_codigo, orden').all() as {
      clave: string;
    }[];
    return rows.map((r) => r.clave);
  } catch {
    return [];
  }
}
