// SchedulingHub.jsx
// The one consultation scheduling screen. The nurse (every doctor) and the doctor (their own schedule) get the same
// tabs and the same data, so whatever one of them posts, appoints or approves is what the other sees:
//   Calendar | Schedules | Waiting list | Booking approvals | Assistant
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ListChecks, Users, Inbox, Lightbulb } from 'lucide-react';
import { DoctorAvailability, BookingRequests } from '../nurse/DoctorAvailability';
import UnavailableDates from '../doctor/UnavailableDates';
import ScheduleCalendar from './ScheduleCalendar';
import WaitingList from './WaitingList';
import SchedulingAssistant from './SchedulingAssistant';
import { API } from '../../utils/scheduling';
import '../../styles/scheduling/Scheduling.css';

const TABS = [
    ['calendar', 'Calendar', CalendarDays],
    ['schedules', 'Schedules', ListChecks],
    ['waiting', 'Waiting list', Users],
    ['approvals', 'Booking approvals', Inbox],
    ['assistant', 'Assistant', Lightbulb]
];

// role: 'nurse' | 'doctor'. The doctor portal passes fixedDoctorId (their own doctor id).
const SchedulingHub = ({ role, doctors, fixedDoctorId, nurseId, userId, initialTab = 'calendar', onChanged, onAddDoctor, onEditDoctor }) => {
    const [tab, setTab] = useState(initialTab);
    const [waitingGroup, setWaitingGroup] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [prefill, setPrefill] = useState(null);
    const [focusSchedule, setFocusSchedule] = useState(null);
    const [counts, setCounts] = useState({ review: 0, approvals: 0 });

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
            const [reqRes, bookRes] = await Promise.all([
                fetch(`${API}/api/consultation-requests?status=Waiting%20for%20Approval${doctorQs}`),
                fetch(`${API}/api/doctor-bookings?status=pending${doctorQs}`)
            ]);
            const reqData = await reqRes.json();
            const bookData = await bookRes.json();
            setCounts({
                review: reqData.success ? reqData.requests.length : 0,
                approvals: bookData.success ? bookData.bookings.length : 0
            });
        } catch (e) { /* the badges are a convenience */ }
    }, [fixedDoctorId]);

    useEffect(() => { loadCounts(); }, [loadCounts, refreshKey]);

    // every change refreshes all the tabs and tells the page around the hub (tab numbers, visit lists)
    const changed = useCallback(() => {
        setRefreshKey((k) => k + 1);
        if (onChanged) onChanged();
    }, [onChanged]);

    const goTab = useCallback((next, group = null) => { setTab(next); setWaitingGroup(group); }, []);
    const remind = useCallback((scheduleId, date) => { setFocusSchedule({ schedule_id: scheduleId, date }); goTab('waiting', 'waiting'); }, [goTab]);
    const useSuggestion = useCallback((suggestion) => { setPrefill(suggestion); goTab('schedules'); }, [goTab]);
    const prefillUsed = useCallback(() => setPrefill(null), []);
    const focusUsed = useCallback(() => setFocusSchedule(null), []);

    const badgeFor = (key) => (key === 'waiting' ? counts.review : key === 'approvals' ? counts.approvals : 0);

    return (
        <div className="hub-sc">
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
                    onChanged={changed} onRemind={remind} onGoTab={goTab}
                />
            )}

            {tab === 'schedules' && (
                <>
                    <DoctorAvailability
                        doctors={doctorList} nurseId={nurseId} userId={userId} creatorDoctorId={role === 'doctor' ? fixedDoctorId : undefined}
                        refreshKey={refreshKey} onChanged={changed} onAddDoctor={onAddDoctor} onEditDoctor={onEditDoctor}
                        prefill={prefill} onPrefillUsed={prefillUsed} onRemind={remind}
                    />
                    <div style={{ marginTop: 18 }}>
                        <UnavailableDates doctors={doctorList} fixedDoctorId={fixedDoctorId} userId={userId} onChanged={changed} />
                    </div>
                </>
            )}

            {tab === 'waiting' && (
                <WaitingList
                    doctors={doctorList} fixedDoctorId={fixedDoctorId} creator={creator} userId={userId} refreshKey={refreshKey}
                    initialGroup={waitingGroup} focusSchedule={focusSchedule} onFocusConsumed={focusUsed} onChanged={changed}
                />
            )}

            {tab === 'approvals' && (
                <BookingRequests doctors={doctorList} fixedDoctorId={fixedDoctorId} userId={userId} refreshKey={refreshKey} onChanged={changed} />
            )}

            {tab === 'assistant' && (
                <SchedulingAssistant fixedDoctorId={fixedDoctorId} refreshKey={refreshKey} onUseSuggestion={useSuggestion} onGoTab={goTab} />
            )}
        </div>
    );
};

export default SchedulingHub;
