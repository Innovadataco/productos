import { TrendingUp, DollarSign, AlertCircle, PieChart, ArrowUpRight, Database } from "lucide-react";

async function getFinancials() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/pm2_financials?select=*,proyectos(nombre,codigo)`, { 
      cache: 'no-store' 
    });
    if (!res.ok) throw new Error('Innovadataco link failed');
    return res.json();
  } catch (error) {
    console.error("Fin Error:", error);
    return [];
  }
}

export default async function FinancialsPage() {
  const data = await getFinancials();
  
  const totalBudget = data.reduce((acc: number, curr: any) => acc + Number(curr.budget), 0);
  const totalActual = data.reduce((acc: number, curr: any) => acc + Number(curr.actual_cost), 0);
  const burnRate = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonAmber text-[10px] font-bold uppercase tracking-[0.3em]">
          <TrendingUp className="w-3 h-3" /> Control Económico Innovadataco
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">Seguimiento Financiero</h1>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-6 space-y-2 border-l-2 border-l-neonCyan">
          <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Presupuesto Maestro</p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black font-geist-mono">${totalBudget.toLocaleString()}</h2>
            <DollarSign className="w-4 h-4 text-neonCyan" />
          </div>
        </div>
        <div className="glass-panel p-6 space-y-2 border-l-2 border-l-neonAmber">
          <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Gasto Ejecutado</p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black font-geist-mono">${totalActual.toLocaleString()}</h2>
            <div className={`flex items-center text-[10px] ${burnRate > 90 ? 'text-red-500' : 'text-neonAmber'}`}>
               {burnRate.toFixed(1)}% <ArrowUpRight className="w-3 h-3" />
            </div>
          </div>
        </div>
        <div className="glass-panel p-6 space-y-2 border-l-2 border-l-white/20">
          <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">Margen Proyectado</p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black font-geist-mono">${(totalBudget - totalActual).toLocaleString()}</h2>
            <PieChart className="w-4 h-4 text-[#444]" />
          </div>
        </div>
      </div>

      {/* Project Breakdown */}
      <div className="space-y-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#666]">Desglose por Iniciativa</h3>
        <div className="grid grid-cols-1 gap-2">
          {data.map((f: any) => {
            const pBurn = (Number(f.actual_cost) / Number(f.budget)) * 100;
            return (
              <div key={f.id} className="glass-panel p-4 flex flex-col md:flex-row items-center justify-between gap-4 group hover:border-neonAmber/30 transition-all">
                <div className="flex items-center gap-4 w-full md:w-1/3">
                  <div className="h-8 w-8 rounded bg-white/5 flex items-center justify-center text-neonAmber">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase truncate">{f.proyectos?.nombre || 'Indefinido'}</h4>
                    <p className="text-[9px] font-geist-mono text-[#444]">{f.proyectos?.codigo}</p>
                  </div>
                </div>

                <div className="flex-1 w-full flex items-center gap-4 px-4">
                  <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${pBurn > 90 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-neonAmber shadow-[0_0_10px_rgba(255,184,0,0.5)]'}`}
                      style={{ width: `${Math.min(pBurn, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-geist-mono text-neonAmber w-10 text-right">{Math.round(pBurn)}%</span>
                </div>

                <div className="flex items-center gap-8 w-full md:w-auto justify-end">
                   <div className="text-right">
                      <p className="text-[8px] text-[#444] font-black uppercase italic">Actual</p>
                      <p className="text-xs font-bold font-geist-mono">${Number(f.actual_cost).toLocaleString()}</p>
                   </div>
                   <div className="h-4 w-[1px] bg-white/10" />
                   <div className="text-right">
                      <p className="text-[8px] text-[#444] font-black uppercase">Presupuesto</p>
                      <p className="text-xs font-bold font-geist-mono text-[#888]">${Number(f.budget).toLocaleString()}</p>
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {burnRate > 80 && (
        <div className="glass-panel border-neonAmber/50 bg-neonAmber/5 p-4 flex items-center gap-3 animate-pulse">
          <AlertCircle className="w-4 h-4 text-neonAmber" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-neonAmber">
             Aviso de Riesgo: El consumo del presupuesto maestro ha superado el umbral del 80%.
          </p>
        </div>
      )}
    </div>
  );
}
