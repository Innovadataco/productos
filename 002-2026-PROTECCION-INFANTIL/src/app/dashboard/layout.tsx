export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <nav>
                <a href="/dashboard">Dashboard</a>
                <a href="/dashboard/configuracion">Configuración</a>
                <form action="/api/auth/logout" method="POST">
                    <button type="submit">Cerrar sesión</button>
                </form>
            </nav>
            <main>{children}</main>
        </div>
    );
}