"use client";
import ConfiguracionPage from "@/app/configuracion/page";

export default function ConfiguracionTab({ submoduleId }: { submoduleId: string }) {
  return <ConfiguracionPage activeSubmodule={submoduleId} />;
}
