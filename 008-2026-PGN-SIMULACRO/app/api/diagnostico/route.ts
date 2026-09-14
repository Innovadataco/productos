import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const perfilCodigo = searchParams.get('perfil_codigo');

    if (!perfilCodigo) {
      return NextResponse.json({ error: 'perfil_codigo requerido' }, { status: 400 });
    }

    const rows = db
      .prepare('SELECT * FROM preguntas WHERE perfil_codigo = ? ORDER BY RANDOM() LIMIT 20')
      .all(perfilCodigo) as Array<{
        id: number;
        tema_id: number;
        perfil_codigo: string;
        enunciado: string;
        opciones: string;
        respuesta: number;
        explicacion: string;
        norma: string;
        articulo: string;
        dificultad: string;
      }>;

    const preguntas = rows.map((row) => ({
      ...row,
      opciones: JSON.parse(row.opciones) as string[],
    }));

    return NextResponse.json({ preguntas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
