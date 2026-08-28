"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: "system",
    setTheme: () => {},
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("system");

    useEffect(() => {
        try {
            const stored = localStorage.getItem("bi-theme") as Theme | null;
            if (stored) setThemeState(stored);
        } catch {}
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const isDark = theme === "dark" || (theme === "system" && prefersDark);
        root.classList.toggle("dark", isDark);
    }, [theme]);

    function setTheme(t: Theme) {
        setThemeState(t);
        try { localStorage.setItem("bi-theme", t); } catch {}
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
