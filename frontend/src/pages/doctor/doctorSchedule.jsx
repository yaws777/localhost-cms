// doctorSchedule.jsx
// The doctor's consultation availability: the three ways to schedule, open time blocks students can book into
// (with or without approval), and unavailable dates.
import React, { useState, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { CalendarPlus, CalendarClock, Footprints } from 'lucide-react';
import { DoctorAvailability } from '../../components/nurse/DoctorAvailability';
import UnavailableDates from '../../components/doctor/UnavailableDates';
import { DirectAppointmentModal, WalkInModal } from '../../components/doctor/AppointmentModals';
import '../../styles/doctor/DoctorLayout.css';

const DoctorSchedule = () => {
    const { doctor, doctorId, userId } = useOutletContext();
    const [, setSearchParams] = useSearchParams();
    const [showDirect, setShowDirect] = useState(false);
    const [showWalkIn, setShowWalkIn] = useState(false);
    const doctorList = useMemo(() => [doctor], [doctor]);

    // DoctorAvailability opens its "add schedule" form when it sees ?doctor=<id>&new=1
    const postBlock = () => setSearchParams({ doctor: doctorId, new: '1' });

    const ways = [
        {
            Icon: CalendarPlus, title: 'Direct appointment', text: 'Pick a student and set your own time block. It is confirmed right away.',
            action: <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setShowDirect(true)}>Appoint a student</button>
        },
        {
            Icon: CalendarClock, title: 'Open time block', text: 'Post times students can book (for example general check-ups). Choose whether a booking needs approval or is accepted automatically.',
            action: <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={postBlock}>Post a time block</button>
        },
        {
            Icon: Footprints, title: 'Pure walk-in', text: 'The student comes to the clinic without a booking. Register them and document the visit right away.',
            action: <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setShowWalkIn(true)}>Register a walk-in</button>
        }
    ];

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>My Schedule</h2>
                    <p>Set when you are available. The nurse can also post and update your schedule, and you both see the same list.</p>
                </div>
            </div>

            <div className="dp-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 18 }}>
                {ways.map(({ Icon, title, text, action }) => (
                    <section key={title} className="dp-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <span className="dl-avatar" style={{ background: 'var(--sti-blue-light)', color: 'var(--sti-blue-primary)', borderColor: 'transparent' }}><Icon size={20} /></span>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
                        <p className="dp-hint" style={{ margin: 0, flex: 1, fontSize: '0.84rem' }}>{text}</p>
                        <div>{action}</div>
                    </section>
                ))}
            </div>

            <section className="dp-card" aria-label="Open time blocks">
                <h3 className="dp-card-title">Open time blocks</h3>
                <DoctorAvailability doctors={doctorList} userId={userId} creatorDoctorId={doctorId} />
            </section>

            <div style={{ marginTop: 18 }}>
                <UnavailableDates doctors={doctorList} fixedDoctorId={doctorId} userId={userId} />
            </div>

            <DirectAppointmentModal isOpen={showDirect} fixedDoctorId={doctorId} creator={{ doctorId }} userId={userId} onClose={() => setShowDirect(false)} />
            <WalkInModal isOpen={showWalkIn} fixedDoctorId={doctorId} creator={{ doctorId }} userId={userId} onClose={() => setShowWalkIn(false)} />
        </>
    );
};

export default DoctorSchedule;
