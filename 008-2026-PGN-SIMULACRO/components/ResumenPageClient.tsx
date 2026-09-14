'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import { Perfil, Tema, Resumen } from '@/lib/types';
import { getPerfilActivo, getPerfiles, getTemas, getResumenes } from '@/lib/client-data';
import { Loader2 } from 'lucide-react';

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
      <main className="page-shell flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-pgn-600" aria-label="Cargando resumen" />
      </main>
    );
  }

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="px-4 py-6">
        <div className="animate-fade-up opacity-0">
          <h1 className="text-headline text-ink">{tema.nombre}</h1>
          <h2 className="mt-1 text-callout text-ink-muted">Resumen</h2>
        </div>

        {resumenes.length === 0 && (
          <div className="mt-6 card border-dashed border-ink-subtle/30 p-8 text-center animate-fade-up opacity-0" style={{ animationDelay: '80ms' }}>
            <p className="text-body text-ink-muted">
              No hay resúmenes cargados para este tema aún.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {resumenes.map((resumen, i) => (
            <article
              key={resumen.id}
              className="card p-5 animate-fade-up opacity-0"
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <h3 className="text-title-1 text-ink">{resumen.titulo}</h3>
              <div
                className="prose prose-sm mt-3 max-w-none text-body text-ink-muted"
                dangerouslySetInnerHTML={{ __html: resumen.contenido_html }}
              />
              {resumen.fuente_url && (
                <a
                  href={resumen.fuente_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-callout font-medium text-pgn-600 hover:underline"
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
