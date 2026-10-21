import React from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';
import Modal from './Modal';

const ICONS = {
    success: <CheckCircle2 size={28} />,
    error: <XCircle size={28} />,
    info: <Info size={28} />,
    warning: <AlertTriangle size={28} />,
};

const TITLES = {
    success: 'Success',
    error: 'Something Went Wrong',
    info: 'Notice',
    warning: 'Warning',
};

/**
 * Single-button alert modal replacing native alert(). Variant drives the
 * icon/color: 'success' | 'error' | 'info' | 'warning'.
 */
const AlertModal = ({ isOpen, onClose, variant = 'info', title, message, okLabel = 'OK' }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title || TITLES[variant]}
            size="sm"
            footer={
                <button type="button" className="shared-btn shared-btn-primary" onClick={onClose} autoFocus>
                    {okLabel}
                </button>
            }
        >
            <div className="shared-alert-body">
                <span className={`shared-icon-wrapper shared-icon-${variant}`}>
                    {ICONS[variant] || ICONS.info}
                </span>
                <p className="shared-alert-message">{message}</p>
            </div>
        </Modal>
    );
};

export default AlertModal;
