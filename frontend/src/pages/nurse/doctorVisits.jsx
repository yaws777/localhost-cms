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
    const [newUpdates, setNewUpdates] = useState([]);

    const loadSummary = useCallback(async () => {
        try {
            const doctorRes = await fetch(`${API}/api/doctors`).then((r) => r.json());
            if (doctorRes.success) setDoctors(doctorRes.doctors);
        } catch (err) {
            console.error('Error loading the doctor visit summary:', err);
        }
    }, []);

    useEffect(() => { loadSummary(); }, [loadSummary]);

    // unread scheduling notifications = new updates (doctor set / changed a schedule, a student asked a place or reconfirmed)
    const loadUpdates = useCallback(async () => {
        if (!nurseId) return;
        try {
            const data = await fetch(`${API}/api/notifications/nurse/${nurseId}`).then((r) => r.json());
            if (!data.success) return;
            setNewUpdates((data.data || []).filter((n) => {
                const unread = !(n.is_read === 1 || n.is_read === '1' || n.is_read === true);
                const type = (n.type || '').toLowerCase();
                return unread && (type.startsWith('schedule') || type === 'consultation_request' || type === 'consultation_reconfirmed');
            }));
        } catch (err) {
            console.error('Error loading scheduling updates:', err);
        }
    }, [nurseId]);

    useEffect(() => {
        loadUpdates();
        const timer = setInterval(loadUpdates, 10000);
        return () => clearInterval(timer);
    }, [loadUpdates]);

    // opening Scheduling = the updates were seen
    useEffect(() => {
        if (section === 'visits' || newUpdates.length === 0) return;
        const seen = newUpdates;
        setNewUpdates([]);
        Promise.all(seen.map((n) => fetch(`${API}/api/notifications/${n.notification_id}/read`, { method: 'PATCH' }).catch(() => null)));
    }, [section, newUpdates]);

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
                    {newUpdates.length > 0 && (
                        <span className="section-badge-dv warn-dv" role="status" aria-label={`${newUpdates.length} new scheduling update${newUpdates.length === 1 ? '' : 's'}`} title={`${newUpdates.length} new scheduling update${newUpdates.length === 1 ? '' : 's'}`}>{newUpdates.length}</span>
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
