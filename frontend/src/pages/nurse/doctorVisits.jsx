// doctorVisits.jsx
// Nurse > Doctor Visit. Two sections, the open one is kept in the URL (?section=) so a link or a notification can land on it:
//   Check-up - the Upcoming / On going / Past lists, the same screen the doctor has in /DoctorCheckup
//   Scheduling   - the shared scheduling hub (calendar, schedules, waiting list, repeats, chat)
// Wide layout: the section sits in the main column; from 1180px a side rail shows today's sessions, the new updates and the doctors on duty.
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { CalendarClock, ClipboardList } from 'lucide-react';

import '../../styles/nurse/DoctorVisits.css';
import SchedulingHub from '../../components/scheduling/SchedulingHub';
import ConsultationLists, { CONSULTATION_TABS } from '../../components/scheduling/ConsultationLists';
import TodayRail from '../../components/scheduling/TodayRail';
import { useTodaySessions } from '../../hooks/useTodaySessions';
import { useDpAutoLabels } from '../../utils/autoLabels';
import TabDot, { LiveDot } from '../../components/common/TabDot';
import { useTodayCheckupStatus } from '../../hooks/useTodayCheckupStatus';
import { DOCTOR_VISIT_SECTION_TYPES } from '../../utils/tabNotificationTypes';
import { useTabNotifications } from '../../hooks/useTabNotifications';

const API = 'http://localhost:3001';

// notification types behind the red dot of each section
const SECTION_NOTIFICATION_TYPES = DOCTOR_VISIT_SECTION_TYPES;

const SECTIONS = ['visits', 'availability', 'schedules', 'requests', 'waiting', 'followups', 'chat'];
const HUB_TAB_FOR_SECTION = { availability: 'calendar', schedules: 'schedules', requests: 'waiting', waiting: 'waiting', followups: 'followups', chat: 'chat' };

const DoctorVisit = () => {
    const { nurseId, userId } = useOutletContext() || {};
    useDpAutoLabels();

    const [searchParams, setSearchParams] = useSearchParams();
    const section = SECTIONS.includes(searchParams.get('section')) ? searchParams.get('section') : 'visits';
    const goSection = (name) => setSearchParams(name === 'visits' ? {} : { section: name });

    const [tab, setTab] = useState('upcoming');
    const [doctors, setDoctors] = useState([]);
    const [newUpdates, setNewUpdates] = useState([]);
    const { sessions: todaySessions, reload: reloadToday } = useTodaySessions();

    const loadSummary = useCallback(async () => {
        try {
            const doctorRes = await fetch(`${API}/api/doctors`).then((r) => r.json());
            if (doctorRes.success) setDoctors(doctorRes.doctors);
        } catch (err) {
            console.error('Error loading the doctor visit summary:', err);
        }
    }, []);

    useEffect(() => { loadSummary(); }, [loadSummary]);

    // unread scheduling notifications = new updates (doctor set / changed a schedule, advance listing); a student's place in a listing needs no approval
    const loadUpdates = useCallback(async () => {
        if (!nurseId) return;
        try {
            const data = await fetch(`${API}/api/notifications/nurse/${nurseId}`).then((r) => r.json());
            if (!data.success) return;
            setNewUpdates((data.data || []).filter((n) => {
                const unread = !(n.is_read === 1 || n.is_read === '1' || n.is_read === true);
                const type = (n.type || '').toLowerCase();
                return unread && (type.startsWith('schedule') || type === 'advance_listing');
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

    // red dots: Check-up clears while it is open; Scheduling keeps its dot until each of its own tabs is opened (the hub marks them)
    const { dots } = useTabNotifications({ userId, typeMap: SECTION_NOTIFICATION_TYPES, activeTab: section === 'visits' ? 'visits' : null });

    const todayStatus = useTodayCheckupStatus('all', { enabled: !!nurseId, refreshKey: section });

    const onChanged = () => { loadSummary(); reloadToday(); };

    const dutyDoctors = new Set(todaySessions.map((s) => s.doctor_id || s.doctor_name)).size;
    const todayLabel = new Date().toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="container-dv">
            <div className="header-dv">
                <div>
                    <h2>Doctor Visit Management</h2>
                    <p className="subtitle-dv">{todayLabel} - {dutyDoctors} doctor{dutyDoctors === 1 ? '' : 's'} on duty</p>
                </div>
            </div>

            <nav className="section-nav-dv" aria-label="Doctor visit sections">
                <button type="button" className={`section-tab-dv ${section === 'visits' ? 'active-dv' : ''}`} onClick={() => goSection('visits')}>
                    <ClipboardList size={16} /> Check-up
                    <LiveDot show={todayStatus === 'ongoing'} label="A check-up is on going now" />
                    <TabDot show={section !== 'visits' && dots.visits > 0} label="New in Check-up" />
                </button>
                <button type="button" className={`section-tab-dv ${section !== 'visits' ? 'active-dv' : ''}`} onClick={() => goSection('availability')}>
                    <CalendarClock size={16} /> Scheduling
                    <TabDot show={section === 'visits' && dots.scheduling > 0} label="New in Scheduling" />
                </button>
            </nav>

            <div className="workspace-dv">
                <div className="col-dv">
                    {section !== 'visits' ? (
                        <SchedulingHub
                            role="nurse"
                            doctors={doctors}
                            nurseId={nurseId}
                            userId={userId}
                            initialTab={HUB_TAB_FOR_SECTION[section] || 'calendar'}
                            onChanged={onChanged}
                        />
                    ) : (
                        <ConsultationLists
                            role="nurse"
                            doctors={doctors}
                            nurseId={nurseId}
                            userId={userId}
                            tab={CONSULTATION_TABS.some(([k]) => k === tab) ? tab : 'upcoming'}
                            onTab={setTab}
                            onChanged={onChanged}
                        />
                    )}
                </div>
                <TodayRail sessions={todaySessions} updates={newUpdates} onOpenUpdates={() => goSection('schedules')} />
            </div>
        </div>
    );
};

export default DoctorVisit;
