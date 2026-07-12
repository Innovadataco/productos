import LoginForm from "@/components/modules/LoginForm";

export default function LoginPage() {
    return (
        <main>
            <h1>Protección Infantil</h1>
            <LoginForm />
            <p>
                ¿No tienes cuenta? <a href="/registro">Regístrate</a>
            </p>
        </main>
    );
}