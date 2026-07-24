"use client";
import ResearchPage from "@/app/research/page";

/**
 * Investigación tiene hoy un único submódulo ("análisis"). Se enruta igual que
 * el resto de tabs en vez de recibir el id y descartarlo (spec 009, FR-003):
 * cuando aparezca un submódulo nuevo, el `switch` ya está.
 */
export default function InvestigacionTab({ submoduleId }: { submoduleId: string }) {
  switch (submoduleId) {
    case "analisis":
    default:
      return <ResearchPage />;
  }
}
