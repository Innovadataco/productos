import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const perfilCodigo = searchParams.get('perfil_codigo');

    if (!perfilCodigo) {
      return NextResponse.json({ error: 'perfil_codigo requerido' }, { status: 400 });
    }

    const resultados = db
      .prepare('SELECT * FROM resultados WHERE perfil_codigo = ? ORDER BY created_at DESC')
      .all(perfilCodigo) as {
      id: number;
      perfil_codigo: string;
      tema_id: number | null;
      correctas: number;
      total: number;
      falladas: string;
      duracion_seg: number;
      created_at: number;
    }[];

    const temas = db
      .prepare('SELECT * FROM temas WHERE perfil_codigo = ? ORDER BY orden')
      .all(perfilCodigo) as {
      id: number;
      nombre: string;
    }[];

    const promediosPorTema: Record<number, { total: number; correctas: number }> = {};
    for (const r of resultados) {
      if (r.tema_id === null) continue;
      if (!promediosPorTema[r.tema_id]) promediosPorTema[r.tema_id] = { total: 0, correctas: 0 };
      promediosPorTema[r.tema_id].total += r.total;
      promediosPorTema[r.tema_id].correctas += r.correctas;
    }

    const promedios = temas.map((t) => ({
      tema_id: t.id,
      nombre: t.nombre,
      porcentaje:
        promediosPorTema[t.id]?.total > 0
          ? Math.round((promediosPorTema[t.id].correctas / promediosPorTema[t.id].total) * 100)
          : 0,
    }));

    const debajoDe65 = promedios.filter((p) => p.porcentaje > 0 && p.porcentaje < 65);

    const normasCuenta: Record<string, number> = {};
    for (const r of resultados) {
      const ids: number[] = JSON.parse(r.falladas || '[]') as number[];
      for (const id of ids) {
        const pregunta = db.prepare('SELECT norma FROM preguntas WHERE id = ?').get(id) as { norma: string } | undefined;
        const clave = pregunta?.norma || 'Sin norma';
        normasCuenta[clave] = (normasCuenta[clave] || 0) + 1;
      }
    }

    const normasMasFalladas = Object.entries(normasCuenta)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([norma, count]) => ({ norma, count }));

    const evolucionMap: Record<string, { total: number; correctas: number }> = {};
    for (const r of resultados) {
      const dia = new Date(r.created_at).toISOString().split('T')[0];
      if (!evolucionMap[dia]) evolucionMap[dia] = { total: 0, correctas: 0 };
      evolucionMap[dia].total += r.total;
      evolucionMap[dia].correctas += r.correctas;
    }

    const evolucion = Object.entries(evolucionMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, vals]) => ({
        dia,
        porcentaje: vals.total > 0 ? Math.round((vals.correctas / vals.total) * 100) : 0,
      }));

    return NextResponse.json({
      perfil_codigo: perfilCodigo,
      promedios,
      debajoDe65,
      normas_mas_falladas: normasMasFalladas,
      evolucion,
      intentos: resultados.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
