'use client';

import { Briefcase, MapPin, GraduationCap, DollarSign } from 'lucide-react';
import { Perfil } from '../lib/types';

interface ProfileCardProps {
  perfil: Perfil;
  selected?: boolean;
  onSelect: (perfil: Perfil) => void;
}

function ProfileCard({ perfil, selected, onSelect }: ProfileCardProps) {
  return (
    <button
      onClick={() => onSelect(perfil)}
      className={`card w-full p-4 text-left animate-fade-up ${
        selected
          ? 'border-pgn-500/40 bg-pgn-50 shadow-glow'
          : 'border-white/70 hover:border-pgn-500/30 hover:shadow-glass-lg'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-lg bg-pgn-100 px-2.5 py-1 text-caption font-bold text-pgn-700">
            {perfil.codigo}
          </span>
          <h3 className="mt-2 text-title-1 font-semibold text-ink">{perfil.nombre}</h3>
        </div>
        {selected && (
          <span className="shrink-0 rounded-full bg-pgn-600 px-3 py-1 text-caption font-bold text-white">
            Activo
          </span>
        )}
      </div>

      <div className="space-y-2 text-body text-ink-muted">
        <div className="flex items-center gap-3">
          <Briefcase size={16} className="text-pgn-600" />
          <span>{perfil.dependencia}</span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin size={16} className="text-pgn-600" />
          <span>{perfil.ubicacion}</span>
        </div>
        <div className="flex items-center gap-3">
          <GraduationCap size={16} className="text-pgn-600" />
          <span>{perfil.disciplina}</span>
        </div>
        <div className="flex items-center gap-3">
          <DollarSign size={16} className="text-pgn-600" />
          <span className="font-semibold text-ink">{perfil.asignacion_basica}</span>
        </div>
      </div>

      <div className="mt-4 text-footnote text-ink-subtle">
        {perfil.vacantes} {perfil.vacantes === 1 ? 'vacante' : 'vacantes'} · {perfil.convocatoria}
      </div>
    </button>
  );
}

export default ProfileCard;
export { ProfileCard };
