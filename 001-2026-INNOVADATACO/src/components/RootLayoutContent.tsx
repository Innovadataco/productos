"use client";
// build-cache-invalidate: 2026-07-09T04:39:00
import { useState } from "react";
import { Menu, X, Terminal, LayoutGrid, Database, Settings, Zap, User, Bell, FileText, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace, SUBMODULES, type ModuleId } from "@/context/WorkspaceContext";
import InvestigacionTab from "@/components/modules/InvestigacionTab";
import ProyectosTab from "@/components/modules/ProyectosTab";
import BaseTab from "@/components/modules/BaseTab";
import ConfiguracionTab from "@/components/modules/ConfiguracionTab";
import LicitacionesTab from "@/components/modules/LicitacionesTab";

const MODULES: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: "investigacion", icon: <Terminal size={20} />, label: "Investigación" },
  { id: "proyectos", icon: <LayoutGrid size={20} />, label: "Proyectos" },
  { id: "base", icon: <Database size={20} />, label: ""use client";
// build-cache-invalidate: 2026-07-09T04:3 s// build-cac limport { useState } from "react";
import { Men"import { Menu, X, Terminal, Layolaimport { usePathname, useRouter } from "next/navigation";
import { useWorkspace, SUBMODULES, type ModuleId } from " {import { useWorkspace, SUBMODULES, type ModuleId } from osimport InvestigacionTab from "@/components/modules/InvestigacionTab";
import ProyectsTimport ProyectosTab from "@/components/modules/ProyectosTab";
importilimport BaseTab from "@/components/modules/BaseTab";
import C uimport ConfiguracionTab from "@/components/modulesmoimport LicitacionesTab from "@/components/modules/LicitacionesTab";
 c
const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "investigacion", icon: <Terminal size={20} />, label: "Investigaciti  { id: "proyectos", icon: <LayoutGrid size={20} />, label: "Proyectos" },
  { i    { id: "base", icon: <Database size={20} />, label: ""use client";
// bu/a// build-cache-invalidate: 2026-07-09T04:3 s// build-cac limport { }import { Men"import { Menu, X, Terminal, Layolaimport { usePathname, useRouter } from "nexivimport { useWorkspace, SUBMODULES, type ModuleId } from " {import { useWorkspace, SUBMODULES, type Modu={import ProyectsTimport ProyectosTab from "@/components/modules/ProyectosTab";
importilimport BaseTab from "@/components/modules/BaseTab";
import C uimport ConfiguracionTab from "@/compoetimportilimport BaseTab from "@/components/modules/BaseTab";
import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "investigacion", icon: <Terminal size={20} ] hover:cg-  { i    { id: "base", icon: <Database size={20} />, label: ""use client";
// bu/a// build-cache-invalidate: 2026-07-09T04:3 s// build-cac limport { }import { Men"import { Menu, X, Terminal, Layolaimport { usePathname c// bu/a// build-cache-invalidate: 2026-07-09T04:3 s// build-cac limport {  importilimport BaseTab from "@/components/modules/BaseTab";
import C uimport ConfiguracionTab from "@/compoetimportilimport BaseTab from "@/components/modules/BaseTab";
import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "investigacion", icon:xtimport C uimport ConfiguracionTab from "@/compoetimportili  import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: Modult-const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "in  // bu/a// build-cache-invalidate: 2026-07-09T04:3 s// build-cac limport { }import { Men"import { Menu, X, Terminal, Layolaimport { usePathname c// bu/a// build-cache-invalidate: 2026-07-09T04:3 s// build  import C uimport ConfiguracionTab from "@/compoetimportilimport BaseTab from "@/components/modules/BaseTab";
import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "investigac="import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "in  // bu/a// build-cache-invalidate: 2026-07-09T04:3 s// build-cac limport { }import { Men"import { Menu, X, Terminal, Layolaimport {e import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "investigac="import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: ModuleId; ic Oconst MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inemconst MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: ModuleId; flconst MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "investigac="import C uimportfoimport C uimport ConfiguracionTab from "@/components/moduln  c
const MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: ModuleId; ic Oconst MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inemconsULESconst MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: ModuleId; enconst MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: ModuleId; ic Oconst MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inemconsULESconst MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: ModuleId; enconst MODULES: { id: Moduly const MODULES: { id: ModuleId; icon: React.ReactNode; label: strinst  { id: "inivconst MODULES: { id: Modult-const MODULES: { id: Mo              >
                  <span>{sub.title}</span>
                </button>
              ))}
            </div>
            <button
              onClick={closeModule}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-red-400 transition-colors"
            >
              <X size={12} className="inline mr-1" /> Cerrar
            </button>
          </div>
        )}

        <main className="p-12 max-w-7xl mx-auto">
          {ActiveComponent ? <ActiveComponent submoduleId={activeSubmoduleId!} /> : children ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-white/20 gap-4">
              <LayoutGrid size={48} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Selecciona un módulo del sidebar</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
