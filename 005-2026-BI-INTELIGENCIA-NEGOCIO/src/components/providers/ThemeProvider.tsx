"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (t: Theme) => void;
    toggleTheme: () => void;
    mounted: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
    theme: "light",
    setTheme: () => {},
    toggleTheme: () => {},
    mounted: false,
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        let initial: Theme = "light";
        try {
            const stored = localStorage.getItem("bi-theme") as Theme | null;
            if (stored === "dark" || stored === "light") {
                initial = stored;
            } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                initial = "dark";
            }
        } catch {}
        setThemeState(initial);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        document.documentElement.classList.toggle("dark", theme === "dark");
    }, [theme, mounted]);

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t);
        try { localStorage.setItem("bi-theme", t); } catch {}
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((prev) => {
            const next: Theme = prev === "dark" ? "light" : "dark";
            try { localStorage.setItem("bi-theme", next); } catch {}
            return next;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
            {children}
        </ThemeContext.Provider>
    );
}
