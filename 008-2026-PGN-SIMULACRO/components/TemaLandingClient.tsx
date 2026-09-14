'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/Header';
import { getIcon } from '@/components/icons';
import { Perfil, Tema } from '@/lib/types';
import { getPerfilActivo, getPerfiles, getTemas } from '@/lib/client-data';
import {
  BookOpen,
  Layers,
  Dumbbell,
  Shuffle,
  Target,
  FileText,
  RotateCcw,
  ChevronRight,
  Loader2,
} from 'lucide-react';

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
      <main className="page-shell flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-pgn-600" aria-label="Cargando tema" />
      </main>
    );
  }

  const Icon = getIcon(tema.icono);
  const stats = [
    { label: 'Preguntas', value: counts.preguntas, icon: Target },
    { label: 'Resúmenes', value: counts.resumenes, icon: FileText },
    { label: 'Flashcards', value: counts.flashcards, icon: Layers },
  ];

  return (
    <main className="page-shell">
      <Header perfilCodigo={perfil.codigo} perfilNombre={perfil.nombre} backHref="/home" />
      <section className="px-4 py-6">
        <div className="glass-strong p-5 animate-fade-up opacity-0">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pgn-100 text-pgn-600 shadow-glow">
              <Icon size={32} />
            </div>
            <div className="min-w-0">
              <h1 className="text-headline text-ink">{tema.nombre}</h1>
              <p className="mt-0.5 text-callout text-ink-muted">{tema.eje}</p>
            </div>
          </div>
          <p className="mt-4 text-body text-ink-muted leading-relaxed">{tema.descripcion}</p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 animate-fade-up opacity-0" style={{ animationDelay: '100ms' }}>
          {stats.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <div
                key={stat.label}
                className="glass flex flex-col p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-caption font-medium uppercase text-ink-subtle">
                    {stat.label}
                  </span>
                  <StatIcon size={16} className="text-pgn-600" />
                </div>
                <span className="text-headline text-ink">{stat.value}</span>
              </div>
            );
          })}
        </div>

        <h2 className="section-title mb-4 mt-8 animate-fade-up opacity-0" style={{ animationDelay: '180ms' }}>
          Módulos de estudio
        </h2>
        <div className="space-y-3">
          {menu.map((item, i) => {
            const IconItem = item.icon;
            const href = item.href.startsWith('/') ? item.href : `/tema/${tema.clave}/${item.href}`;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => router.push(href)}
                className="glass flex w-full items-center justify-between p-4 text-left transition-all hover:shadow-glow active:scale-[0.98] animate-fade-up opacity-0"
                style={{ animationDelay: `${240 + i * 80}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pgn-100 text-pgn-600">
                    <IconItem size={20} />
                  </div>
                  <span className="text-body font-medium text-ink">{item.label}</span>
                </div>
                <ChevronRight size={18} className="text-ink-subtle" />
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
