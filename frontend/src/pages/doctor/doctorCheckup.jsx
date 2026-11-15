// doctorCheckup.jsx
// The doctor's check-ups: Upcoming, On going and Past (past ones in a folder for each day). The lists are the same screen the nurse
// sees in Doctor Visit > Check-up (components/scheduling/ConsultationLists.jsx), so the queue works the same way: the doctor calls the
// numbers (Call next), skips or voids a called number that has not timed in, calls a skipped number again and documents the check-up.
// Wide layout: the lists in the main column; from 1180px a side rail shows today's sessions of this doctor.
// Booking requests waiting for an answer are in My Schedule > Waiting list.
import React from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import ConsultationLists, { CONSULTATION_TABS } from '../../components/scheduling/ConsultationLists';
import TodayRail from '../../components/scheduling/TodayRail';
import { useTodaySessions } from '../../hooks/useTodaySessions';

const DoctorCheckup = () => {
    const { doctorId, userId, refreshPending } = useOutletContext();
    const [params, setParams] = useSearchParams();
    const { sessions, reload } = useTodaySessions(doctorId);

    const tab = CONSULTATION_TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'upcoming';
    const setTab = (key) => { const next = new URLSearchParams(params); next.set('tab', key); next.delete('focus'); setParams(next, { replace: true }); };

    const onChanged = () => { reload(); refreshPending?.(); };

    return (
        <div className="workspace-dv">
            <div className="col-dv">
                <ConsultationLists
                    role="doctor"
                    doctorId={doctorId}
                    userId={userId}
                    tab={tab}
                    onTab={setTab}
                    focusId={params.get('focus')}
                    onChanged={onChanged}
                />
            </div>
            <TodayRail sessions={sessions} showDoctor={false} />
        </div>
    );
};

export default DoctorCheckup;
