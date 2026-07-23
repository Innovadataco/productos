import { Breadcrumb } from "./breadcrumb";

/// Layout compartido del dashboard: la navegación de retorno (breadcrumb + volver) se
/// resuelve AQUÍ una sola vez para todos los submódulos (fix I-14) — nunca página por página.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Breadcrumb />
      {children}
    </>
  );
}
