// Smoke tests of the waiting list / session queue screens: they render with the shapes the API returns and show the numbers.
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AlertProvider } from '../../context/AlertContext';
import MyQueue from '../student/MyQueue';
import QueuePanel from './QueuePanel';
import WaitingList from './WaitingList';
import ScheduleRequests from './ScheduleRequests';

const json = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

const QUEUE = {
    schedule_id: 'S1', date: '2026-10-29', minutes_per_patient: 15, capacity: 10,
    now_serving: { lane: 'Listed', queue_no: 2, label: '#2', student_name: 'John Doe', appointment_id: 'A2' },
    listed_waiting: 1, walkin_waiting: 1,
    entries: [
        { appointment_id: 'A1', lane: 'Listed', queue_no: 1, label: '#1', state: 'Void', student_id: 's1', student_name: 'Alberto Siason', visit_type: 'General Check Up', arrived: 0, documented: 0, accommodated_as: 'W1' },
        { appointment_id: 'A2', lane: 'Listed', queue_no: 2, label: '#2', state: 'Serving', student_id: 's2', student_name: 'John Doe', visit_type: 'General Check Up', arrived: 1, has_vitals: 1, documented: 0 },
        { appointment_id: 'A3', lane: 'Listed', queue_no: 3, label: '#3', state: 'Waiting', student_id: 's3', student_name: 'Mico Bernardo', visit_type: 'General Check Up', arrived: 0, documented: 0 },
        { appointment_id: 'A4', lane: 'Walk-in', queue_no: 1, label: 'W1', state: 'Waiting', student_id: 's1', student_name: 'Alberto Siason', visit_type: 'General Check Up', arrived: 1, has_vitals: 1, documented: 0, is_walk_in: 1 }
    ]
};

const wrap = (ui) => render(<MemoryRouter><AlertProvider>{ui}</AlertProvider></MemoryRouter>);

afterEach(() => { jest.restoreAllMocks(); });

test('student sees the waiting list number, the queue number and the number being served', () => {
    render(
        <MyQueue
            requests={[{ request_id: 'R1', visit_type: 'Dental', queue_no: 5, queue_position: 2, queue_total: 6, status: 'Waiting List' }]}
            appointments={[{
                appointment_id: 'A3', visit_type: 'General Check Up', doctor_name: 'Dr. Alvin Ligutan', date: '2026-10-29', session_start: '08:00:00', session_end: '12:00:00',
                lane: 'Listed', queue_no: 3, label: '#3', state: 'Waiting', in_session: 1, now_serving: '#2', ahead: 1, est_wait_min: 15
            }]}
        />
    );
    expect(screen.getByLabelText('Your queue number #3')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument(); // now serving
    expect(screen.getByText('1 ahead of you')).toBeInTheDocument();
    expect(screen.getByText('Position 2 of 6')).toBeInTheDocument();
    expect(screen.getByLabelText('Waiting list number 5')).toBeInTheDocument();
});

test('a skipped number tells the student to be accommodated as a walk-in', () => {
    render(<MyQueue appointments={[{
        appointment_id: 'A1', visit_type: 'General Check Up', doctor_name: 'Dr. X', date: '2026-10-29', session_start: '08:00:00', session_end: '12:00:00',
        lane: 'Listed', queue_no: 1, label: '#1', state: 'Void', in_session: 1, now_serving: '#2', ahead: 0
    }]} />);
    expect(screen.getByText('Your number was skipped')).toBeInTheDocument();
});

test('the doctor sees the queue with Call next, no Void, no Add walk-in and the void number kept in the list', async () => {
    global.fetch = jest.fn(() => json({ success: true, queue: QUEUE }));
    wrap(<QueuePanel scheduleId="S1" date="2026-10-29" creator={{ doctorId: 'DOC1' }} userId="U1" intervalMs={60000} onWalkIn={() => {}} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Call next' })).toBeInTheDocument());
    expect(screen.getByText('W1', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add walk-in' })).toBeNull(); // only the nurse records walk-ins
    expect(screen.queryByRole('button', { name: /Scan QR/ })).toBeNull();
    expect(screen.getByText('In session', { selector: '.q-pill-sc' })).toBeInTheDocument(); // the number being served has its time in
    expect(screen.queryByRole('button', { name: /^Void$/ })).toBeNull(); // void is the nurse's
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument(); // the called number can be skipped when the student is not in the room, even after the time in
    expect(screen.queryByRole('button', { name: /Time in/ })).toBeNull(); // nobody is called without a time in
    expect(screen.getByText('Walk-in W1')).toBeInTheDocument(); // the void student came back as a walk-in
});

test('a called number waits for the time in: the doctor skips it and calls a skipped number again', async () => {
    const CALLED = {
        ...QUEUE,
        entries: [
            { appointment_id: 'A1', lane: 'Listed', queue_no: 1, label: '#1', state: 'Void', skipped: 1, student_id: 's1', student_name: 'Alberto Siason', visit_type: 'General Check Up', arrived: 0, documented: 0 },
            { appointment_id: 'A2', lane: 'Listed', queue_no: 2, label: '#2', state: 'Serving', student_id: 's2', student_name: 'John Doe', visit_type: 'General Check Up', arrived: 0, documented: 0 },
            { appointment_id: 'A3', lane: 'Listed', queue_no: 3, label: '#3', state: 'Waiting', student_id: 's3', student_name: 'Mico Bernardo', visit_type: 'General Check Up', arrived: 1, has_vitals: 1, documented: 0 }
        ]
    };
    global.fetch = jest.fn(() => json({ success: true, queue: CALLED }));
    wrap(<QueuePanel scheduleId="S1" date="2026-10-29" creator={{ doctorId: 'DOC1' }} userId="U1" intervalMs={60000} />);
    await waitFor(() => expect(screen.getByText('Called', { selector: '.q-pill-sc' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Time in' })).toBeNull(); // the time in with the vital signs is the nurse's
    expect(screen.getByText("Waiting for the nurse's time in")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Void' })).toBeNull();
    expect(screen.getAllByText('Skipped').length).toBeGreaterThan(0);
    // another number can be called while this one waits for the time in: the called number is skipped by that call
    expect(screen.getByRole('button', { name: 'Call' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Call next' })).toBeEnabled();
});

test('the doctor cannot call a number whose vital signs the nurse has not recorded', async () => {
    const NO_VITALS = { ...QUEUE, now_serving: null, entries: QUEUE.entries.filter((e) => e.state === 'Waiting').map((e) => ({ ...e, arrived: 0, has_vitals: 0 })) };
    global.fetch = jest.fn(() => json({ success: true, queue: NO_VITALS }));
    wrap(<QueuePanel scheduleId="S1" date="2026-10-29" creator={{ doctorId: 'DOC1' }} userId="U1" intervalMs={60000} />);
    await waitFor(() => expect(screen.getAllByText("Waiting for the nurse's time in").length).toBe(2));
    expect(screen.getByRole('button', { name: 'Call next' })).toBeDisabled();
});

test('the nurse times in the called number and voids, but cannot call or skip', async () => {
    const CALLED = { ...QUEUE, entries: QUEUE.entries.map((e) => (e.appointment_id === 'A2' ? { ...e, arrived: 0 } : e)) };
    global.fetch = jest.fn(() => json({ success: true, queue: CALLED }));
    wrap(<QueuePanel scheduleId="S1" date="2026-10-29" creator={{ nurseId: 'N1' }} userId="U2" intervalMs={60000} onWalkIn={() => {}} />);
    await waitFor(() => expect(screen.getByText('Called - waiting for time in')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Call next' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Void' }).length).toBe(3); // the called #2, the waiting #3 and the waiting W1
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Time in' }).length).toBe(2); // the called #2 and the waiting #3; W1 already timed in
    expect(screen.getByRole('button', { name: 'Add walk-in' })).toBeInTheDocument();
});

test('the listing of a schedule shows its limit, with no review step', async () => {
    const SESSION = {
        schedule_id: 'S1', doctor_id: 'DOC1', doc_first_name: 'Ana', doc_last_name: 'Reyes', visit_type: 'General Check Up', start_time: '09:00:00', end_time: '12:00:00',
        listing_date: '2026-10-30', listing_open: true, listing_limit: 5, accepted: 2, pending: 0, places_left: 3, listing_full: false, is_expired: false
    };
    global.fetch = jest.fn((url) => {
        if (String(url).includes('/api/doctor-schedules')) return json({ success: true, schedules: [SESSION] });
        return json({ success: true, sessions: [] });
    });
    wrap(<WaitingList doctors={[]} creator={{ nurseId: 'N1' }} userId="U2" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText('2/5')).toBeInTheDocument());
    expect(screen.queryByText('To review')).toBeNull();
    expect(screen.queryByText('Accept')).toBeNull();
    expect(screen.getByRole('switch')).toBeInTheDocument();
});

test('the doctor sees the listing of a schedule but cannot open or close it', async () => {
    const SESSION = {
        schedule_id: 'S1', doctor_id: 'DOC1', doc_first_name: 'Ana', doc_last_name: 'Reyes', visit_type: 'General Check Up', start_time: '09:00:00', end_time: '12:00:00',
        listing_date: '2026-10-30', listing_open: true, listing_limit: 5, accepted: 1, pending: 0, places_left: 4, listing_full: false, is_expired: false
    };
    global.fetch = jest.fn((url) => {
        if (String(url).includes('/api/doctor-schedules')) return json({ success: true, schedules: [SESSION] });
        return json({ success: true, sessions: [] });
    });
    wrap(<WaitingList doctors={[]} fixedDoctorId="DOC1" creator={{ doctorId: 'DOC1' }} userId="U1" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText('1/5')).toBeInTheDocument());
    expect(screen.queryByText(/To review|To accept/)).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
});

test('the doctor sees the pending schedule request and can set it', async () => {
    global.fetch = jest.fn(() => json({
        success: true, requests: [{
            schedule_request_id: 'SR1', doctor_id: 'DOC1', visit_type: 'Dental', preferred_date: '2026-10-30', preferred_start: '09:00:00', preferred_end: '12:00:00',
            note: '5 students waiting', status: 'Pending', nurse_first_name: 'Nina', nurse_last_name: 'Nurse'
        }]
    }));
    wrap(<ScheduleRequests role="doctor" fixedDoctorId="DOC1" userId="U1" refreshKey={0} onSetSchedule={() => {}} />);
    await waitFor(() => expect(screen.getByText('Set schedule')).toBeInTheDocument());
    expect(screen.getByText('Decline')).toBeInTheDocument();
    expect(screen.getByText('5 students waiting')).toBeInTheDocument();
});
