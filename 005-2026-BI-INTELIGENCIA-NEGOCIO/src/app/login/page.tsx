import { redirect } from "next/navigation";

export default function LoginPage() {
    const piBaseUrl = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";
    redirect(`${piBaseUrl}/login`);
}
