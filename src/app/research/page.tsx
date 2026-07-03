"use client";

import { useState } from "react";
import { Upload, FileText, Search, Zap, Loader2, Sparkles, AlertCircle, Trash2, Database } from "lucide-react";

interface AnalysisResult {
  summary: string;
  milestones: string[];
  risks: string[];
  recommendations: string[];
}

export default function ResearchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const runAnalysis = async () => {
    if (!file) return;
    setAnalyzing(true);
    // Simulación de orquestación de Agente Odin procesando archivo local
    setTimeout(() => {
      setResult({
        summary: `Análisis técnico completado para "${file.name}". Se identifican patrones críticos de infraestructura y cumplimiento metodológico PM².`,
        milestones: [
          "Definición de arquitectura trauma-zero validada.",
          "Esquema de datos centralizado en Mac Studio listo.",
          "Protocolo de seguridad DIOS v3.1 inyectado."
        ],
        risks: [
          "Posible latencia en sincronización de contenedores si el volumen de datos excede 2TB.",
          "Necesidad de auditoría de llaves maestras en el próximo ciclo."
        ],
        recommendations: [
          "Proceder con la automatización de backups vía cronjob.",
          "Vincular este activo al tablero financiero de Sincelejo."
        ]
      });
      setAnalyzing(false);
    }, 2500);
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Module Title Section */}
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Laboratorio de <span className="neon-glow italic">Investigación IA</span></h2>
        <p className="text-foreground/30 text-[11px] uppercase tracking-widest font-black">Módulo de Extracción de Inteligencia Operativa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Upload Area (4 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className={`glass-panel rounded-2xl p-8 flex flex-col items-center justify-center border-dashed border-2 transition-all duration-500 relative overflow-hidden ${file ? 'border-neonCyan/40 bg-neonCyan/[0.02]' : 'border-white/5 hover:border-neonCyan/20'}`}>
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              onChange={handleFileChange}
              accept=".pdf,.txt,.docx"
            />
            
            {file ? (
              <div className="flex flex-col items-center gap-4 text-center z-10">
                <div className="p-4 rounded-full bg-neonCyan/10 text-neonCyan shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                  <FileText size={32} />
                </div>
                <div>
                  <p className="font-bold text-sm truncate max-w-[220px]">{file.name}</p>
                  <p className="text-[10px] text-neonCyan font-bold uppercase tracking-widest mt-1">Archivo Cargado</p>
                </div>
                <button 
                  onClick={() => {setFile(null); setResult(null);}}
                  className="flex items-center gap-2 text-[10px] font-bold text-foreground/20 hover:text-red-400 transition-colors uppercase tracking-widest"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            ) : (
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-4 text-center z-10 group">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-foreground/20 group-hover:text-neonCyan group-hover:bg-neonCyan/10 transition-all">
                  <Upload size={24} />
                </div>
                <div>
                  <p className="font-bold text-sm">Carga Documental</p>
                  <p className="text-[10px] text-foreground/20 mt-1 uppercase tracking-tighter">PDF, TXT, DOCX // MÁX 10MB</p>
                </div>
              </label>
            )}
            
            {/* Ambient Background Light */}
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-neonCyan/5 blur-[50px] pointer-events-none" />
          </div>

          <button 
            disabled={!file || analyzing}
            onClick={runAnalysis}
            className={`w-full py-4 rounded-xl font-black tracking-widest uppercase text-[10px] flex items-center justify-center gap-3 transition-all ${
              !file || analyzing 
                ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5' 
                : 'bg-neonCyan text-black hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] border-none'
            }`}
          >
            {analyzing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Procesando en Mac Studio...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Ejecutar Odin Analysis
              </>
            )}
          </button>

          <div className="glass-panel p-4 rounded-xl flex items-center gap-4 opacity-50">
             <div className="p-2 rounded bg-white/5"><Database size={14} /></div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest">Almacenamiento Local</span>
                <span className="text-[10px]">Soberanía de Datos Active</span>
             </div>
          </div>
        </div>

        {/* RIGHT: Intelligence Canvas (7 cols) */}
        <div className="lg:col-span-12 xl:col-span-7 glass-panel rounded-2xl min-h-[480px] flex flex-col relative overflow-hidden">
          {!result && !analyzing && (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 opacity-10">
              <Search size={64} />
              <p className="text-sm font-bold uppercase tracking-[0.3em]">Esperando Datos de Entrada</p>
            </div>
          )}

          {analyzing && (
            <div className="p-8 flex flex-col gap-8 h-full">
               <div className="space-y-3">
                  <div className="h-2 w-24 bg-neonCyan/20 rounded animate-pulse" />
                  <div className="h-6 w-full bg-white/5 rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-white/5 rounded animate-pulse" />
               </div>
               <div className="space-y-4 mt-8">
                  <div className="h-32 w-full bg-white/5 rounded animate-pulse" />
                  <div className="h-24 w-full bg-white/5 rounded animate-pulse" />
               </div>
            </div>
          )}

          {result && (
            <div className="p-8 flex flex-col gap-10 animate-in zoom-in-95 duration-500">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-neonCyan rounded-full" />
                  <span className="text-[10px] font-black text-neonCyan tracking-widest uppercase">Síntesis Inteligente Odin</span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80 font-medium">{result.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex flex-col gap-4">
                  <span className="text-[9px] font-black text-foreground/30 tracking-[0.2em] uppercase border-b border-white/5 pb-2">Hitos Clave</span>
                  <div className="flex flex-col gap-3">
                    {result.milestones.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 text-[11px] leading-snug">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full bg-neonCyan shadow-[0_0_5px_#00f0ff]" />
                        {m}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <span className="text-[9px] font-black text-amber-500/50 tracking-[0.2em] uppercase border-b border-white/5 pb-2">Mapa de Riesgos</span>
                  <div className="flex flex-col gap-3">
                    {result.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 text-[11px] leading-snug text-amber-200/60 font-geist-mono">
                        <AlertCircle size={14} className="text-amber-500 shrink-0" />
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 p-5 rounded-xl bg-neonCyan/5 border border-neonCyan/10">
                <span className="text-[9px] font-black text-neonCyan tracking-widest uppercase">Recomendaciones Estratégicas</span>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-[11px] list-disc ml-4 text-foreground/70">{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
             <Zap size={120} className="text-neonCyan" />
          </div>
        </div>
      </div>
    </div>
  );
}
