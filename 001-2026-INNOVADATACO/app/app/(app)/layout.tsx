"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/AuthProvider";
import Sidebar from "../components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVerificando(false), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!verificando && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, router, verificando]);

  if (verificando || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        <i className="fas fa-circle-notch fa-spin text-2xl mr-3"></i> Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-6 lg:p-8 page-enter">
        {children}
      </main>
    </div>
  );
}
