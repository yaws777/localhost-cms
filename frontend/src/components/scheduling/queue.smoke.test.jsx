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
        { appointment_id: 'A2', lane: 'Listed', queue_no: 2, label: '#2', state: 'Serving', student_id: 's2', student_name: 'John Doe', visit_type: 'General Check Up', arrived: 1, documented: 0 },
        { appointment_id: 'A3', lane: 'Listed', queue_no: 3, label: '#3', state: 'Waiting', student_id: 's3', student_name: 'Mico Bernardo', visit_type: 'General Check Up', arrived: 0, documented: 0 },
        { appointment_id: 'A4', lane: 'Walk-in', queue_no: 1, label: 'W1', state: 'Waiting', student_id: 's1', student_name: 'Alberto Siason', visit_type: 'General Check Up', arrived: 1, documented: 0, is_walk_in: 1 }
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

test('the doctor sees the queue with Call next, Void, Walk-in and the void number kept in the list', async () => {
    global.fetch = jest.fn(() => json({ success: true, queue: QUEUE }));
    wrap(<QueuePanel scheduleId="S1" date="2026-10-29" creator={{ doctorId: 'DOC1' }} userId="U1" intervalMs={60000} onWalkIn={() => {}} />);
    await waitFor(() => expect(screen.getByText('Call next')).toBeInTheDocument());
    expect(screen.getByText('W1', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('Walk-in', { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText('In session')).toBeInTheDocument(); // the state of the number being served
    expect(screen.getAllByRole('button', { name: /^Void$/ }).length).toBe(2); // the waiting listed number and the waiting walk-in
    expect(screen.queryByText('Skip')).toBeNull();
    expect(screen.getAllByText('Void and call next').length).toBe(1); // the serving number
    expect(screen.getByText('Accommodated as W1')).toBeInTheDocument();
});

test('the nurse does not get Call next or Void, only Time in', async () => {
    global.fetch = jest.fn(() => json({ success: true, queue: QUEUE }));
    wrap(<QueuePanel scheduleId="S1" date="2026-10-29" creator={{ nurseId: 'N1' }} userId="U2" intervalMs={60000} />);
    await waitFor(() => expect(screen.getByText('Now in session')).toBeInTheDocument());
    expect(screen.queryByText('Call next')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Void/ })).toBeNull();
    expect(screen.getAllByText(/Time in/).length).toBeGreaterThan(0);
});

test('the listing of a schedule shows its limit and the asks waiting for the nurse', async () => {
    const SESSION = {
        schedule_id: 'S1', doctor_id: 'DOC1', doc_first_name: 'Ana', doc_last_name: 'Reyes', visit_type: 'General Check Up', start_time: '09:00:00', end_time: '12:00:00',
        listing_date: '2026-10-30', listing_open: true, listing_limit: 5, accepted: 2, pending: 1, listing_full: false, is_expired: false
    };
    global.fetch = jest.fn((url) => {
        if (String(url).includes('/api/doctor-schedules')) return json({ success: true, schedules: [SESSION] });
        if (String(url).includes('/api/consultation-requests')) {
            return json({
                success: true, requests: [
                    { request_id: 'R1', student_id: 's1', student_first_name: 'Alberto', student_last_name: 'Siason', visit_type: 'General Check Up', status: 'Waiting for Approval', reason: 'cough', created_at: '2026-10-27 08:00:00', listing_schedule_id: 'S1', listing_date: '2026-10-30' },
                    { request_id: 'R2', student_id: 's2', student_first_name: 'John', student_last_name: 'Doe', visit_type: 'General Check Up', status: 'Appointed', appointment_queue_no: 1, appointment_queue_lane: 'Listed', reason: 'fever', created_at: '2026-10-27 09:00:00', listing_schedule_id: 'S1', listing_date: '2026-10-30' },
                    { request_id: 'R3', student_id: 's3', student_first_name: 'Mico', student_last_name: 'Bernardo', visit_type: 'Dental', status: 'Waiting for Approval', reason: 'tooth', created_at: '2026-10-28 09:00:00', listing_schedule_id: 'S9', listing_date: '2026-10-30' }
                ]
            });
        }
        return json({ success: true });
    });
    wrap(<WaitingList doctors={[]} creator={{ nurseId: 'N1' }} userId="U2" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText('cough')).toBeInTheDocument());
    expect(screen.getByText('2 of 5 accepted')).toBeInTheDocument();
    expect(screen.queryByText('tooth')).toBeNull(); // another schedule's listing
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Close listing')).toBeInTheDocument();
});

test('the doctor sees only the accepted students of a listing, no To accept list', async () => {
    const SESSION = {
        schedule_id: 'S1', doctor_id: 'DOC1', doc_first_name: 'Ana', doc_last_name: 'Reyes', visit_type: 'General Check Up', start_time: '09:00:00', end_time: '12:00:00',
        listing_date: '2026-10-30', listing_open: true, listing_limit: 5, accepted: 1, pending: 1, listing_full: false, is_expired: false
    };
    global.fetch = jest.fn((url) => {
        if (String(url).includes('/api/doctor-schedules')) return json({ success: true, schedules: [SESSION] });
        if (String(url).includes('/api/consultation-requests')) {
            return json({
                success: true, requests: [
                    { request_id: 'R1', student_id: 's1', student_first_name: 'Alberto', student_last_name: 'Siason', visit_type: 'General Check Up', status: 'Waiting for Approval', reason: 'cough', created_at: '2026-10-27 08:00:00', listing_schedule_id: 'S1', listing_date: '2026-10-30' },
                    { request_id: 'R2', student_id: 's2', student_first_name: 'John', student_last_name: 'Doe', visit_type: 'General Check Up', status: 'Appointed', appointment_queue_no: 1, appointment_queue_lane: 'Listed', reason: 'fever', created_at: '2026-10-27 09:00:00', listing_schedule_id: 'S1', listing_date: '2026-10-30' }
                ]
            });
        }
        return json({ success: true });
    });
    wrap(<WaitingList doctors={[]} fixedDoctorId="DOC1" creator={{ doctorId: 'DOC1' }} userId="U1" refreshKey={0} />);
    await waitFor(() => expect(screen.getByText('fever')).toBeInTheDocument());
    expect(screen.queryByText('cough')).toBeNull(); // still waiting for the nurse
    expect(screen.queryByText(/To accept/)).toBeNull();
    expect(screen.queryByText('Accept')).toBeNull();
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
