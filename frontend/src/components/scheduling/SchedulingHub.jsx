// SchedulingHub.jsx
// The one check-up scheduling screen. The nurse (every doctor) and the doctor (their own schedule) get the same
// tabs and the same data, so whatever one of them posts, appoints or approves is what the other sees:
//   Calendar | Schedules | Listings | Repeats | Assistant | Chat (nurse <-> doctor)
// The nurse asks a doctor for a schedule; the doctor sets it with a listing limit; the nurse opens its listing; students ask for a place and the
// nurse accepts (the student gets the next queue number of the session) or declines. The tab key stays `waiting`.
// Walk-ins are registered from a session that is running right now (the session card in the calendar), not from here.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ListChecks, Users, Lightbulb, CalendarClock, MessagesSquare, CalendarPlus } from 'lucide-react';
import { DoctorAvailability } from '../nurse/DoctorAvailability';
import UnavailableDates from '../doctor/UnavailableDates';
import { DirectAppointmentModal } from '../doctor/AppointmentModals';
import ScheduleCalendar from './ScheduleCalendar';
import WaitingList from './WaitingList';
import FollowUps from './FollowUps';
import StaffChat from './StaffChat';
import SchedulingAssistant from './SchedulingAssistant';
import { API } from '../../utils/scheduling';
import '../../styles/scheduling/Scheduling.css';

const TABS = [
    ['calendar', 'Calendar', CalendarDays],
    ['schedules', 'Schedules', ListChecks],
    ['waiting', 'Listings', Users],
    ['followups', 'Repeats', CalendarClock],
    ['assistant', 'Assistant', Lightbulb],
    ['chat', 'Chat', MessagesSquare]
];

// role: 'nurse' | 'doctor'. The doctor portal passes fixedDoctorId (their own doctor id).
const SchedulingHub = ({ role, doctors, fixedDoctorId, nurseId, userId, initialTab = 'calendar', onChanged }) => {
    const [tab, setTab] = useState(initialTab);
    const [refreshKey, setRefreshKey] = useState(0);
    const [prefill, setPrefill] = useState(null);
    const [focusSchedule, setFocusSchedule] = useState(null);
    const [counts, setCounts] = useState({ waiting: 0, followups: 0 });
    const [chatUnread, setChatUnread] = useState(0);
    const [showDirect, setShowDirect] = useState(false);

    const creator = useMemo(() => (role === 'doctor' ? { doctorId: fixedDoctorId } : { nurseId }), [role, fixedDoctorId, nurseId]);
    const doctorList = useMemo(() => (fixedDoctorId ? doctors.filter((d) => d.doctor_id === fixedDoctorId) : doctors), [doctors, fixedDoctorId]);

    useEffect(() => { setTab(initialTab); }, [initialTab]);

    // Links such as ?doctor=<id>&new=1 (from the visit forms) land on the schedule form
    const [searchParams] = useSearchParams();
    useEffect(() => {
        if (searchParams.get('new') === '1' && searchParams.get('doctor')) setTab('schedules');
    }, [searchParams]);

    const loadCounts = useCallback(async () => {
        try {
            const doctorQs = fixedDoctorId ? `&doctor_id=${encodeURIComponent(fixedDoctorId)}` : '';
            const [reqRes, fuRes] = await Promise.all([
                fetch(`${API}/api/consultation-requests?status=Waiting%20for%20Approval${doctorQs}`),
                fetch(`${API}/api/follow-ups?state=needs_time${doctorQs}`)
            ]);
            const reqData = await reqRes.json();
            const fuData = await fuRes.json();
            setCounts({
                waiting: reqData.success ? reqData.requests.length : 0,
                followups: fuData.success ? fuData.follow_ups.length : 0
            });
        } catch (e) { /* the badges are a convenience */ }
    }, [fixedDoctorId]);

    useEffect(() => { loadCounts(); }, [loadCounts, refreshKey]);

    // the chat tab badge keeps counting while another tab is open (StaffChat reports it itself while it is open)
    useEffect(() => {
        if (!userId || tab === 'chat') return undefined;
        let live = true;
        const poll = async () => {
            try {
                const res = await fetch(`${API}/api/staff-chat/unread/${encodeURIComponent(userId)}`);
                const data = await res.json();
                if (live && data.success) setChatUnread(data.unreadCount);
            } catch (e) { /* the badge is a convenience */ }
        };
        poll();
        const timer = setInterval(poll, 10000);
        return () => { live = false; clearInterval(timer); };
    }, [userId, tab]);

    // every change refreshes all the tabs and tells the page around the hub (tab numbers, visit lists)
    const changed = useCallback(() => {
        setRefreshKey((k) => k + 1);
        if (onChanged) onChanged();
    }, [onChanged]);

    const goTab = useCallback((next) => setTab(next), []);
    // from a session card / schedule row: opens the listing requests of that session
    const appointFromWaiting = useCallback((scheduleId, date) => { setFocusSchedule({ schedule_id: scheduleId, date }); goTab('waiting'); }, [goTab]);
    const useSuggestion = useCallback((suggestion) => { setPrefill(suggestion); goTab('schedules'); }, [goTab]);
    const prefillUsed = useCallback(() => setPrefill(null), []);
    const focusUsed = useCallback(() => setFocusSchedule(null), []);

    const badgeFor = (key) => (key === 'waiting' ? counts.waiting : key === 'followups' ? counts.followups : key === 'chat' ? chatUnread : 0);

    return (
        <div className="hub-sc">
            <div className="toolbar-hub-sc">
                <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => setShowDirect(true)}><CalendarPlus size={16} /> Direct appointment</button>
            </div>

            <nav className="hub-tabs-sc" aria-label="Scheduling sections">
                {TABS.map(([key, label, Icon]) => (
                    <button key={key} type="button" className={`hub-tab-sc ${tab === key ? 'active-sc' : ''}`} onClick={() => goTab(key)}>
                        <Icon size={16} /> {label}
                        {badgeFor(key) > 0 && <span className="tab-badge-sc">{badgeFor(key)}</span>}
                    </button>
                ))}
            </nav>

            {tab === 'calendar' && (
                <ScheduleCalendar
                    doctors={doctorList} fixedDoctorId={fixedDoctorId} creator={creator} userId={userId} refreshKey={refreshKey}
                    onChanged={changed} onAppointFromWaiting={appointFromWaiting}
                />
            )}

            {tab === 'schedules' && (
                <>
                    <DoctorAvailability
                        doctors={doctorList} creator={creator} userId={userId} refreshKey={refreshKey} onChanged={changed}
                        prefill={prefill} onPrefillUsed={prefillUsed} onAppointFromWaiting={appointFromWaiting} role={role}
                    />
                    <div style={{ marginTop: 18 }}>
                        <UnavailableDates doctors={doctorList} fixedDoctorId={fixedDoctorId} userId={userId} onChanged={changed} />
                    </div>
                </>
            )}

            {tab === 'waiting' && (
                <WaitingList
                    doctors={doctorList} fixedDoctorId={fixedDoctorId} creator={creator} userId={userId} refreshKey={refreshKey}
                    focusSchedule={focusSchedule} onFocusConsumed={focusUsed} onChanged={changed}
                />
            )}

            {tab === 'followups' && (
                <FollowUps doctors={doctorList} fixedDoctorId={fixedDoctorId} creator={creator} userId={userId} refreshKey={refreshKey} onChanged={changed} />
            )}

            {tab === 'assistant' && (
                <SchedulingAssistant fixedDoctorId={fixedDoctorId} refreshKey={refreshKey} onUseSuggestion={useSuggestion} onGoTab={goTab} role={role} />
            )}

            {tab === 'chat' && <StaffChat userId={userId} onUnreadChange={setChatUnread} />}

            <DirectAppointmentModal isOpen={showDirect} doctors={doctorList} fixedDoctorId={fixedDoctorId} creator={creator} userId={userId} onClose={() => setShowDirect(false)} onCreated={changed} />
        </div>
    );
};

export default SchedulingHub;
