import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(undefined);
const STORAGE_KEY = 'cms_theme';

const getInitialTheme = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') return stored;
    } catch (e) {
        // localStorage unavailable; fall through to default
    }
    return 'light';
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(getInitialTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // ignore storage failures (private mode, quota, etc.)
        }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return ctx;
};
