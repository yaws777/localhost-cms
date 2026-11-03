// bookCheckup.jsx - the student's check-up page (route /BookCheckup).
// The doctor sets a schedule with a listing limit and the nurse opens its listing. The student sees the open listings here and asks for a
// place in one. When the nurse accepts, the student gets the next queue number of that session (in the order of acceptance) and sees which
// number is being served; the nurse can also decline with a reason.
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClipboardList, X, Clock, Info, Stethoscope, MapPin, Repeat, FileText } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { visitLabel, reasonPlaceholder } from '../../utils/visitPurpose';
import { to12h } from '../../utils/scheduling';
import { useQueueStatus } from '../../hooks/useQueueStatus';
import { QueueTicket, WaitingTicket } from '../../components/student/MyQueue';
import '../../styles/student/BookCheckup.css';

const API = 'http://localhost:3001';

const EMPTY_REQUEST = { visit_type: '', reason: '', preferred_note: '' };
const FINISHED = ['Missed', 'Denied', 'Withdrawn']; // a fulfilled request shows under Past check-ups

const statusClass = (status) => `status-${String(status).toLowerCase().replace(/\s+/g, '-')}-bc`;

const BookCheckup = () => {
    const { studentId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();

    // the live place in line: pending asks and session queue numbers
    const { requests: active, appointments, loading, refresh } = useQueueStatus(studentId);

    const [listings, setListings] = useState([]);
    const [listingsLoaded, setListingsLoaded] = useState(false);
    const [inAdvance, setInAdvance] = useState(false);
    const [advance, setAdvance] = useState(null); // the advance listing: open?, services with their limit, and my own entry
    const [advanceForm, setAdvanceForm] = useState({ visit_type: '', reason: '' });
    const [advanceBusy, setAdvanceBusy] = useState(false);
    const [advanceOpen, setAdvanceOpen] = useState(false); // the request form opens only from the button
    const [history, setHistory] = useState([]);
    const [checkups, setCheckups] = useState({ past: [], scheduled: [], waiting: [] }); // repeats + past check-ups with their assessment
    const [assessmentOf, setAssessmentOf] = useState(null);
    const [requestFor, setRequestFor] = useState(null); // the listing the student is asking a place in
    const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
    const [submitting, setSubmitting] = useState(false);

    const fetchListings = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/open-listings`);
            const data = await res.json();
            if (data.success) { setListings(data.listings); setInAdvance(!!data.in_advance); }
        } catch (e) { /* the page says there is no open listing */ }
        finally { setListingsLoaded(true); }
    }, [studentId]);

    const fetchAdvance = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/advance-listing?student_id=${encodeURIComponent(studentId)}`);
            const data = await res.json();
            if (data.success) setAdvance(data);
        } catch (e) { /* the section says the advance listing is not available */ }
    }, [studentId]);

    const fetchHistory = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/consultation-requests`);
            const data = await res.json();
            if (data.success) setHistory(data.requests.filter((r) => FINISHED.includes(r.status)));
        } catch (e) { showAlert('Could not load your check-up history.', 'error'); }
    }, [studentId, showAlert]);

    const fetchCheckups = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/checkup-history`);
            const data = await res.json();
            if (data.success) setCheckups({ past: data.past, scheduled: data.scheduled, waiting: data.waiting });
        } catch (e) { showAlert('Could not load your repeats and past check-ups.', 'error'); }
    }, [studentId, showAlert]);

    useEffect(() => { fetchListings(); fetchHistory(); fetchAdvance(); fetchCheckups(); }, [fetchListings, fetchHistory, fetchAdvance, fetchCheckups]);

    const reloadAll = () => { refresh(); fetchHistory(); fetchListings(); fetchAdvance(); fetchCheckups(); };

    const registerAdvance = async (e) => {
        e.preventDefault();
        if (!advanceForm.visit_type) { showAlert('Please select the check-up service you need.', 'warning'); return; }
        if (!advanceForm.reason.trim()) { showAlert('Please tell the clinic why you need a check-up.', 'warning'); return; }
        setAdvanceBusy(true);
        try {
            const res = await fetch(`${API}/api/student/advance-listing`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, ...advanceForm })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); setAdvanceForm({ visit_type: '', reason: '' }); setAdvanceOpen(false); reloadAll(); }
            else { showAlert(data.message || 'Could not register in the advance listing.', 'error'); fetchAdvance(); }
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        } finally {
            setAdvanceBusy(false);
        }
    };

    const leaveAdvance = async (entry) => {
        const ok = await showConfirm(
            `Cancel the ${entry.visit_type} advance listing${entry.label ? ` (${entry.label})` : ''}? ${entry.label ? 'You lose your number.' : 'Your request is cancelled.'}`,
            { danger: true, confirmLabel: 'Cancel listing', cancelLabel: 'Keep it', title: 'Cancel the advance listing' }
        );
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/student/advance-listing/${entry.entry_id}/withdraw`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); reloadAll(); } else showAlert(data.message || 'Could not cancel the advance listing.', 'error');
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        }
    };

    const openRequestForm = (listing) => {
        if (listing.mine) return; // the student already has a request or a number in this session
        setRequestForm({ ...EMPTY_REQUEST, visit_type: listing.purposes.length === 1 ? listing.purposes[0] : '' });
        setRequestFor(listing);
    };

    const sendRequest = async (e) => {
        e.preventDefault();
        if (!requestForm.visit_type) { showAlert('Please select the check-up you need.', 'warning'); return; }
        if (!requestForm.reason.trim()) { showAlert('Please tell the clinic why you need a check-up.', 'warning'); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/api/student/consultation-requests`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_id: studentId, schedule_id: requestFor.schedule_id, ...requestForm })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); setRequestFor(null); setRequestForm(EMPTY_REQUEST); reloadAll(); }
            else { showAlert(data.message || 'Could not send the request.', 'error'); fetchListings(); }
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const withdrawRequest = async (r) => {
        const ok = await showConfirm(
            `Withdraw your ${visitLabel(r.visit_type, r.purpose_other)} request?`,
            { danger: true, confirmLabel: 'Withdraw', cancelLabel: 'Keep it', title: 'Withdraw the request' }
        );
        if (!ok) return;
        try {
            const res = await fetch(`${API}/api/student/consultation-requests/${r.request_id}/withdraw`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId })
            });
            const data = await res.json();
            if (data.success) { showAlert(data.message, 'success'); reloadAll(); }
            else showAlert(data.message || 'Could not withdraw the request.', 'error');
        } catch (err) {
            showAlert('Server error. Please try again.', 'error');
        }
    };

    const historyHelp = (r) => {
        if (r.status === 'Denied') return r.review_reason ? `Declined: ${r.review_reason}` : 'Declined.';
        if (r.status === 'Missed') return 'Number skipped. Ask for a place in another listing.';
        if (r.status === 'Fulfilled') return r.appointment_start ? `Seen ${formatDateTime(r.appointment_start)}, Dr. ${r.appt_doc_first_name} ${r.appt_doc_last_name}.` : 'Seen.';
        return 'Withdrawn.';
    };

    const listingTag = (l) => {
        if (l.mine) return l.mine.status === 'Waiting for Approval' ? 'Request sent' : 'You have a place';
        return l.listing_full ? 'Listing full' : 'Listing open';
    };

    return (
        <div className="container-bc">
            <div className="header-bc">
                <div>
                    <h2><ClipboardList size={22} /> Check-up</h2>
                    <p>Ask for a place in an open listing. Follow your number below.</p>
                </div>
            </div>

            <div className="layout-bc">
            <div className="col-bc">
            <section className="section-bc" aria-label="Advance Listing (No Schedule Yet)">
                <h3>Advance Listing <span className="paren-bc">(No Schedule Yet)</span></h3>
                {!advance ? (
                    <div className="empty-bc">Loading...</div>
                ) : (
                    <>
                        <p className="muted-bc" style={{ marginBottom: 12 }}>Register before a doctor sets a schedule. You get the first queue numbers.</p>
                        {advance.mine && (
                            <div className="booking-card-bc announce-bc" style={{ marginBottom: 14 }}>
                                <div className="booking-top-bc">
                                    <strong>{advance.mine.visit_type}{advance.mine.label ? `: advance number ${advance.mine.label}` : ''}</strong>
                                    <span className="tag-bc">{advance.mine.status === 'Pending' ? 'Under review' : advance.mine.status === 'Waiting' ? 'Waiting for a schedule' : `Queue number ${advance.mine.queue_label || ''}`}</span>
                                </div>
                                <div className="booking-reason-bc">Reason: {advance.mine.reason}</div>
                                {advance.mine.status === 'Scheduled' && advance.mine.session_date ? (
                                    <div className="booking-line-bc"><Clock size={14} /> {advance.mine.doctor_name}, {formatDate(advance.mine.session_date)}, {to12h(advance.mine.session_start)} - {to12h(advance.mine.session_end)}{advance.mine.location ? ` (${advance.mine.location})` : ''}</div>
                                ) : advance.mine.status === 'Pending' ? (
                                    <div className="booking-line-bc"><Info size={14} /> The nurse is reviewing your request.</div>
                                ) : (
                                    <div className="booking-line-bc"><Info size={14} /> Waiting for a doctor's schedule.</div>
                                )}
                                {(advance.mine.status === 'Waiting' || advance.mine.status === 'Pending') && (
                                    <div className="booking-actions-bc"><button type="button" className="btn-bc btn-danger-bc" onClick={() => leaveAdvance(advance.mine)}>Cancel the advance listing</button></div>
                                )}
                            </div>
                        )}
                        {!advance.mine && !advance.is_open && (
                            <div className="empty-bc"><p>Advance listing is closed.</p></div>
                        )}
                        {advance.is_open && !advance.mine && (
                            <div className="booking-actions-bc">
                                <button type="button" className="btn-bc btn-primary-bc" onClick={() => setAdvanceOpen(true)}>Request advance listing</button>
                            </div>
                        )}
                        {advance.is_open && advance.closes_at && !advance.mine && <p className="muted-bc" style={{ marginTop: 8 }}>Closes {formatDateTime(advance.closes_at)}.</p>}
                    </>
                )}
            </section>

            <section className="section-bc" aria-label="Session Listing (With Already Schedule)">
                <h3>Session Listing <span className="paren-bc">(With Already Schedule)</span></h3>
                {!listingsLoaded ? (
                    <div className="empty-bc">Loading...</div>
                ) : inAdvance ? (
                    <div className="empty-bc">
                        <ClipboardList size={28} />
                        <p>You are in the advance listing.</p>
                    </div>
                ) : listings.length === 0 ? (
                    <div className="empty-bc">
                        <ClipboardList size={28} />
                        <p>No open listing. Check back later.</p>
                    </div>
                ) : (
                    <div className="stack-bc">
                        {listings.map((l) => (
                            <div key={`${l.schedule_id}-${l.date}`} className="booking-card-bc announce-bc">
                                <div className="booking-top-bc">
                                    <strong>{l.visit_type === 'Any' ? 'Check-up session' : `${l.visit_type} session`}</strong>
                                    <span className="tag-bc">{listingTag(l)}</span>
                                </div>
                                <div className="booking-line-bc"><Stethoscope size={14} /> {l.doctor_name} ({l.specialization})</div>
                                <div className="booking-line-bc"><Clock size={14} /> {formatDate(l.date)}, {to12h(l.start_time)} - {to12h(l.end_time)}</div>
                                {l.location && <div className="booking-line-bc"><MapPin size={14} /> {l.location}</div>}
                                <div className="booking-line-bc">
                                    <Info size={14} /> {l.accepted} of {l.listing_limit} accepted
                                    {l.advance > 0 ? ` (${l.places_left} left)` : ''}
                                </div>
                                {l.notes && <div className="muted-bc">{l.notes}</div>}
                                <div className="booking-actions-bc">
                                    <button type="button" className="btn-bc btn-primary-bc" disabled={!l.can_request} onClick={() => openRequestForm(l)}>
                                        {l.mine ? (l.mine.status === 'Waiting for Approval' ? 'Waiting for the nurse' : `Your number: ${l.mine.label || `#${l.mine.queue_no}`}`) : l.listing_full ? 'Listing full' : 'Ask for a place'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            </div>
            <div className="col-bc">
            <section className="section-bc" aria-label="My place in line">
                <h3>My place in line</h3>
                {loading ? (
                    <div className="empty-bc">Loading...</div>
                ) : appointments.length === 0 && active.length === 0 ? (
                    <div className="empty-bc">
                        <ClipboardList size={28} />
                        <p>No place yet.</p>
                    </div>
                ) : (
                    <div className="stack-bc">
                        {appointments.map((a) => <QueueTicket key={a.appointment_id} a={a} />)}
                        {active.map((r) => (
                            <div key={r.request_id} className="request-wrap-bc">
                                <WaitingTicket r={r} />
                                <div className="request-foot-bc">
                                    <span className="muted-bc">Reason: {r.reason}</span>
                                    <div className="booking-actions-bc">
                                        <button className="btn-bc btn-danger-bc" onClick={() => withdrawRequest(r)}>Withdraw the request</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="section-bc" aria-label="Repeats">
                <h3><Repeat size={16} /> Repeats</h3>
                {checkups.waiting.length === 0 && checkups.scheduled.length === 0 ? (
                    <div className="empty-bc">No repeat check-up.</div>
                ) : (
                    <div className="stack-bc stack-short-bc">
                        {checkups.scheduled.map((f) => (
                            <div key={f.appointment_id} className="booking-card-bc announce-bc appointment-bc">
                                <div className="booking-top-bc">
                                    <strong>Repeat check-up</strong>
                                    <span className="tag-bc">{f.label ? `Number ${f.label}` : 'Scheduled'}</span>
                                </div>
                                <div className="booking-line-bc"><Stethoscope size={14} /> {f.doctor_name}</div>
                                <div className="booking-line-bc"><Clock size={14} /> {f.queued ? formatDate(f.date) : formatDateTime(f.start_time)}{f.location ? ` (${f.location})` : ''}</div>
                            </div>
                        ))}
                        {checkups.waiting.map((w) => (
                            <div key={w.appointment_id} className="booking-card-bc announce-bc">
                                <div className="booking-top-bc">
                                    <strong>{visitLabel(w.visit_type, w.purpose_other)}</strong>
                                    <span className="tag-bc tag-soft-bc">Waiting for a schedule</span>
                                </div>
                                <div className="booking-line-bc"><Stethoscope size={14} /> {w.doctor_name}</div>
                                {w.follow_up_date && <div className="booking-line-bc"><Clock size={14} /> Advised by {formatDate(w.follow_up_date)}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="section-bc" aria-label="Past check-ups">
                <h3><FileText size={16} /> Past check-ups</h3>
                {checkups.past.length === 0 ? (
                    <div className="empty-bc">No past check-up yet.</div>
                ) : (
                    <div className="stack-bc stack-short-bc">
                        {checkups.past.map((c) => (
                            <div key={c.appointment_id} className="booking-card-bc request-card-bc">
                                <div className="booking-top-bc">
                                    <strong>{c.is_repeat ? 'Repeat check-up' : visitLabel(c.visit_type, c.purpose_other)}</strong>
                                    <span className={`status-pill-bc ${c.outcome === 'Seen' ? 'status-fulfilled-bc' : c.outcome === 'Missed' ? 'status-denied-bc' : 'status-waiting-list-bc'}`}>{c.outcome}</span>
                                </div>
                                <div className="booking-line-bc"><Clock size={14} /> {formatDate(c.date)}, {c.doctor_name}</div>
                                {c.assessment && (
                                    <>
                                        <div className="booking-reason-bc">{c.assessment.diagnosis}</div>
                                        <div className="booking-actions-bc">
                                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setAssessmentOf(c)}>View assessment</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {history.length > 0 && (
                <section className="section-bc" aria-label="Other requests">
                    <h3>Other requests</h3>
                    <div className="stack-bc stack-short-bc">
                        {history.map((r) => (
                            <div key={r.request_id} className="booking-card-bc request-card-bc">
                                <div className="booking-top-bc">
                                    <strong>{visitLabel(r.visit_type, r.purpose_other)}</strong>
                                    <span className={`status-pill-bc ${statusClass(r.status)}`}>{r.status}</span>
                                </div>
                                <div className="booking-reason-bc">Reason: {r.reason}</div>
                                <div className="booking-line-bc"><Clock size={14} /> Sent {formatDate(r.created_at)}</div>
                                <p className="request-help-bc">{historyHelp(r)}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            </div>
            </div>

            {assessmentOf && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-assess-title">
                    <div className="modal-bc">
                        <div className="modal-header-bc">
                            <h3 id="bc-assess-title">Assessment</h3>
                            <button type="button" className="close-bc" onClick={() => setAssessmentOf(null)} aria-label="Close"><X size={20} /></button>
                        </div>
                        <p className="request-help-bc">{assessmentOf.doctor_name}, {formatDate(assessmentOf.date)}</p>
                        <dl className="assess-bc">
                            {[['Reason', assessmentOf.assessment.chief_complaint], ['Findings', assessmentOf.assessment.clinical_findings], ['Diagnosis', assessmentOf.assessment.diagnosis], ['Advice', assessmentOf.assessment.treatment_recommendations]]
                                .filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
                            {assessmentOf.assessment.prescriptions.length > 0 && (
                                <div><dt>Prescription</dt><dd>
                                    {assessmentOf.assessment.prescriptions.map((m, i) => (
                                        <div key={i}>{[m.medicine, m.dosage, m.frequency, m.duration].filter(Boolean).join(', ')}{m.instructions ? ` (${m.instructions})` : ''}</div>
                                    ))}
                                </dd></div>
                            )}
                            {assessmentOf.assessment.referral_facility && <div><dt>Referral</dt><dd>{assessmentOf.assessment.referral_facility}{assessmentOf.assessment.referral_reason ? `: ${assessmentOf.assessment.referral_reason}` : ''}</dd></div>}
                            {assessmentOf.assessment.follow_up_needed ? <div><dt>Repeat</dt><dd>{assessmentOf.assessment.follow_up_date ? `By ${formatDate(assessmentOf.assessment.follow_up_date)}` : 'Needed'}{assessmentOf.assessment.follow_up_notes ? `: ${assessmentOf.assessment.follow_up_notes}` : ''}</dd></div> : null}
                        </dl>
                        <div className="modal-footer-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setAssessmentOf(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {advanceOpen && advance && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-adv-title">
                    <form className="modal-bc" onSubmit={registerAdvance}>
                        <div className="modal-header-bc">
                            <h3 id="bc-adv-title">Request advance listing</h3>
                            <button type="button" className="close-bc" onClick={() => setAdvanceOpen(false)} aria-label="Close"><X size={20} /></button>
                        </div>
                        <div className="field-bc">
                            <label htmlFor="bc-adv-service">Check-up service</label>
                            <select id="bc-adv-service" required value={advanceForm.visit_type} onChange={(e) => setAdvanceForm({ ...advanceForm, visit_type: e.target.value })}>
                                <option value="">-- Select the check-up service --</option>
                                {advance.services.filter((s) => s.offered).map((s) => (
                                    <option key={s.visit_type} value={s.visit_type} disabled={s.listing_full || s.scheduled || !s.service_open}>
                                        {s.visit_type} ({s.scheduled ? 'already scheduled' : !s.service_open ? 'closed' : `${s.registered} of ${s.listing_limit} registered${s.listing_full ? ', full' : ''}`})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="field-bc">
                            <label htmlFor="bc-adv-reason">Reason for the check-up</label>
                            <textarea id="bc-adv-reason" rows="3" maxLength={255} required value={advanceForm.reason} onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })} placeholder={reasonPlaceholder(advanceForm.visit_type)} />
                        </div>
                        <div className="modal-footer-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setAdvanceOpen(false)}>Close</button>
                            <button type="submit" className="btn-bc btn-primary-bc" disabled={advanceBusy || !advanceForm.visit_type}>{advanceBusy ? 'Registering...' : 'Register'}</button>
                        </div>
                    </form>
                </div>
            )}

            {requestFor && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-request-title">
                    <form className="modal-bc" onSubmit={sendRequest}>
                        <div className="modal-header-bc">
                            <h3 id="bc-request-title">Ask for a place</h3>
                            <button type="button" className="close-bc" onClick={() => setRequestFor(null)} aria-label="Close"><X size={20} /></button>
                        </div>
                        <p className="request-help-bc" style={{ marginBottom: 12 }}>
                            {requestFor.doctor_name}, {formatDate(requestFor.date)}, {to12h(requestFor.start_time)} - {to12h(requestFor.end_time)}{requestFor.location ? ` (${requestFor.location})` : ''}.
                            You get a number once the nurse accepts.
                        </p>
                        <div className="field-bc">
                            <label htmlFor="bc-service">Check-up</label>
                            <select id="bc-service" required value={requestForm.visit_type} onChange={e => setRequestForm({ ...requestForm, visit_type: e.target.value })} disabled={requestFor.purposes.length === 1}>
                                <option value="">-- Select the check-up --</option>
                                {requestFor.purposes.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="field-bc">
                            <label htmlFor="bc-reason">Reason for the check-up</label>
                            <textarea id="bc-reason" rows="3" maxLength={255} required value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} placeholder={reasonPlaceholder(requestForm.visit_type)} />
                        </div>
                        <div className="field-bc">
                            <label htmlFor="bc-note">Notes for the clinic (optional)</label>
                            <input id="bc-note" type="text" maxLength={255} value={requestForm.preferred_note} onChange={e => setRequestForm({ ...requestForm, preferred_note: e.target.value })} />
                        </div>
                        <div className="modal-footer-bc">
                            <button type="button" className="btn-bc btn-light-bc" onClick={() => setRequestFor(null)}>Close</button>
                            <button type="submit" className="btn-bc btn-primary-bc" disabled={submitting || !requestForm.visit_type}>{submitting ? 'Sending...' : 'Send the request'}</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default BookCheckup;
