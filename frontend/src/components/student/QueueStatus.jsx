// QueueStatus.jsx
// The status of one queue number on the student pages (Check-up page, dashboard): a pill (icon + word), one line of what to do next
// and a three step tracker (Time in, Called, Seen). Same look as the status column the nurse and doctor see in the queue.
//   a = one `appointments` entry of GET /api/student/:id/queue-status. `arrived` = the nurse timed the student in (vital signs done).
import React from 'react';
import { Clock, Megaphone, Stethoscope, CheckCircle2, ChevronsRight, CheckCircle, Check } from 'lucide-react';
import { to12h } from '../../utils/scheduling';
import '../../styles/student/QueueStatus.css';

// tone = modifier of .qs-pill-qs; hint = the one line shown under the pill
export const queueStatusOf = (a) => {
    const ahead = Number(a.ahead) || 0;
    if (a.state === 'Done' || a.documented) return { tone: 'ok', Icon: CheckCircle2, label: 'Done', hint: 'Check-up done. Thank you.' };
    if (a.state === 'Void') return { tone: 'bad', Icon: ChevronsRight, label: 'Skipped', hint: 'Tell the nurse you are here. You join the walk-ins.' };
    if (a.state === 'Serving' && a.arrived) return { tone: 'live', Icon: Stethoscope, label: 'Your turn', hint: 'Go to the check-up room now.' };
    if (a.state === 'Serving') return { tone: 'info', Icon: Megaphone, label: 'Called', hint: 'Go to the nurse for your time in and vital signs.' };
    if (!a.in_session) return { tone: 'mute', Icon: Clock, label: 'Not started', hint: `Session starts ${to12h(a.session_start)}.` };
    if (a.lane === 'Walk-in') return { tone: 'warn', Icon: Clock, label: 'Waiting', hint: 'Walk-ins are called after the listed numbers.' };
    if (!a.arrived) return { tone: 'mute', Icon: Clock, label: 'Waiting', hint: ahead === 0 ? 'You are next. Tell the nurse for your time in.' : `${ahead} ahead. Tell the nurse for your time in.` };
    if (ahead === 0) return { tone: 'warn', Icon: Clock, label: 'You are next', hint: 'Vital signs done. Stay close to the check-up room.' };
    return { tone: 'ok', Icon: CheckCircle, label: 'Ready', hint: `Vital signs done. ${ahead} ahead of you.` };
};

const STEPS = ['Time in', 'Called', 'Seen'];
const trackerOf = (a) => {
    if (a.state === 'Void') return null;
    const seen = a.state === 'Done' || !!a.documented;
    const done = [!!a.arrived || seen, a.state === 'Serving' || seen, seen];
    return { done, current: done.findIndex((d) => !d) };
};

export const QueuePill = ({ a, hero = false }) => {
    const { tone, Icon, label } = queueStatusOf(a);
    return <span className={`qs-pill-qs ${hero ? 'qs-pill-hero-qs' : `qs-pill-${tone}-qs`}`}><Icon size={14} aria-hidden="true" /> {label}</span>;
};

export const QueueHint = ({ a }) => <p className="qs-hint-qs">{queueStatusOf(a).hint}</p>;

export const QueueSteps = ({ a }) => {
    const tracker = trackerOf(a);
    if (!tracker) return null;
    return (
        <ol className="qs-steps-qs" aria-label="Progress">
            {STEPS.map((name, i) => (
                <li key={name} className={tracker.done[i] ? 'done' : i === tracker.current ? 'now' : ''} aria-current={i === tracker.current ? 'step' : undefined}>
                    <span className="qs-dot-qs" aria-hidden="true">{tracker.done[i] && <Check size={10} strokeWidth={3.5} />}</span>
                    {name}
                    {tracker.done[i] && <span className="qs-sr-qs"> done</span>}
                </li>
            ))}
        </ol>
    );
};

// hint + tracker together; `hero` = on the dark blue card of the dashboard
const QueueStatus = ({ a, hero = false }) => (
    <div className={`qs-block-qs${hero ? ' qs-hero-qs' : ''}`}>
        <QueueHint a={a} />
        <QueueSteps a={a} />
    </div>
);

export default QueueStatus;
