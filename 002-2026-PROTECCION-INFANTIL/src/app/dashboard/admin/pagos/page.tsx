import { redirect } from "next/navigation";

export default function PagosIndexPage() {
    redirect("/dashboard/admin/pagos/pendientes");
}
