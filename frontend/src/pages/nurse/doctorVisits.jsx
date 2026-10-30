// doctorVisits.jsx
// Nurse > Doctor Visit. Two sections, the open one is kept in the URL (?section=) so a link or a notification can land on it:
//   Check-up - the Upcoming / On going / Past lists, the same screen the doctor has in /DoctorCheckup
//   Scheduling   - the shared scheduling hub (calendar, schedules, waiting list, repeats, chat)
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { CalendarClock, ClipboardList } from 'lucide-react';

import '../../styles/nurse/DoctorVisits.css';
import SchedulingHub from '../../components/scheduling/SchedulingHub';
import ConsultationLists, { CONSULTATION_TABS } from '../../components/scheduling/ConsultationLists';
import { useDpAutoLabels } from '../../utils/autoLabels';

const API = 'http://localhost:3001';

const SECTIONS = ['visits', 'availability', 'requests', 'waiting', 'followups', 'chat'];
const HUB_TAB_FOR_SECTION = { availability: 'calendar', requests: 'waiting', waiting: 'waiting', followups: 'followups', chat: 'chat' };

const DoctorVisit = () => {
    const { nurseId, userId } = useOutletContext() || {};
    useDpAutoLabels();

    const [searchParams, setSearchParams] = useSearchParams();
    const section = SECTIONS.includes(searchParams.get('section')) ? searchParams.get('section') : 'visits';
    const goSection = (name) => setSearchParams(name === 'visits' ? {} : { section: name });

    const [tab, setTab] = useState('upcoming');
    const [doctors, setDoctors] = useState([]);
    const [doctorsWithoutSchedule, setDoctorsWithoutSchedule] = useState(0);

    // the doctors, and which doctors have no open schedule (no student can be appointed to them)
    const loadSummary = useCallback(async () => {
        try {
            const [doctorRes, scheduleRes] = await Promise.all([
                fetch(`${API}/api/doctors`).then((r) => r.json()),
                fetch(`${API}/api/doctor-schedules?status=Open`).then((r) => r.json())
            ]);
            if (doctorRes.success) {
                setDoctors(doctorRes.doctors);
                if (scheduleRes.success) {
                    const withSchedule = new Set(scheduleRes.schedules.filter((s) => !s.is_expired).map((s) => s.doctor_id));
                    setDoctorsWithoutSchedule(doctorRes.doctors.filter((d) => !withSchedule.has(d.doctor_id)).length);
                }
            }
        } catch (err) {
            console.error('Error loading the doctor visit summary:', err);
        }
    }, []);

    useEffect(() => { loadSummary(); }, [loadSummary]);

    return (
        <div className="container-dv">
            <div className="header-dv">
                <div>
                    <h2>Doctor Visit Management</h2>
                    <p className="subtitle-dv">Schedule, track, and document student doctor visits, and set when each doctor is available.</p>
                </div>
            </div>

            <nav className="section-nav-dv" aria-label="Doctor visit sections">
                <button type="button" className={`section-tab-dv ${section === 'visits' ? 'active-dv' : ''}`} onClick={() => goSection('visits')}>
                    <ClipboardList size={16} /> Check-up
                </button>
                <button type="button" className={`section-tab-dv ${section !== 'visits' ? 'active-dv' : ''}`} onClick={() => goSection('availability')}>
                    <CalendarClock size={16} /> Scheduling
                    {doctorsWithoutSchedule > 0 && (
                        <span className="section-badge-dv warn-dv" title={`${doctorsWithoutSchedule} doctor(s) have no open schedule, so no student can be appointed to them`}>{doctorsWithoutSchedule}</span>
                    )}
                </button>
            </nav>

            {section !== 'visits' ? (
                <SchedulingHub
                    role="nurse"
                    doctors={doctors}
                    nurseId={nurseId}
                    userId={userId}
                    initialTab={HUB_TAB_FOR_SECTION[section] || 'calendar'}
                    onChanged={loadSummary}
                />
            ) : (
                <>
                    <ConsultationLists
                        role="nurse"
                        doctors={doctors}
                        nurseId={nurseId}
                        userId={userId}
                        tab={CONSULTATION_TABS.some(([k]) => k === tab) ? tab : 'upcoming'}
                        onTab={setTab}
                        onChanged={loadSummary}
                    />
                </>
            )}
        </div>
    );
};

export default DoctorVisit;
