import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const SidebarContext = createContext(undefined);
const STORAGE_KEY = 'cms_sidebar_collapsed';

const getInitialCollapsed = () => {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
        return false;
    }
};

export const SidebarProvider = ({ children }) => {
    const [collapsed, setCollapsed] = useState(getInitialCollapsed);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
        } catch (e) {
            // ignore storage failures (private mode, quota, etc.)
        }
    }, [collapsed]);

    const toggleCollapsed = useCallback(() => {
        setCollapsed(prev => !prev);
    }, []);

    return (
        <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const ctx = useContext(SidebarContext);
    if (!ctx) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return ctx;
};
