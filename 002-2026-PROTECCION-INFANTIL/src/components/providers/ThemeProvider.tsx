"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
    mounted: boolean;
};

const STORAGE_KEY = "pi-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "light";
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
        if (stored === "dark" || stored === "light") return stored;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
        return "light";
    }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    function applyTheme(next: Theme) {
        const root = document.documentElement;
        if (next === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }

    useEffect(() => {
        const initial = getInitialTheme();
        setThemeState(initial);
        applyTheme(initial);
        setMounted(true);

        const listener = (e: MediaQueryListEvent) => {
            if (typeof window !== "undefined" && !window.localStorage.getItem(STORAGE_KEY)) {
                const next = e.matches ? "dark" : "light";
                setThemeState(next);
                applyTheme(next);
            }
        };

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        media.addEventListener("change", listener);
        return () => media.removeEventListener("change", listener);
    }, []);

    function setTheme(next: Theme) {
        setThemeState(next);
        applyTheme(next);
        try {
            window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // ignore
        }
    }

    function toggleTheme() {
        setTheme(theme === "light" ? "dark" : "light");
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, mounted }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
