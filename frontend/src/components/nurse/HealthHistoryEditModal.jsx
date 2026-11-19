import React, { useEffect, useRef } from 'react';
import { ClipboardList, X } from 'lucide-react';
import HealthConditionsEditor, { useHealthConditions } from '../common/HealthConditionsEditor';
import { useAlert } from '../../context/AlertContext';
import '../../styles/nurse/HealthHistoryEdit.css';

// Nurse edits the student's health history with the same cards as the student's Health History form:
// tick a condition, fill at least one of its fields, attach a proof file (required unless one is already saved).
// onSave(info, files): `files` = [[has_* flag, File], ...] for the ticked conditions.
export default function HealthHistoryEditModal({ initial, savedProofs, saving, onSave, onClose }) {
    const { showAlert } = useAlert();
    const editor = useHealthConditions(initial, { openTicked: true });
    const rootRef = useRef(null);

    useEffect(() => {
        const first = rootRef.current && rootRef.current.querySelector('button');
        if (first) first.focus();
    }, []);

    // Esc closes and Tab stays inside, except while the save confirmation is open on top
    useEffect(() => {
        const root = rootRef.current;
        if (saving) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
            if (e.key !== 'Tab' || !root) return;
            const items = root.querySelectorAll('button:not([disabled]), input:not([disabled]), select, textarea, a[href]');
            if (!items.length) return;
            const head = items[0];
            const tail = items[items.length - 1];
            if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
            else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saving]);

    const submit = async (e) => {
        e.preventDefault();
        const problems = editor.validate();
        if (problems.invalidNames.length) {
            await showAlert(`Complete a field for: ${problems.labels.join(', ')}.`, 'warning');
            const first = rootRef.current && rootRef.current.querySelector('[aria-invalid="true"]');
            if (first) first.focus();
            return;
        }
        const noProof = editor.validateProofs(savedProofs);
        if (noProof.keys.length) {
            await showAlert(`Upload a proof file for: ${noProof.labels.join(', ')}.`, 'warning');
            const first = rootRef.current && rootRef.current.querySelector('input[type="file"][aria-invalid="true"]');
            if (first) first.focus();
            return;
        }
        onSave(editor.info, editor.filesToSend());
    };

    return (
        <div className="hhe-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
            <div className="hhe-modal" role="dialog" aria-modal="true" aria-labelledby="hhe-title" ref={rootRef}>
                <div className="hhe-head">
                    <h2 id="hhe-title"><ClipboardList size={20} aria-hidden="true" /> Edit health history</h2>
                    <button type="button" className="hhe-icon" onClick={onClose} disabled={saving} aria-label="Close" title="Close">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <form onSubmit={submit} noValidate>
                    <div className="hhe-body hh-page">
                        <HealthConditionsEditor editor={editor} savedProofs={savedProofs} idPrefix="hhe-" requireProof />
                    </div>
                    <div className="hhe-foot">
                        <button type="button" className="hhe-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
                        <button type="submit" className="hhe-btn" disabled={saving}>Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
