import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface ResultadoRow {
  id: number;
  perfil_codigo: string;
  tema_id: number | null;
  correctas: number;
  total: number;
  falladas: string;
  duracion_seg: number;
  created_at: number;
}

interface TemaRow {
  id: number;
  clave: string;
  nombre: string;
  eje: string;
  color: string;
  icono: string;
  orden: number;
}

interface TemaStats {
  tema_id: number;
  clave: string;
  nombre: string;
  eje: string;
  color: string;
  intentos: number;
  correctas: number;
  total: number;
  porcentaje: number;
  ultimo_intento: number | null;
  ultimo_puntaje: number | null;
}

interface NormaError {
  norma: string;
  intentos: number;
  falladas: number;
  tasa_error: number;
}

interface PreguntaFallada {
  pregunta_id: number;
  enunciado: string;
  norma: string;
  tema_nombre: string;
  veces: number;
}

interface EvolucionDia {
  dia: string;
  intentos: number;
  correctas: number;
  total: number;
  porcentaje: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const perfilCodigo = searchParams.get('perfil_codigo');

    if (!perfilCodigo) {
      return NextResponse.json({ error: 'perfil_codigo requerido' }, { status: 400 });
    }

    const resultados = db
      .prepare('SELECT * FROM resultados WHERE perfil_codigo = ? ORDER BY created_at DESC')
      .all(perfilCodigo) as ResultadoRow[];

    const temas = db
      .prepare('SELECT * FROM temas WHERE perfil_codigo = ? ORDER BY orden')
      .all(perfilCodigo) as TemaRow[];

    const totalCorrectas = resultados.reduce((sum, r) => sum + r.correctas, 0);
    const totalPreguntas = resultados.reduce((sum, r) => sum + r.total, 0);
    const promedioGeneral = totalPreguntas > 0 ? Math.round((totalCorrectas / totalPreguntas) * 100) : 0;

    const resultadosPorTema: Record<number, ResultadoRow[]> = {};
    for (const r of resultados) {
      if (r.tema_id === null) continue;
      if (!resultadosPorTema[r.tema_id]) resultadosPorTema[r.tema_id] = [];
      resultadosPorTema[r.tema_id].push(r);
    }

    const statsPorTema: TemaStats[] = temas.map((tema) => {
      const intentos = resultadosPorTema[tema.id] ?? [];
      const correctas = intentos.reduce((sum, r) => sum + r.correctas, 0);
      const total = intentos.reduce((sum, r) => sum + r.total, 0);
      const ultimo = intentos[0] ?? null;
      return {
        tema_id: tema.id,
        clave: tema.clave,
        nombre: tema.nombre,
        eje: tema.eje,
        color: tema.color,
        intentos: intentos.length,
        correctas,
        total,
        porcentaje: total > 0 ? Math.round((correctas / total) * 100) : 0,
        ultimo_intento: ultimo?.created_at ?? null,
        ultimo_puntaje: ultimo ? Math.round((ultimo.correctas / ultimo.total) * 100) : null,
      };
    });

    const temasDebiles = statsPorTema
      .filter((s) => s.intentos > 0 && s.porcentaje < 65)
      .sort((a, b) => a.porcentaje - b.porcentaje);

    const preguntasFalladas = db
      .prepare(`
        SELECT
          r.pregunta_id,
          p.enunciado,
          p.norma,
          t.nombre AS tema_nombre,
          COUNT(*) AS veces
        FROM respuestas r
        JOIN resultados res ON res.id = r.resultado_id
        JOIN preguntas p ON p.id = r.pregunta_id
        JOIN temas t ON t.id = p.tema_id
        WHERE res.perfil_codigo = ? AND r.correcta = 0
        GROUP BY r.pregunta_id
        HAVING veces > 1
        ORDER BY veces DESC, r.pregunta_id DESC
        LIMIT 20
      `)
      .all(perfilCodigo) as PreguntaFallada[];

    const normasError = db
      .prepare(`
        SELECT
          p.norma,
          COUNT(*) AS intentos,
          SUM(CASE WHEN r.correcta = 0 THEN 1 ELSE 0 END) AS falladas,
          (CAST(SUM(CASE WHEN r.correcta = 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*)) AS tasa_error
        FROM respuestas r
        JOIN resultados res ON res.id = r.resultado_id
        JOIN preguntas p ON p.id = r.pregunta_id
        WHERE res.perfil_codigo = ? AND p.norma != ''
        GROUP BY p.norma
        HAVING intentos >= 2
        ORDER BY tasa_error DESC, intentos DESC
        LIMIT 10
      `)
      .all(perfilCodigo) as NormaError[];

    const normasConTasa = normasError.map((n) => ({
      ...n,
      tasa_error: n.intentos > 0 ? Math.round((n.falladas / n.intentos) * 100) : 0,
    }));

    const evolucionMap: Record<string, { intentos: number; correctas: number; total: number }> = {};
    for (const r of resultados) {
      const dia = new Date(r.created_at).toISOString().split('T')[0];
      if (!evolucionMap[dia]) {
        evolucionMap[dia] = { intentos: 0, correctas: 0, total: 0 };
      }
      evolucionMap[dia].intentos += 1;
      evolucionMap[dia].correctas += r.correctas;
      evolucionMap[dia].total += r.total;
    }

    const evolucion: EvolucionDia[] = Object.entries(evolucionMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, vals]) => ({
        dia,
        intentos: vals.intentos,
        correctas: vals.correctas,
        total: vals.total,
        porcentaje: vals.total > 0 ? Math.round((vals.correctas / vals.total) * 100) : 0,
      }));

    return NextResponse.json({
      perfil_codigo: perfilCodigo,
      promedio_general: promedioGeneral,
      intentos_totales: resultados.length,
      total_correctas: totalCorrectas,
      total_preguntas: totalPreguntas,
      temas: statsPorTema,
      temas_debiles: temasDebiles,
      preguntas_falladas: preguntasFalladas,
      normas_error: normasConTasa,
      evolucion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
