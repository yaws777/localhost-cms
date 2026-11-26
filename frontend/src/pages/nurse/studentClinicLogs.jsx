// studentClinicLogs.jsx
// Nurse view of one student's clinic logs (visits, medicine, incidents, screenings, check-ups): the student's own Clinic Logs screen,
// under a profile card with the student's health alerts.
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import ClinicLogsAndRecords from '../student/clinicLogs&Records';
import '../../styles/nurse/StudentClinicLogs.css';

const API_BASE = 'https://localhost-cms.onrender.com';

// health_information flag -> short alert label
const ALERTS = [
    ['has_allergies', 'Allergies'],
    ['has_asthma', 'Asthma'],
    ['has_heart_problems', 'Heart'],
    ['has_seizure_episode', 'Seizures'],
    ['has_blood_disorders', 'Blood disorder'],
    ['has_metabolic_diseases', 'Metabolic'],
    ['has_kidney_bladder_problems', 'Kidney / bladder'],
    ['has_vision_problem', 'Vision'],
    ['has_hearing_problem', 'Hearing']
];

export default function StudentClinicLogs() {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [student, setStudent] = useState(null);
    const [alerts, setAlerts] = useState([]);

    useEffect(() => {
        let alive = true;
        setStudent(null);
        setAlerts([]);
        const load = async () => {
            try {
                const [listRes, profileRes] = await Promise.all([
                    fetch(`${API_BASE}/api/health-records/students?search=${encodeURIComponent(studentId)}`),
                    fetch(`${API_BASE}/api/profile/${encodeURIComponent(studentId)}`)
                ]);
                const list = await listRes.json();
                const profile = await profileRes.json();
                if (!alive) return;
                const found = (list.students || []).find((s) => s.student_id === studentId);
                setStudent(found || null);
                const h = profile.success ? profile.healthInfo : null;
                setAlerts(h ? ALERTS.filter(([key]) => h[key] === 1 || h[key] === true).map(([, label]) => label) : []);
            } catch (err) {
                console.error('Error loading student profile card:', err);
            }
        };
        load();
        return () => { alive = false; };
    }, [studentId]);

    const initials = student ? `${(student.first_name || '').charAt(0)}${(student.last_name || '').charAt(0)}` : '';

    return (
        <div className="page-scl">
            <button
                type="button"
                className="btn-back-scl"
                onClick={() => navigate('/HealthRecords')}
                aria-label="Back to health records"
                title="Back to health records"
            >
                <ArrowLeft size={20} aria-hidden="true" />
            </button>

            <ClinicLogsAndRecords
                studentId={studentId}
                afterHeader={student && (
                <section className="profile-scl" aria-label="Student">
                    <span className="avatar-scl" aria-hidden="true">{initials}</span>
                    <div className="id-scl">
                        <h2>{student.last_name}, {student.first_name}</h2>
                        <div className="meta-scl">
                            <span className="badge-scl">{student.program_id}</span>
                            <span className="mono-scl">{student.student_id}</span>
                            <span>{student.year_level ? `Year ${student.year_level}` : 'N/A'} / {student.section || 'N/A'}</span>
                        </div>
                    </div>
                    {alerts.length > 0 && (
                        <div className="alerts-scl">
                            <span className="alerts-label-scl"><AlertTriangle size={16} aria-hidden="true" />Health alerts</span>
                            <span className="alerts-list-scl">
                                {alerts.map((a) => <span key={a} className="alert-scl">{a}</span>)}
                            </span>
                        </div>
                    )}
                </section>
                )}
            />
        </div>
    );
}
