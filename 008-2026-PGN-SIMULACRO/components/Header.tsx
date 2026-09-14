'use client';

import { User } from 'lucide-react';
import Link from 'next/link';
import type { Perfil } from '@/lib/types';

interface HeaderProps {
  perfilCodigo?: string;
  perfilNombre?: string;
  perfil?: Perfil | null;
  onCambiarPerfil?: () => void;
  backHref?: string;
}

function Header({ perfilCodigo, perfilNombre, perfil, onCambiarPerfil, backHref }: HeaderProps) {
  const codigo = perfil?.codigo ?? perfilCodigo ?? '';
  const nombre = perfil?.nombre ?? perfilNombre ?? '';

  return (
    <header className="nav-blur animate-fade-in">
      <div className="mx-auto flex h-14 max-w-mobile items-center justify-between px-4">
        <div className="flex flex-col">
          <span className="text-title-2 font-bold text-ink">PGN Estudio</span>
          {codigo && <span className="text-caption text-ink-subtle">CONV-{codigo}</span>}
        </div>
        <div className="flex items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              className="btn-secondary h-11 px-3 rounded-xl"
            >
              Volver
            </Link>
          )}
          {nombre && (
            <div className="glass flex h-11 items-center gap-1.5 rounded-full px-3">
              <User size={16} className="text-pgn-600" />
              <span className="text-callout font-semibold text-pgn-700">{nombre}</span>
            </div>
          )}
          {onCambiarPerfil && (
            <button
              onClick={onCambiarPerfil}
              className="btn-secondary h-11 px-3 rounded-xl"
            >
              Cambiar
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
export { Header };
