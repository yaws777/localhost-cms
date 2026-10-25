// doctorChat.jsx
// The doctor's chat with the clinic nurse. The nurse sees the same conversation in Doctor Visits > Scheduling > Chat
// and in the Messages page.
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import StaffChat from '../../components/scheduling/StaffChat';
import '../../styles/doctor/DoctorLayout.css';

const DoctorChat = () => {
    const { userId, setChatUnread } = useOutletContext();

    return (
        <>
            <div className="dp-page-head">
                <div>
                    <h2>Chat with the Nurse</h2>
                    <p>Talk to the clinic nurse about schedules, waiting-list students and follow-ups.</p>
                </div>
            </div>
            <StaffChat userId={userId} onUnreadChange={setChatUnread} />
        </>
    );
};

export default DoctorChat;
