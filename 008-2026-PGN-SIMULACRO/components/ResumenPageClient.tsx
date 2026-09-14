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
      <main className="ios-page flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-ios-primary" aria-label="Cargando resumen" />
      </main>
    );
  }

  return (
    <main className="ios-page">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="ios-content py-6">
        <h1 className="text-ios-title-2 text-ios-label">{tema.nombre}</h1>
        <h2 className="mt-1 text-ios-subhead text-ios-label-secondary">Resumen</h2>

        {resumenes.length === 0 && (
          <div className="mt-6 rounded-ios-xl border border-dashed border-ios-gray-4 bg-ios-surface p-8 text-center shadow-ios">
            <p className="text-ios-body text-ios-label-secondary">
              No hay resúmenes cargados para este tema aún.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {resumenes.map((resumen) => (
            <article key={resumen.id} className="ios-card p-5">
              <h3 className="text-ios-title-3 text-ios-label">{resumen.titulo}</h3>
              <div
                className="prose prose-sm mt-3 max-w-none text-ios-body text-ios-label-secondary"
                dangerouslySetInnerHTML={{ __html: resumen.contenido_html }}
              />
              {resumen.fuente_url && (
                <a
                  href={resumen.fuente_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-ios-subhead font-medium text-ios-primary hover:underline"
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
