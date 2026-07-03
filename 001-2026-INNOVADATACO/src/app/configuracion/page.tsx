"use client";

import { Settings, Shield, Database, Key, Bell, Moon, Save } from "lucide-react";

export default function ConfiguracionPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          <Settings className="w-3 h-3" /> Sistema
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">Configuración</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-neonCyan/10 flex items-center justify-center text-neonCyan">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase">Conexión API</h3>
              <p className="text-[10px] text-[#444] uppercase tracking-widest">NEXT_PUBLIC_API_URL</p>
            </div>
          </div>
          <input 
            defaultValue={process.env.NEXT_PUBLIC_API_URL}
            readOnly
            className="w-full bg-white/5 border border-white/10 p-3 text-xs text-[#666] outline-none"
          />
        </div>

        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-neonCyan/10 flex items-center justify-center text-neonCyan">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase">Seguridad</h3>
              <p className="text-[10px] text-[#444] uppercase tracking-widest">Protocolo DIOS v3.1</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#666]">
            <span>Autenticación de dos factores</span>
            <span className="text-neonCyan">Activo</span>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-neonCyan/10 flex items-center justify-center text-neonCyan">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase">Notificaciones</h3>
              <p className="text-[10px] text-[#444] uppercase tracking-widest">Canales de alerta</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#666]">
            <span>Alertas de presupuesto</span>
            <span className="text-neonCyan">80%</span>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-neonCyan/10 flex items-center justify-center text-neonCyan">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase">Apariencia</h3>
              <p className="text-[10px] text-[#444] uppercase tracking-widest">Tema visual</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#666]">
            <span>Modo oscuro</span>
            <span className="text-neonCyan">Forzado</span>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Key className="w-4 h-4 text-neonCyan" />
          <div>
            <h3 className="text-xs font-bold uppercase">API Keys</h3>
            <p className="text-[10px] text-[#444] uppercase tracking-widest">Gestiona llaves de integración ODIN</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:border-neonCyan transition-colors">
          <Save className="w-3 h-3" /> Guardar
        </button>
      </div>
    </div>
  );
}
