import RegistroForm from "@/components/modules/RegistroForm";

export default function RegistroPage() {
    return (
        <main>
            <h1>Protección Infantil</h1>
            <RegistroForm />
            <p>
                ¿Ya tienes cuenta? <a href="/login">Inicia sesión</a>
            </p>
        </main>
    );
}