"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export type ModuleId = "investigacion" | "proyectos" | "base" | "configuracion";

export interface Tab {
  id: string;
  moduleId: ModuleId;
  title: string;
}

interface WorkspaceContextValue {
  tabs: Tab[];
  activeTabId: string | null;
  openTab: (moduleId: ModuleId) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

const MODULE_TITLES: Record<ModuleId, string> = {
  investigacion: "Investigación",
  proyectos: "Proyectos",
  base: "Base Oficial",
  configuracion: "Configuración",
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTab = (moduleId: ModuleId) => {
    const existing = tabs.find((t) => t.moduleId === moduleId);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const id = `${moduleId}-${Date.now()}`;
    const newTab = { id, moduleId, title: MODULE_TITLES[moduleId] };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const newActive = next[idx - 1] || next[0] || null;
        setActiveTabId(newActive?.id || null);
      }
      return next;
    });
  };

  const activateTab = (id: string) => setActiveTabId(id);

  return (
    <WorkspaceContext.Provider value={{ tabs, activeTabId, openTab, closeTab, activateTab }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
};
