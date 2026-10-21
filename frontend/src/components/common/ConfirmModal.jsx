import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import Modal from './Modal';

/**
 * Two-button confirmation modal replacing native window.confirm().
 * danger=true styles the confirm button red for destructive actions.
 */
const ConfirmModal = ({
    isOpen,
    onCancel,
    onConfirm,
    title = 'Please Confirm',
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
}) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={title}
            size="sm"
            footer={
                <>
                    <button type="button" className="shared-btn shared-btn-secondary" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`shared-btn ${danger ? 'shared-btn-danger' : 'shared-btn-primary'}`}
                        onClick={onConfirm}
                        autoFocus
                    >
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <div className="shared-alert-body">
                <span className={`shared-icon-wrapper ${danger ? 'shared-icon-warning' : 'shared-icon-info'}`}>
                    {danger ? <AlertTriangle size={28} /> : <HelpCircle size={28} />}
                </span>
                <p className="shared-alert-message">{message}</p>
            </div>
        </Modal>
    );
};

export default ConfirmModal;
