'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import StatCard from '@/components/StatCard';
import { getIcon } from '@/components/icons';
import { Perfil, Tema } from '@/lib/types';
import { getPerfilActivo, getPerfiles, getTemas } from '@/lib/client-data';
import { BookOpen, Layers, Dumbbell, Shuffle, Target, FileText, RotateCcw } from 'lucide-react';

const menu = [
  { key: 'resumen', label: 'Resumen', icon: BookOpen, href: 'resumen' },
  { key: 'flashcards', label: 'Flashcards', icon: Layers, href: 'flashcards' },
  { key: 'quiz', label: 'Práctica', icon: Dumbbell, href: 'quiz' },
  { key: 'falladas', label: 'Falladas', icon: RotateCcw, href: 'quiz?modo=falladas' },
  { key: 'simulacro', label: 'Simulacro mixto', icon: Shuffle, href: '/simulacro' },
];

export default function TemaLandingClient() {
  const router = useRouter();
  const params = useParams();
  const temaClave = params.tema as string;

  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [tema, setTema] = useState<Tema | null>(null);
  const [counts, setCounts] = useState({ preguntas: 0, resumenes: 0, flashcards: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const codigo = getPerfilActivo();
    if (!codigo) {
      router.replace('/');
      return;
    }
    Promise.all([getPerfiles(), getTemas()])
      .then(([perfiles, allTemas]) => {
        const p = perfiles.find((x) => x.codigo === codigo);
        const t = allTemas.find((x) => x.perfil_codigo === codigo && x.clave === temaClave);
        if (!p || !t) {
          router.replace('/home');
          return;
        }
        setPerfil(p);
        setTema(t);
      })
      .finally(() => setLoading(false));
  }, [router, temaClave]);

  useEffect(() => {
    if (!tema) return;
    Promise.all([
      fetch('/data/preguntas.json').then((r) => r.json()),
      fetch('/data/resumenes.json').then((r) => r.json()),
      fetch('/data/flashcards.json').then((r) => r.json()),
    ])
      .then(([preguntas, resumenes, flashcards]) => {
        setCounts({
          preguntas: preguntas.filter((q: { tema_id: number }) => q.tema_id === tema.id).length,
          resumenes: resumenes.filter((r: { tema_id: number }) => r.tema_id === tema.id).length,
          flashcards: flashcards.filter((f: { tema_id: number }) => f.tema_id === tema.id).length,
        });
      })
      .catch(() => setCounts({ preguntas: 0, resumenes: 0, flashcards: 0 }));
  }, [tema]);

  if (loading || !perfil || !tema) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Cargando tema...</p>
      </main>
    );
  }

  const Icon = getIcon(tema.icono);

  return (
    <main className="min-h-screen pb-8">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />
      <section className="px-4 py-6">
        <div className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-white ${tema.color}`}>
          <Icon size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{tema.nombre}</h1>
        <p className="mt-1 text-sm text-slate-500">{tema.eje}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{tema.descripcion}</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatCard label="Preguntas" value={counts.preguntas} icon={Target} />
          <StatCard label="Resúmenes" value={counts.resumenes} icon={FileText} />
          <StatCard label="Flashcards" value={counts.flashcards} icon={Layers} />
        </div>

        <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Módulos de estudio</h2>
        <div className="grid grid-cols-1 gap-3">
          {menu.map((item) => {
            const IconItem = item.icon;
            const href = item.href.startsWith('/') ? item.href : `/tema/${tema.clave}/${item.href}`;
            return (
              <button
                key={item.key}
                onClick={() => router.push(href)}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-pgn-300 hover:shadow-md"
              >
                <div className="rounded-lg bg-pgn-50 p-2 text-pgn-600">
                  <IconItem size={22} />
                </div>
                <p className="font-bold text-slate-900">{item.label}</p>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
