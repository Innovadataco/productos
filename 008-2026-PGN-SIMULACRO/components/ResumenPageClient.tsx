'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import { Perfil, Tema, Resumen } from '@/lib/types';
import { getPerfilActivo, getPerfiles, getTemas, getResumenes } from '@/lib/client-data';

export default function ResumenPageClient() {
  const router = useRouter();
  const params = useParams();
  const temaClave = params.tema as string;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [tema, setTema] = useState<Tema | null>(null);
  const [resumenes, setResumenes] = useState<Resumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }
    Promise.all([getPerfiles(), getTemas(), getResumenes()])
      .then(([perfiles, allTemas, allResumenes]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        const t = allTemas.find((x) => x.perfil_codigo === codigo && x.clave === temaClave);
        if (!p || !t) {
          router.replace('/home');
          return;
        }
        setPerfil(p);
        setTema(t);
        setResumenes(allResumenes.filter((r) => r.tema_id === t.id));
      })
      .finally(() => setLoading(false));
  }, [router, temaClave]);

  if (loading || !perfil || !tema) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Cargando resumen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">{tema.nombre}</h1>
        <h2 className="mt-1 text-sm font-medium text-slate-500">Resumen</h2>

        {resumenes.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">No hay resúmenes cargados para este tema aún.</p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {resumenes.map((resumen) => (
            <article key={resumen.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-base font-bold text-slate-900">{resumen.titulo}</h3>
              <div
                className="prose prose-sm mt-2 max-w-none text-slate-700"
                dangerouslySetInnerHTML={{ __html: resumen.contenido_html }}
              />
              {resumen.fuente_url && (
                <a
                  href={resumen.fuente_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-pgn-600 hover:underline"
                >
                  Fuente
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
