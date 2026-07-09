export default function Home() {
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
      <h1 className="text-6xl font-bold tracking-tighter uppercase leading-none">
        Plataforma <br />
        <span className="text-neonCyan italic font-light drop-shadow-[0_0_15px_#00f0ff]">Innovadataco.</span>
      </h1>
      <p className="max-w-md text-white/40 text-sm leading-relaxed mt-4">
        Infraestructura de inteligencia para la gestión de activos y soberanía de datos operativa.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
        <a href="/research" className="group p-8 rounded-2xl bg-white/5 border border-white/5 h-56 flex flex-col justify-between hover:border-neonCyan/30 transition-all">
          <div>
            <span className="text-neonCyan/50 text-[9px] font-black tracking-widest uppercase">Deep Search</span>
            <h3 className="text-xl font-bold tracking-tight uppercase mt-2">Investigación</h3>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-white/5 text-[9px] font-bold uppercase tracking-widest text-white/40 group-hover:text-neonCyan transition-colors">
            <span>Ver Módulo</span><span>→</span>
          </div>
        </a>
        
        <a href="/licitaciones" className="group p-8 rounded-2xl bg-white/5 border border-white/5 h-56 flex flex-col justify-between hover:border-neonCyan/30 transition-all">
          <div>
            <span className="text-neonCyan/50 text-[9px] font-black tracking-widest uppercase">Contracting</span>
            <h3 className="text-xl font-bold tracking-tight uppercase mt-2">Licitaciones</h3>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-white/5 text-[9px] font-bold uppercase tracking-widest text-white/40 group-hover:text-neonCyan transition-colors">
            <span>Ver Módulo</span><span>→</span>
          </div>
        </a>
        
        <div className="p-8 rounded-2xl bg-white/5 border border-white/5 h-56 flex flex-col justify-between opacity-30">
          <div>
            <span className="text-white/20 text-[9px] font-black tracking-widest uppercase">Operations</span>
            <h3 className="text-xl font-bold tracking-tight uppercase mt-2">Proyectos</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
