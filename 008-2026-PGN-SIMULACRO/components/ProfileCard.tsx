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
      className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
        selected
          ? 'border-pgn-500 bg-pgn-50 shadow-md'
          : 'border-slate-200 bg-white hover:border-pgn-300 hover:shadow-sm'
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="inline-block rounded-md bg-pgn-100 px-2 py-0.5 text-xs font-bold text-pgn-700">
            {perfil.codigo}
          </span>
          <h3 className="mt-1 text-lg font-bold text-slate-900">{perfil.nombre}</h3>
        </div>
        {selected && <span className="rounded-full bg-pgn-500 px-2 py-0.5 text-xs font-bold text-white">Activo</span>}
      </div>

      <div className="space-y-1.5 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-pgn-500" />
          <span>{perfil.dependencia}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-pgn-500" />
          <span>{perfil.ubicacion}</span>
        </div>
        <div className="flex items-center gap-2">
          <GraduationCap size={14} className="text-pgn-500" />
          <span>{perfil.disciplina}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign size={14} className="text-pgn-500" />
          <span className="font-medium text-slate-900">{perfil.asignacion_basica}</span>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        {perfil.vacantes} {perfil.vacantes === 1 ? 'vacante' : 'vacantes'} · {perfil.convocatoria}
      </div>
    </button>
  );
}

export default ProfileCard;
export { ProfileCard };
