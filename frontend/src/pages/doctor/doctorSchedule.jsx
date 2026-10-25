// doctorSchedule.jsx
// The doctor's consultation scheduling. It is the same screen the nurse uses (SchedulingHub), limited to this doctor:
// what the doctor posts shows up for the nurse, and what the nurse posts or appoints for this doctor shows up here.
import React, { useState, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Footprints, CalendarPlus } from 'lucide-react';
import SchedulingHub from '../../components/scheduling/SchedulingHub';
import { DirectAppointmentModal, WalkInModal } from '../../components/doctor/AppointmentModals';
import '../../styles/doctor/DoctorLayout.css';

const TABS = ['calendar', 'schedules', 'waiting', 'approvals', 'assistant'];

const DoctorSchedule = () => {
    const { doctor, doctorId, userId } = useOutletContext();
    const [searchParams] = useSearchParams();
    const [showDirect, setShowDirect] = useState(false);
    const [showWalkIn, setShowWalkIn] = useState(false);
    const doctorList = useMemo(() => [doctor], [doctor]);
    const tabParam = searchParams.get('tab');
    const initialTab = TABS.includes(tabParam) ? tabParam : 'calendar';

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>My Schedule</h2>
                    <p>Appointments, open time slots and walk-in sessions. The nurse can also post and update your schedule, and you both see the same calendar, schedules and waiting list.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setShowDirect(true)}><CalendarPlus size={16} /> Custom appointment</button>
                    <button type="button" className="dp-btn dp-btn-ghost" onClick={() => setShowWalkIn(true)}><Footprints size={16} /> Register a walk-in</button>
                </div>
            </div>

            <SchedulingHub role="doctor" doctors={doctorList} fixedDoctorId={doctorId} userId={userId} initialTab={initialTab} />

            <DirectAppointmentModal isOpen={showDirect} doctors={doctorList} fixedDoctorId={doctorId} creator={{ doctorId }} userId={userId} onClose={() => setShowDirect(false)} />
            <WalkInModal isOpen={showWalkIn} doctors={doctorList} fixedDoctorId={doctorId} creator={{ doctorId }} userId={userId} onClose={() => setShowWalkIn(false)} />
        </>
    );
};

export default DoctorSchedule;
