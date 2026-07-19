import { proxy } from "./lib/proxy";

export { proxy };
export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
        "/reportar",
    ],
};
