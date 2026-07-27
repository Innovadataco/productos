import { APP_VERSION, getBuildSha } from "@/lib/version";

/**
 * Sello de versión del panel admin (spec 102): versión + SHA corto del build.
 * Server Component: el SHA se lee en servidor y nunca se expone al cliente público.
 * Si no hay SHA inyectado, muestra solo la versión.
 */
export function AdminVersionBadge() {
    const sha = getBuildSha();
    return (
        <p className="mt-8 text-right text-xs text-subtle">
            Versión {APP_VERSION}
            {sha ? ` · ${sha}` : ""}
        </p>
    );
}
