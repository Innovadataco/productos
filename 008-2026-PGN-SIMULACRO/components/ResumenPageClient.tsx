'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronDown, FileText, Loader2 } from 'lucide-react';
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

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

  const toggle = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref={`/tema/${tema.clave}`} />
      <section className="px-4 py-6">
        <div className="animate-fade-up opacity-0">
          <h1 className="text-headline text-ink">{tema.nombre}</h1>
          <h2 className="mt-1 text-callout text-ink-muted">Resúmenes · toca una tarjeta para leer</h2>
        </div>

        {resumenes.length === 0 && (
          <div className="mt-6 card border-dashed border-ink-subtle/30 p-8 text-center animate-fade-up opacity-0" style={{ animationDelay: '80ms' }}>
            <p className="text-body text-ink-muted">No hay resúmenes cargados para este tema aún.</p>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {resumenes.map((resumen, i) => {
            const isOpen = expandedId === resumen.id;
            return (
              <button
                key={resumen.id}
                onClick={() => toggle(resumen.id)}
                className={`card w-full p-4 text-left animate-fade-up ${isOpen ? 'border-pgn-500/30 shadow-glow' : ''}`}
                style={{ animationDelay: `${120 + i * 80}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pgn-100 text-pgn-700">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="text-title-1 text-ink">{resumen.titulo}</h3>
                      <p className="mt-0.5 text-footnote text-ink-subtle">
                        {isOpen ? 'Toca para cerrar' : 'Toca para leer el resumen'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`mt-1 shrink-0 text-ink-subtle transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>

                <div
                  className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="rounded-2xl bg-white/60 p-4">
                      <div
                        className="prose prose-sm max-w-none text-body text-ink-muted"
                        dangerouslySetInnerHTML={{ __html: resumen.contenido_html }}
                      />
                      {resumen.fuente_url && (
                        <a
                          href={resumen.fuente_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-4 inline-block text-callout font-medium text-pgn-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Ver fuente
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
