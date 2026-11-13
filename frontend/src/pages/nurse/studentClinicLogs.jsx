// studentClinicLogs.jsx
// Nurse view of one student's clinic logs (visits, medicine, incidents, screenings, check-ups): the student's own Clinic Logs screen.
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ClinicLogsAndRecords from '../student/clinicLogs&Records';
import '../../styles/nurse/StudentClinicLogs.css';

export default function StudentClinicLogs() {
    const { studentId } = useParams();
    const navigate = useNavigate();

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
            <ClinicLogsAndRecords studentId={studentId} />
        </div>
    );
}
