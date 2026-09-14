import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      perfil_codigo: string;
      tema_id: number | null;
      correctas: number;
      total: number;
      falladas: string;
      duracion_seg: number;
      respuestas: { preguntaId: number; marcada: number; correcta: number }[];
    };

    const insertResultado = db.prepare(`
      INSERT INTO resultados (perfil_codigo, tema_id, correctas, total, falladas, duracion_seg, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = insertResultado.run(
      body.perfil_codigo,
      body.tema_id ?? null,
      body.correctas,
      body.total,
      body.falladas,
      body.duracion_seg,
      Date.now()
    );

    const resultadoId = Number(info.lastInsertRowid);

    const respuestas = body.respuestas ?? [];
    if (respuestas.length > 0) {
      const insertRespuesta = db.prepare(`
        INSERT INTO respuestas (resultado_id, pregunta_id, marcada, correcta)
        VALUES (?, ?, ?, ?)
      `);

      for (const r of respuestas) {
        insertRespuesta.run(resultadoId, r.preguntaId, r.marcada, r.correcta);
      }
    }

    return NextResponse.json({ id: resultadoId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const perfilCodigo = searchParams.get('perfil_codigo');
    const id = searchParams.get('id');

    if (id) {
      const resultado = db.prepare('SELECT * FROM resultados WHERE id = ?').get(id);
      return NextResponse.json({ resultado });
    }

    if (perfilCodigo) {
      const resultados = db
        .prepare('SELECT * FROM resultados WHERE perfil_codigo = ? ORDER BY created_at DESC')
        .all(perfilCodigo);
      return NextResponse.json({ resultados });
    }

    return NextResponse.json({ resultados: [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
