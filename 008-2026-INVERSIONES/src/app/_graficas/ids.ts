/** Un id de useId que sirve dentro de url(#…) y como id de HTML (React puede usar caracteres que no). */
export const idSeguro = (id: string): string => `g${id.replace(/[^A-Za-z0-9_-]/g, "")}`;
