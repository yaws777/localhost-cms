// MyQueue.jsx
// The student's numbers: the waiting-list number per category and the queue number inside a doctor's session, with the number being served.
// Used by the Check-up page and the student dashboard.
import React from 'react';
import { Stethoscope, MapPin, Clock, Megaphone, Hourglass } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import { visitLabel } from '../../utils/visitPurpose';
import { to12h } from '../../utils/scheduling';
import '../../styles/student/MyQueue.css';

const stateLine = (a) => {
    if (a.state === 'Serving') return { tone: 'go', title: 'It is your turn', text: 'Your number is being served. Please go to the check-up room now.' };
    if (a.state === 'Void') {
        return { tone: 'void', title: 'Your number was skipped', text: 'Tell the nurse you are here: you will be accommodated as a walk-in, after the listed students.' };
    }
    if (a.state === 'Done') return { tone: 'done', title: 'Check-up done', text: 'Thank you for visiting the clinic.' };
    if (!a.in_session) return { tone: 'wait', title: 'Session not started', text: `The session starts at ${to12h(a.session_start)}. Come to the clinic then and wait for your number.` };
    if (a.lane === 'Walk-in') {
        return {
            tone: 'wait', title: `${a.ahead} ahead of you`,
            text: 'Walk-ins are called after all listed students. Stay at the clinic.'
        };
    }
    if (a.ahead === 0) return { tone: 'near', title: 'You are next', text: 'Please stay close to the check-up room.' };
    return { tone: a.ahead <= 3 ? 'near' : 'wait', title: `${a.ahead} ahead of you`, text: a.est_wait_min ? `About ${a.est_wait_min} minutes at the current pace.` : '' };
};

export const QueueTicket = ({ a, compact = false }) => {
    const line = stateLine(a);
    return (
        <div className={`ticket-mq tone-${line.tone}-mq ${compact ? 'compact-mq' : ''}`}>
            <div className="ticket-no-mq" aria-label={`Your queue number ${a.label}`}>
                <small>{a.lane === 'Walk-in' ? 'Walk-in' : 'Your number'}</small>
                <strong>{a.label}</strong>
            </div>
            <div className="ticket-body-mq">
                <div className="ticket-top-mq">
                    <strong>{visitLabel(a.visit_type)}</strong>
                    <span className="serving-mq"><Megaphone size={13} /> Now serving: <b>{a.now_serving || '-'}</b></span>
                </div>
                <div className="ticket-title-mq">{line.title}</div>
                {line.text && <p className="ticket-text-mq">{line.text}</p>}
                <div className="ticket-meta-mq">
                    <span><Stethoscope size={13} /> {a.doctor_name}</span>
                    <span><Clock size={13} /> {formatDate(a.date)}, {to12h(a.session_start)} - {to12h(a.session_end)}</span>
                    {a.location && <span><MapPin size={13} /> {a.location}</span>}
                </div>
            </div>
        </div>
    );
};

// A listing the nurse has not accepted yet has no number: the number is given when the nurse accepts it
export const WaitingTicket = ({ r, compact = false }) => {
    const pending = r.status === 'Waiting for Approval';
    return (
        <div className={`ticket-mq tone-list-mq ${compact ? 'compact-mq' : ''}`}>
            <div className="ticket-no-mq" aria-label={pending ? 'No queue number yet' : `Waiting list number ${r.queue_no}`}>
                <small>{pending ? 'Queue no.' : 'List no.'}</small>
                <strong>{pending ? '-' : `#${r.queue_no}`}</strong>
            </div>
            <div className="ticket-body-mq">
                <div className="ticket-top-mq">
                    <strong>{visitLabel(r.visit_type, r.purpose_other)} {pending ? 'request' : 'waiting list'}</strong>
                    <span className="serving-mq"><Hourglass size={13} /> {pending ? 'Waiting for the nurse' : r.status}</span>
                </div>
                <div className="ticket-title-mq">
                    {pending
                        ? (r.listing_start_time ? `Dr. ${r.listing_doc_first_name} ${r.listing_doc_last_name}, ${formatDate(r.listing_date)}, ${to12h(r.listing_start_time)} - ${to12h(r.listing_end_time)}` : 'Not accepted yet')
                        : r.queue_position ? `Position ${r.queue_position} of ${r.queue_total}` : 'On the list'}
                </div>
                <p className="ticket-text-mq">
                    {pending
                        ? 'The nurse reviews your request. You get your queue number for this session once it is accepted.'
                        : r.status === 'Awaiting Reconfirmation'
                            ? 'The clinic asks if you are still interested. Please answer below.'
                            : 'The nurse appoints students one by one when a doctor has a session. You will get a queue number then.'}
                </p>
            </div>
        </div>
    );
};

const MyQueue = ({ appointments = [], requests = [], compact = false, emptyText = '' }) => {
    if (appointments.length === 0 && requests.length === 0) {
        return emptyText ? <p className="empty-mq">{emptyText}</p> : null;
    }
    return (
        <div className="stack-mq">
            {appointments.map((a) => <QueueTicket key={a.appointment_id} a={a} compact={compact} />)}
            {requests.map((r) => <WaitingTicket key={r.request_id} r={r} compact={compact} />)}
        </div>
    );
};

export default MyQueue;
