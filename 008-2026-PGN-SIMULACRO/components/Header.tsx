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
    <header className="ios-nav-blur">
      <div className="ios-content flex h-14 items-center justify-between">
        <div className="flex flex-col">
          <span className="text-ios-subhead font-semibold text-ios-primary">PGN Estudio</span>
          {codigo && <span className="text-ios-caption-2 text-ios-label-tertiary">CONV-{codigo}</span>}
        </div>
        <div className="flex items-center gap-1">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex h-11 items-center justify-center rounded-ios-lg px-3 text-ios-subhead font-medium text-ios-primary transition-colors active:bg-ios-gray-6"
            >
              Volver
            </Link>
          )}
          {nombre && (
            <div className="flex h-11 items-center gap-1.5 rounded-full bg-ios-primary-light px-3">
              <User size={16} className="text-ios-primary" />
              <span className="text-ios-subhead font-semibold text-ios-primary">{nombre}</span>
            </div>
          )}
          {onCambiarPerfil && (
            <button
              onClick={onCambiarPerfil}
              className="inline-flex h-11 items-center justify-center rounded-ios-lg px-3 text-ios-subhead font-medium text-ios-label-secondary transition-colors active:bg-ios-gray-6"
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
