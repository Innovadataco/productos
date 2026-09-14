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
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-pgn-700">PGN Estudio</span>
          {codigo && <span className="text-xs text-slate-500">CONV-{codigo}</span>}
        </div>
        <div className="flex items-center gap-2">
          {backHref && (
            <Link href={backHref} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">
              Volver
            </Link>
          )}
          {nombre && (
            <div className="flex items-center gap-1.5 rounded-full bg-pgn-50 px-2.5 py-1">
              <User size={14} className="text-pgn-600" />
              <span className="text-xs font-medium text-pgn-700">{nombre}</span>
            </div>
          )}
          {onCambiarPerfil && (
            <button
              onClick={onCambiarPerfil}
              className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
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
