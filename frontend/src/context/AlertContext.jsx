import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import AlertModal from '../components/common/AlertModal';
import ConfirmModal from '../components/common/ConfirmModal';

const AlertContext = createContext(undefined);

/**
 * App-wide replacement for native alert()/window.confirm().
 * Usage:
 *   const { showAlert, showConfirm } = useAlert();
 *   showAlert('Saved successfully.', 'success');
 *   const ok = await showConfirm('Delete this record?', { danger: true });
 */
export const AlertProvider = ({ children }) => {
    const [alertState, setAlertState] = useState({ isOpen: false, message: '', variant: 'info', title: undefined });
    const [confirmState, setConfirmState] = useState({ isOpen: false, message: '', title: undefined, danger: false, confirmLabel: 'Confirm', cancelLabel: 'Cancel' });
    const resolverRef = useRef(null);

    const showAlert = useCallback((message, variant = 'info', options = {}) => {
        setAlertState({ isOpen: true, message, variant, title: options.title });
    }, []);

    const closeAlert = useCallback(() => {
        setAlertState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const showConfirm = useCallback((message, options = {}) => {
        setConfirmState({
            isOpen: true,
            message,
            title: options.title || 'Please Confirm',
            danger: !!options.danger,
            confirmLabel: options.confirmLabel || 'Confirm',
            cancelLabel: options.cancelLabel || 'Cancel',
        });
        return new Promise((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const resolveConfirm = useCallback((result) => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        if (resolverRef.current) {
            resolverRef.current(result);
            resolverRef.current = null;
        }
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert, showConfirm }}>
            {children}

            <AlertModal
                isOpen={alertState.isOpen}
                onClose={closeAlert}
                variant={alertState.variant}
                title={alertState.title}
                message={alertState.message}
            />

            <ConfirmModal
                isOpen={confirmState.isOpen}
                onCancel={() => resolveConfirm(false)}
                onConfirm={() => resolveConfirm(true)}
                title={confirmState.title}
                message={confirmState.message}
                danger={confirmState.danger}
                confirmLabel={confirmState.confirmLabel}
                cancelLabel={confirmState.cancelLabel}
            />
        </AlertContext.Provider>
    );
};

export const useAlert = () => {
    const ctx = useContext(AlertContext);
    if (!ctx) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return ctx;
};
