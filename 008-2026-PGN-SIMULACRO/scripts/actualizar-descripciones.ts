import db from '../lib/db';
import { temasPorPerfil } from '../lib/seed';

const stmt = db.prepare(`
  UPDATE temas SET descripcion = ? WHERE perfil_codigo = ? AND clave = ?
`);

let actualizados = 0;
for (const [perfilCodigo, temas] of Object.entries(temasPorPerfil)) {
  for (const tema of temas) {
    const info = stmt.run(tema.descripcion, perfilCodigo, `${tema.clave}-${perfilCodigo}`);
    actualizados += info.changes;
  }
}

console.log(`Descripciones actualizadas: ${actualizados}`);
