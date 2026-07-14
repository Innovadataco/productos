import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { AdminNav } from "@/components/modules/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
        redirect("/login");
    }

    const payload = await verifyToken(token);
    if (!payload || payload.rol !== "ADMIN") {
        redirect("/");
    }

    return (
        <div className="flex min-h-screen bg-slate-50">
            <AdminNav />
            <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
    );
}
