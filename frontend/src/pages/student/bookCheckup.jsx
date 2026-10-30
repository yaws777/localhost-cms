// bookCheckup.jsx - the student's check-up page (route /BookCheckup).
// The doctor sets a schedule with a listing limit and the nurse opens its listing. The student sees the open listings here and asks for a
// place in one. When the nurse accepts, the student gets the next queue number of that session (in the order of acceptance) and sees which
// number is being served; the nurse can also decline with a reason.
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ClipboardList, X, Clock, Info, Stethoscope, MapPin } from 'lucide-react';
import { useAlert } from '../../context/AlertContext';
import { formatDate, formatDateTime } from '../../utils/datetime';
import { visitLabel, reasonPlaceholder } from '../../utils/visitPurpose';
import { to12h } from '../../utils/scheduling';
import { useQueueStatus } from '../../hooks/useQueueStatus';
import { QueueTicket, WaitingTicket } from '../../components/student/MyQueue';
import '../../styles/student/BookCheckup.css';

const API = 'http://localhost:3001';

const EMPTY_REQUEST = { visit_type: '', reason: '', preferred_note: '' };
const FINISHED = ['Fulfilled', 'Missed', 'Denied', 'Withdrawn'];

const statusClass = (status) => `status-${String(status).toLowerCase().replace(/\s+/g, '-')}-bc`;

const BookCheckup = () => {
    const { studentId } = useOutletContext() || {};
    const { showAlert, showConfirm } = useAlert();

    // the live place in line: pending asks and session queue numbers
    const { requests: active, appointments, loading, refresh } = useQueueStatus(studentId);

    const [listings, setListings] = useState([]);
    const [listingsLoaded, setListingsLoaded] = useState(false);
    const [history, setHistory] = useState([]);
    const [requestFor, setRequestFor] = useState(null); // the listing the student is asking a place in
    const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
    const [submitting, setSubmitting] = useState(false);

    const fetchListings = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/open-listings`);
            const data = await res.json();
            if (data.success) setListings(data.listings);
        } catch (e) { /* the page says there is no open listing */ }
        finally { setListingsLoaded(true); }
    }, [studentId]);

    const fetchHistory = useCallback(async () => {
        if (!studentId) return;
        try {
            const res = await fetch(`${API}/api/student/${studentId}/consultation-requests`);
            const data = await res.json();
            if (data.success) setHistory(data.requests.filter((r) => FINISHED.includes(r.status)));
        } catch (e) { showAlert('Could not load your check-up history.', 'error'); }
    }, [studentId, showAlert]);

    useEffect(() => { fetchListings(); fetchHistory(); }, [fetchListings, fetchHistory]);

    const reloadAll = () => { refresh(); fetchHistory(); fetchListings(); };

    const openRequestForm = (listing) => {
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
        if (r.status === 'Denied') return r.review_reason ? `Declined by the clinic: ${r.review_reason}` : 'The clinic declined this request.';
        if (r.status === 'Missed') return 'Your number was skipped. Ask for a place in another listing or ask the nurse to accommodate you as a walk-in.';
        if (r.status === 'Fulfilled') return r.appointment_start ? `Seen on ${formatDateTime(r.appointment_start)} by Dr. ${r.appt_doc_first_name} ${r.appt_doc_last_name}.` : 'You were seen by the doctor.';
        return 'You withdrew this request.';
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
                    <p>Pick an open listing of a doctor's session and ask for a place. When the nurse accepts, you get a queue number for that session, in the order of acceptance. You can follow the number being served here and on your dashboard.</p>
                </div>
            </div>

            <section className="section-bc" aria-label="Open listings">
                <h3>Open listings</h3>
                {!listingsLoaded ? (
                    <div className="empty-bc">Loading...</div>
                ) : listings.length === 0 ? (
                    <div className="empty-bc">
                        <ClipboardList size={28} />
                        <p>No listing is open right now. The nurse opens a listing after a doctor sets a schedule. Please check back later.</p>
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
                                <div className="booking-line-bc"><Info size={14} /> {l.accepted} of {l.listing_limit} accepted</div>
                                {l.notes && <div className="muted-bc">{l.notes}</div>}
                                <div className="booking-actions-bc">
                                    <button type="button" className="btn-bc btn-primary-bc" disabled={!l.can_request} onClick={() => openRequestForm(l)}>
                                        {l.mine ? (l.mine.status === 'Waiting for Approval' ? 'Waiting for the nurse' : `Your number: #${l.mine.queue_no}`) : l.listing_full ? 'Listing full' : 'Ask for a place'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="section-bc" aria-label="My place in line">
                <h3>My place in line</h3>
                {loading ? (
                    <div className="empty-bc">Loading...</div>
                ) : appointments.length === 0 && active.length === 0 ? (
                    <div className="empty-bc">
                        <ClipboardList size={28} />
                        <p>You have no place yet. Choose "Ask for a place" on an open listing.</p>
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

            {history.length > 0 && (
                <section className="section-bc" aria-label="History">
                    <h3>History</h3>
                    <div className="stack-bc">
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

            {requestFor && (
                <div className="modal-overlay-bc" role="dialog" aria-modal="true" aria-labelledby="bc-request-title">
                    <form className="modal-bc" onSubmit={sendRequest}>
                        <div className="modal-header-bc">
                            <h3 id="bc-request-title">Ask for a place</h3>
                            <button type="button" className="close-bc" onClick={() => setRequestFor(null)} aria-label="Close"><X size={20} /></button>
                        </div>
                        <p className="request-help-bc" style={{ marginBottom: 12 }}>
                            {requestFor.doctor_name}, {formatDate(requestFor.date)}, {to12h(requestFor.start_time)} - {to12h(requestFor.end_time)}{requestFor.location ? ` (${requestFor.location})` : ''}.
                            The nurse reviews your request. You get your queue number only when it is accepted.
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
