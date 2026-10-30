// doctorSchedule.jsx
// The doctor's check-up scheduling. It is the same screen the nurse uses (SchedulingHub), limited to this doctor:
// what the doctor posts shows up for the nurse, and what the nurse posts or appoints for this doctor shows up here.
import React, { useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import SchedulingHub from '../../components/scheduling/SchedulingHub';
import '../../styles/doctor/DoctorLayout.css';

const TABS = ['calendar', 'schedules', 'waiting', 'followups', 'assistant', 'chat'];

const DoctorSchedule = () => {
    const { doctor, doctorId, userId } = useOutletContext();
    const [searchParams] = useSearchParams();
    const doctorList = useMemo(() => [doctor], [doctor]);
    const tabParam = searchParams.get('tab');
    const initialTab = TABS.includes(tabParam) ? tabParam : 'calendar';

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>My Schedule</h2>
                    <p>The same schedule the nurse manages for you: calendar, schedules (you set them, the nurse can ask for one), the numbered waiting list and the queue of your sessions.</p>
                </div>
            </div>

            <SchedulingHub role="doctor" doctors={doctorList} fixedDoctorId={doctorId} userId={userId} initialTab={initialTab} />
        </>
    );
};

export default DoctorSchedule;
