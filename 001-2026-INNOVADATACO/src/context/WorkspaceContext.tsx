"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export type ModuleId = "investigacion" | "proyectos" | "base" | "configuracion";
export type SubmoduleId = string;

export interface SubmoduleDef {
  id: SubmoduleId;
  title: string;
}

interface WorkspaceContextValue {
  activeModuleId: ModuleId | null;
  activeSubmoduleId: string | null;
  openModule: (moduleId: ModuleId) => void;
  openSubmodule: (moduleId: ModuleId, submoduleId: SubmoduleId) => void;
  closeModule: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);
const MODULE_TITLES: Record<ModuleId, string> = {
  investigacion: "Investigación",
  proyectos: "Proyectos",
  base: "Base Oficial",
  configuracion: "Configuración",
};

export const SUBMODULES: Record<ModuleId, SubmoduleDef[]> = {
  investigacion: [{ id: "analisis", title: "Análisis" }],
  proyectos: [{ id: "listado", title: "Listado" }],
  base: [{ id: "documentos", title: "Documentos" }],
  configuracion: [
    { id: "modelos", title: "Modelos IA" },
    { id: "apis", title: "APIs" },
    { id: "auditoria", title: "Auditoría" },
    { id: "parametrizacion", title: "Parametrización" },
  ],
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeModuleId, setActiveModuleId] = useState<ModuleId | null>(null);
  const [activeSubmoduleId, setActiveSubmoduleId] = useState<string | null>(null);

  const openModule = (moduleId: ModuleId) => {
    const first = SUBMODULES[moduleId][0]?.id || null;
    setActiveModuleId(moduleId);
    setActiveSubmoduleId(first);
  };

  const openSubmodule = (moduleId: ModuleId, submoduleId: SubmoduleId) => {
    setActiveModuleId(moduleId);
    setActiveSubmoduleId(submoduleId);
  };

  const closeModule = () => {
    setActiveModuleId(null);
    setActiveSubmoduleId(null);
  };

  return (
    <WorkspaceContext.Provider value={{ activeModuleId, activeSubmoduleId, openModule, openSubmodule, closeModule }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
};
