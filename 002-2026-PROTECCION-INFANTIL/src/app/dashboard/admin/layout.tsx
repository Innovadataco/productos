import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminNav } from "@/components/modules/AdminNav";

const ADMIN_ROLES = new Set(["ADMIN", "SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION"]);
type AdminRol = "ADMIN" | "SCHOOL_ADMIN" | "OPERADOR" | "COMITE_VALIDACION";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    const rol = payload?.rol as string | undefined;
    if (!rol || !ADMIN_ROLES.has(rol)) {
        redirect("/");
    }

    return (
        <div className="flex min-h-screen">
            <AdminNav rol={rol as AdminRol} />
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
    );
}
