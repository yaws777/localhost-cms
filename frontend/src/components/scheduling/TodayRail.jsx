// TodayRail.jsx
// The side rail of the check-up pages (nurse: Doctor Visit, doctor: My Check-ups): the sessions of today by state, the new updates
// (nurse only) and who is on duty. Put it beside the page in a `.workspace-dv` grid: it sits under the list on small screens.
import React from 'react';
import { Stethoscope, Bell, Users, ChevronRight } from 'lucide-react';
import { formatTime } from '../../utils/datetime';
import '../../styles/scheduling/TodayRail.css';

// "12 min ago" for the update list; nothing when the date cannot be read
const ago = (value) => {
    const t = new Date(String(value || '').replace(' ', 'T')).getTime();
    if (!Number.isFinite(t)) return '';
    const min = Math.max(Math.round((Date.now() - t) / 60000), 0);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
};

const sessionStatus = (s) => {
    if (s.state === 'ongoing') return s.awaiting_end ? 'Confirm end' : 'In session';
    if (s.state === 'upcoming') return 'To come';
    return 'Done';
};

// sessions: today's sessions. updates: unread scheduling notifications (optional). onOpenUpdates: icon button of the updates card.
// showDoctor: name the doctor on each line (the nurse sees every doctor, the doctor only sees their own sessions).
const TodayRail = ({ sessions = [], updates = [], onOpenUpdates, showDoctor = true }) => {
    const count = (state) => sessions.filter((s) => s.state === state).length;
    const sorted = [...sessions].sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));

    return (
        <aside className="rail-dv" aria-label="Today">
            <section className="rail-card-dv">
                <h3><Stethoscope size={18} aria-hidden="true" /> Today</h3>
                <div className="rail-tiles-dv">
                    <div className="rail-tile-dv"><b>{count('ongoing')}</b><span>On going</span></div>
                    <div className="rail-tile-dv"><b>{count('past')}</b><span>Done</span></div>
                </div>
            </section>

            {updates.length > 0 && (
                <section className="rail-card-dv">
                    <div className="rail-head-dv">
                        <h3><Bell size={18} aria-hidden="true" /> New updates</h3>
                        {onOpenUpdates && (
                            <button type="button" className="rail-icon-dv" onClick={onOpenUpdates} aria-label="Open Scheduling" title="Open Scheduling">
                                <ChevronRight size={18} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                    <ul className="rail-list-dv">
                        {updates.slice(0, 5).map((n) => (
                            <li key={n.notification_id}>
                                <span className="rail-dot-dv warn-dv" aria-hidden="true" />
                                <div>{n.title || n.message}<time>{ago(n.created_at)}</time></div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="rail-card-dv">
                <h3><Users size={18} aria-hidden="true" /> {showDoctor ? 'On duty' : 'My sessions'}</h3>
                {sorted.length === 0 ? (
                    <p className="rail-empty-dv">No session today</p>
                ) : (
                    <ul className="rail-list-dv">
                        {sorted.map((s) => (
                            <li key={`${s.schedule_id}-${s.date}`}>
                                <span className={`rail-dot-dv ${s.state === 'ongoing' ? 'ok-dv' : s.state === 'upcoming' ? 'warn-dv' : ''}`} aria-hidden="true" />
                                <div>
                                    {showDoctor ? s.doctor_name : (s.visit_type === 'Any' ? 'Any check-up' : s.visit_type)}
                                    <time>{sessionStatus(s)} - {formatTime(`${s.date} ${s.start_time}`)} to {formatTime(`${s.date} ${s.end_time}`)}</time>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </aside>
    );
};

export default TodayRail;
