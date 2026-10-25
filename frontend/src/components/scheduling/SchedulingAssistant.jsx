// SchedulingAssistant.jsx
// Helps whoever plans the consultations: how many approved students are waiting for which kind of visit,
// what needs chasing up, and where the clinic could post a session (free doctor time, no clash, doctor offers the check-up).
import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, AlertTriangle, Info, CalendarPlus, RefreshCw, Users } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate } from '../../utils/datetime';
import { API, dayLabel, to12h, typeLabel, SCHEDULE_TYPES } from '../../utils/scheduling';
import '../../styles/nurse/DoctorVisits.css';
import '../../styles/nurse/DoctorSchedule.css';
import '../../styles/scheduling/Scheduling.css';

const ALERT_ICON = { info: Info, warning: AlertTriangle, danger: AlertTriangle };

const SchedulingAssistant = ({ fixedDoctorId, refreshKey, onUseSuggestion, onGoTab }) => {
    const { showAlert } = useAlert();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/scheduling-assistant${fixedDoctorId ? `?doctor_id=${encodeURIComponent(fixedDoctorId)}` : ''}`);
            const json = await res.json();
            if (json.success) setData(json);
            else showAlert(json.message || 'Could not build the suggestions.', 'error');
        } catch (e) {
            showAlert('Could not build the suggestions.', 'error');
        } finally {
            setLoading(false);
        }
    }, [fixedDoctorId, showAlert]);

    useEffect(() => { load(); }, [load, refreshKey]);

    if (loading && !data) return <div className="loading-dv">Working out the schedule...</div>;
    if (!data) return null;

    const totalWaiting = data.demand.reduce((n, d) => n + d.waiting, 0);

    return (
        <>
            <div className="toolbar-sc">
                <h3 className="section-head-ds" style={{ margin: 0 }}><Lightbulb size={18} /> Scheduling assistant</h3>
                <button type="button" className="icon-btn-ds" style={{ marginLeft: 'auto' }} title="Refresh" onClick={load}><RefreshCw size={15} /></button>
            </div>

            {data.alerts.length === 0 ? (
                <div className="alert-sc info-sc"><Info size={18} /><div><strong>Nothing needs chasing up.</strong>Every approved student has a session, and no request is overdue.</div></div>
            ) : data.alerts.map((a) => {
                const Icon = ALERT_ICON[a.level] || Info;
                return (
                    <div key={a.key} className={`alert-sc ${a.level}-sc`}>
                        <Icon size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>
                            <strong>{a.title}</strong>{a.text}
                        </div>
                        {a.key === 'review' && onGoTab && <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => onGoTab('waiting', 'review')}>Review</button>}
                        {a.key === 'reconfirm' && onGoTab && <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => onGoTab('waiting', 'reconfirm')}>Open</button>}
                        {a.key === 'booking' && onGoTab && <button type="button" className="sti-btn-dv sti-btn-light-dv btn-sm-sc" onClick={() => onGoTab('approvals')}>Review</button>}
                    </div>
                );
            })}

            <h3 className="section-head-ds"><Users size={18} /> Waiting for a consultation <span className="count-pill-ds count-muted-ds">{totalWaiting}</span></h3>
            <div className="assist-grid-sc">
                {data.demand.map((d) => (
                    <div key={d.visit_type} className="demand-card-sc">
                        <h4>{d.visit_type}</h4>
                        <span className="big-sc">{d.waiting}</span>
                        <small>
                            {d.waiting === 0 ? 'Nobody waiting' : `${d.on_waiting_list} on the list, ${d.awaiting_reconfirmation} asked to reconfirm, ${d.reconfirmed} ready to appoint`}
                            {d.priority > 0 ? ` - ${d.priority} priority` : ''}
                        </small>
                        {d.oldest_since && <small>Longest wait since {formatDate(d.oldest_since)}</small>}
                    </div>
                ))}
            </div>

            <h3 className="section-head-ds"><CalendarPlus size={18} /> Suggested sessions</h3>
            {data.suggestions.length === 0 ? (
                <div className="group-empty-ds">
                    {totalWaiting === 0
                        ? 'No approved student is waiting, so there is nothing to plan for right now.'
                        : 'Every waiting student already has an upcoming session of the right kind, or no doctor has a free window in the next two weeks.'}
                </div>
            ) : data.suggestions.map((s) => (
                <div key={`${s.doctor_id}-${s.visit_type}-${s.date}`} className="suggestion-sc">
                    <div>
                        <h4>
                            {s.visit_type} - {s.doctor_name}
                            <span className={`type-badge-sc ${SCHEDULE_TYPES[s.schedule_type].cls}`}>{typeLabel(s.schedule_type)}</span>
                        </h4>
                        <strong style={{ fontSize: '0.88rem' }}>{dayLabel(s.date, { weekday: 'long', month: 'long', day: 'numeric' })}, {to12h(s.start_time)} - {to12h(s.end_time)}</strong>
                        <p>{s.reason}</p>
                    </div>
                    {onUseSuggestion && (
                        <button type="button" className="sti-btn-dv sti-btn-primary-dv" onClick={() => onUseSuggestion(s)}>Create this schedule</button>
                    )}
                </div>
            ))}
        </>
    );
};

export default SchedulingAssistant;
