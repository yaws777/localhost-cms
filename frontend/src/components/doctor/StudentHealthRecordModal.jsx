// StudentHealthRecordModal.jsx
// The student's health records for the doctor (Past Check-up rows): the same health information the nurse sees in
// Health Records > Health tab (HealthInfoView with the latest check-up per service and the latest screening per type).
import React, { useState, useEffect } from 'react';
import { FolderHeart } from 'lucide-react';
import Modal from '../common/Modal';
import HealthInfoView from '../common/HealthInfoView';
import { API } from '../../utils/scheduling';

// The health table stores checkboxes as 1 / 0. Only those columns become true / false (same rule as healthRecordProfile.jsx).
const FLAG_KEY = /^(has_|reaction_(?!others)|blood_disorder_|digestive_(?!medication)|metabolic_|vision_with_)/;

const StudentHealthRecordModal = ({ appt, onClose }) => {
    const [state, setState] = useState({ loading: true, failed: false, info: {}, proofs: {} });
    const studentId = appt?.student_id;

    useEffect(() => {
        if (!studentId) return undefined;
        let live = true;
        setState({ loading: true, failed: false, info: {}, proofs: {} });
        fetch(`${API}/api/profile/${encodeURIComponent(studentId)}`)
            .then((r) => r.json())
            .then((d) => {
                if (!live) return;
                if (!d.success) { setState({ loading: false, failed: true, info: {}, proofs: {} }); return; }
                const health = { ...(d.healthInfo || {}) };
                ['seizure_last_episode_date', 'surgery_date'].forEach((k) => { if (health[k]) health[k] = String(health[k]).split('T')[0]; });
                Object.keys(health).forEach((k) => { if (FLAG_KEY.test(k) && (health[k] === 1 || health[k] === 0)) health[k] = health[k] === 1; });
                setState({ loading: false, failed: false, info: health, proofs: d.healthProofs || {} });
            })
            .catch(() => { if (live) setState({ loading: false, failed: true, info: {}, proofs: {} }); });
        return () => { live = false; };
    }, [studentId]);

    if (!appt) return null;
    const name = appt.student_name || `${appt.student_first_name || ''} ${appt.student_last_name || ''}`.trim();

    return (
        <Modal isOpen onClose={onClose} title={`Health records - ${name}`} icon={<FolderHeart size={20} />} size="xl">
            {state.loading && <p className="dp-hint" role="status">Loading health records...</p>}
            {state.failed && <p className="dp-hint" role="alert">Health records could not be loaded.</p>}
            {!state.loading && !state.failed && (
                <HealthInfoView studentId={studentId} healthInfo={state.info} healthProofs={state.proofs} showCheckups showScreenings={false} />
            )}
        </Modal>
    );
};

export default StudentHealthRecordModal;
