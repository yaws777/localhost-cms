import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import '../../styles/common/Modal.css';

/**
 * Base modal shared by every role/page. Content is scrollable internally
 * so it is never clipped, regardless of how long the body is.
 */
const Modal = ({ isOpen, onClose, title, icon, footer, children, closeOnBackdrop = true, size = 'md' }) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="shared-modal-backdrop"
            onClick={closeOnBackdrop ? onClose : undefined}
            role="presentation"
        >
            <div
                className={`shared-modal-panel shared-modal-${size}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={typeof title === 'string' ? title : undefined}
            >
                {(title || onClose) && (
                    <div className="shared-modal-header">
                        <div className="shared-modal-title">
                            {icon && <span className="shared-modal-icon">{icon}</span>}
                            {title && <h2>{title}</h2>}
                        </div>
                        {onClose && (
                            <button
                                type="button"
                                className="shared-modal-close"
                                onClick={onClose}
                                aria-label="Close"
                            >
                                <X size={20} />
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
