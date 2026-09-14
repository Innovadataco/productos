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
      className={`ios-card w-full p-4 text-left transition-all active:scale-[0.98] ${
        selected
          ? 'border border-ios-primary bg-ios-primary-light shadow-ios-lg'
          : 'border border-ios-separator hover:border-ios-primary/40 hover:shadow-ios-lg'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block rounded-ios bg-ios-primary-light px-2.5 py-1 text-ios-caption-1 font-bold text-ios-primary">
            {perfil.codigo}
          </span>
          <h3 className="mt-2 text-ios-title-3 text-ios-label">{perfil.nombre}</h3>
        </div>
        {selected && (
          <span className="shrink-0 rounded-full bg-ios-primary px-3 py-1 text-ios-caption-1 font-bold text-white">
            Activo
          </span>
        )}
      </div>

      <div className="space-y-2 text-ios-body text-ios-label-secondary">
        <div className="flex items-center gap-3">
          <Briefcase size={16} className="text-ios-primary" />
          <span>{perfil.dependencia}</span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin size={16} className="text-ios-primary" />
          <span>{perfil.ubicacion}</span>
        </div>
        <div className="flex items-center gap-3">
          <GraduationCap size={16} className="text-ios-primary" />
          <span>{perfil.disciplina}</span>
        </div>
        <div className="flex items-center gap-3">
          <DollarSign size={16} className="text-ios-primary" />
          <span className="font-semibold text-ios-label">{perfil.asignacion_basica}</span>
        </div>
      </div>

      <div className="mt-4 text-ios-footnote text-ios-label-tertiary">
        {perfil.vacantes} {perfil.vacantes === 1 ? 'vacante' : 'vacantes'} · {perfil.convocatoria}
      </div>
    </button>
  );
}

export default ProfileCard;
export { ProfileCard };
