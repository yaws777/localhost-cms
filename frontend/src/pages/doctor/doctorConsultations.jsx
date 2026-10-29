// doctorConsultations.jsx
// The doctor's consultations: Upcoming, On going and Past (past ones in a folder for each day). The lists are the same screen the nurse
// sees in Doctor Visit > Consultation (components/scheduling/ConsultationLists.jsx). Booking requests waiting for an answer are in
// My Schedule > Booking approvals.
import React from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import ConsultationLists, { CONSULTATION_TABS } from '../../components/scheduling/ConsultationLists';

const DoctorConsultations = () => {
    const { doctorId, userId, refreshPending } = useOutletContext();
    const [params, setParams] = useSearchParams();

    const tab = CONSULTATION_TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'upcoming';
    const setTab = (key) => { const next = new URLSearchParams(params); next.set('tab', key); next.delete('focus'); setParams(next, { replace: true }); };

    return (
        <ConsultationLists
            role="doctor"
            doctorId={doctorId}
            userId={userId}
            tab={tab}
            onTab={setTab}
            focusId={params.get('focus')}
            onChanged={refreshPending}
        />
    );
};

export default DoctorConsultations;
