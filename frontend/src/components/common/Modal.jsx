import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import '../../styles/common/Modal.css';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Base modal shared by every role/page. Content is scrollable internally
 * so it is never clipped, regardless of how long the body is.
 * Keyboard: Esc closes, Tab/Shift+Tab stay inside the dialog, focus goes to
 * the dialog on open and returns to the opener on close.
 */
const Modal = ({ isOpen, onClose, title, icon, footer, children, closeOnBackdrop = true, size = 'md' }) => {
    const panelRef = useRef(null);
    const onCloseRef = useRef(onClose);
    const titleId = useId();

    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!isOpen) return undefined;
        const panel = panelRef.current;
        const opener = document.activeElement;

        // autoFocus elements already took focus on mount; only move it when nothing inside has it.
        if (panel && !panel.contains(document.activeElement)) {
            (panel.querySelector(FOCUSABLE) || panel).focus();
        }

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onCloseRef.current?.();
                return;
            }
            if (e.key !== 'Tab' || !panel) return;
            const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
            if (items.length === 0) {
                e.preventDefault();
                panel.focus();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (!panel.contains(document.activeElement)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (opener && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="shared-modal-backdrop"
            onClick={closeOnBackdrop ? onClose : undefined}
            role="presentation"
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                className={`shared-modal-panel shared-modal-${size}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
            >
                {(title || onClose) && (
                    <div className="shared-modal-header">
                        <div className="shared-modal-title">
                            {icon && <span className="shared-modal-icon">{icon}</span>}
                            {title && <h2 id={titleId}>{title}</h2>}
                        </div>
                        {onClose && (
                            <button
                                type="button"
                                className="shared-modal-close"
                                onClick={onClose}
                                aria-label="Close"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                )}

                <div className="shared-modal-body">
                    {children}
                </div>

                {footer && (
                    <div className="shared-modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
