# Function audit: Health Screening and Doctor Visit

Date: 2026-11-12. Branch: `redemo1`. Method: route cross-check (frontend calls vs backend routes), `react-scripts build` lint, `react-scripts test`, and a manual read of the backend handlers listed under "Covered". No code was changed.

Line numbers refer to `backend/src/database/connection.js` unless a file is named.

## Covered / not covered

Read in full: all `/api/screenings/*` handlers (create, edit, participants, cancel, delete, start, confirm-end, extend, reminders, students, scan-qr, attendance, document, result delete, refer, makeup, results), `screeningPhaseOf`, `markExpiredScreeningsAbsent`, `requireNurse`; walk-in, queue (snapshot, call-next, skip, restore, accommodate), `queue-status`, `checkup-history`, `POST /api/doctor-assessments` (+ delete, referral), follow-up (create, list, flag, dismiss), direct appointment, `consultation-requests/:id/accept`, `assertDirectFits`, `assertQueueFits`, `resolveActor`, session phase helpers.

Not read in depth: schedule CRUD and reschedule, schedule requests, advance listing, templates / standard form, doctor accounts, unavailable dates, patients, screening types / templates / folders / school-year CRUD bodies, and the page logic of `healthScreening.jsx`, `doctorVisits.jsx` and `ConsultationLists.jsx` (only lint was checked there).

## Systemic

| # | Severity | Finding |
|---|----------|---------|
| S1 | High | No authentication. Identity is `sender_id`, `nurse_id`, `created_by_doctor_id` or `student_user_id` taken from the request body or query. Anyone who can reach port 3001 can act as nurse or doctor by sending a known id. `resolveActor` (L10517) only reads the role of whatever id is sent. |
| S2 | High | Role checks are inconsistent. Only screening types, templates, folders, school years (`requireNurse`, L8343) and `consultation-requests/:id/accept` (L11997) check the role. Every other screening mutation and the doctor assessment delete / referral have none. |
| S3 | Medium | Hardcoded MySQL root password in source (L80). Known and "keep local-only", but it is committed. |
| S4 | Low | `cors()` registered twice (L32, L51); `express.json()` and `bodyParser.json()` both active (L50, L52). |

## Health Screening

| # | Severity | Where | Finding |
|---|----------|-------|---------|
| H1 | High | L8328-8340 | `markExpiredScreeningsAbsent` flips every `PENDING` participant to `ABSENT` as soon as `end_time` passes (cron every 5 min and at start). It ignores `end_confirmed_at` and the awaiting-end state that `confirm-end` / `extend` (L9347, L9363) are built around. A student still arriving while the nurse decides to extend is already `ABSENT`; extending does not undo it. Doctor check-ups handle this correctly with `AWAITING_END_SQL`. Fix: add `AND (s.end_confirmed_at IS NOT NULL OR s.scheduled_date < CURDATE())`. |
| H2 | High | `healthScreening.jsx` L375, 930, 949, 1015, 1081 | Handlers are defined but never used (build lint): `handleExportAllReport`, `handleSendReminders`, `overrideAttendance`, `handleDeleteResult`, `openRefer`. So Refer to Doctor (and its modal, L2522), manual attendance override, delete result, send reminders and export-all have no entry point in the UI. Their backend routes are unreachable from the app. Decide: restore the buttons or delete the dead code. |
| H3 | Medium | L9457-9488 | `GET /api/screenings/:id/students` selects `st.*` (all student columns) with no auth. Select only the columns the page needs. |
| H4 | Medium | L9313-9343 | `start` has no phase check. It can notify "starting now" for a screening that is upcoming, ended or days away. |
| H5 | Medium | L9063-9117 | Edit only blocks ended / cancelled. While ongoing, date and start time can be moved after students were marked present; not in a transaction. |
| H6 | Medium | L9539-9572 | Attendance override works on ended screenings (history rewrite), needs only a free-text reason, no auth, no audit row. |
| H7 | Medium | L9601-9697 | `document` has no phase check and uses `generateCustomId` without the connection / retry (L9649, L9666) combined with `ON DUPLICATE KEY UPDATE`. If two saves generate the same id, the second overwrites the first student's result row. Low probability with one nurse, but silent data corruption. |
| H8 | Medium | L9700-9714 | Delete result: no auth, no log, ignores an existing referral (`referral_appointment_id` stays on the participant). |
| H9 | Low | L9393-9441 | Reminder dedupe is an in-memory `Set`; a restart or the button plus the 07:00 cron can send twice. Date filter uses `CURDATE()` (server zone) while the rest uses Manila helpers. |
| H10 | Low | L9717-9791 | Refer: `nurse_id` not verified as a nurse, `duration_min` has no upper bound. |
| H11 | Low | L9501-9523 | `scan-qr` only blocks cancelled; it still marks present after the screening ended. `force` is a client flag. |

Good: create / participants / makeup are transactional and validate class, graduation, type state and duplicate make-ups; `results` derives ABSENT for ended pending rows consistently; abnormal-result notice fires once.

## Doctor Visit

| # | Severity | Where | Finding |
|---|----------|-------|---------|
| D1 | High | L15249-15555 | `POST /api/doctor-assessments` does not check that the student belongs to the appointment, that the student was `Present`, or that the caller is the appointment's doctor. After saving, `remaining = 0` also holds when nobody is `Present`, so the appointment is set `Completed` and the queue entry `Done` (L15510-15527). For a group appointment this closes it while other students are still `Pending`. |
| D2 | High | L15533-15545 | Notification text carries the diagnosis and recommendations to student and parents (and push). `student_user_id` is taken from the body, so the notice can be sent to any user id. Resolve the user from `student_id` and send a generic text. |
| D3 | Medium | L15560-15587 | Delete assessment: no auth, no reason, no `logAppointment` row, hard delete of dental / vision rows. A medical record can vanish with no trace. |
| D4 | Medium | L15438 | Editing an assessment overwrites `assessment_date` with `NOW()`; the original filing time is lost. |
| D5 | Medium | L16026-16029 | `accommodate` duplicate guard counts only `Waiting` / `Serving` children. After the first walk-in child is `Done`, the same void number can be accommodated again (second walk-in, second queue number). `restore` (L15964) counts `Done` too; make them consistent. |
| D6 | Medium | L16092-16151 | `queue-status` runs per-appointment queries (child lookup, schedule, snapshot, `sessionEndConfirmed`) and is polled every 10 s per open student dashboard. Batch the lookups or cache per schedule. |
| D7 | Medium | L15817, 15900, 15947 | Doctor ownership uses `created_by_doctor_id` from the body compared with the schedule's doctor. Correct logic, but only as strong as S1. |
| D8 | Low | L16228 | Follow-up create: `nurse_id` not verified as a nurse; `doctor_id` can be overridden from the body. |
| D9 | Low | L15690 | Walk-in has no cap per session (listing limit does not apply). Confirm this is intended. |
| D10 | Info | L11990-12057 | `accept` is the model to copy: role check, row locks, limit check after the schedule lock, advance-listing cleanup, notifications after commit. |

### Backend routes with no frontend caller (legacy / dead)

`POST /api/mass-schedules`, `PUT /api/doctor-schedules/:id/close`, `GET /api/doctor-visits`, `/folders`, `/groups`, `POST /api/doctor-visits/batch-start/:id`, `send-reminders`, `PUT batch-reschedule`, `PUT batch-cancel/:id`, `DELETE batch/:id`, `DELETE /api/doctor-visits/appointments`, `GET /api/doctor/:id/appointment-days`, `POST /api/consultation-requests/notify`, `GET .../categories`, `PUT .../:id/priority`, `PUT /api/student/consultation-requests/:id/reconfirm`, `POST /api/doctor-schedules/:id/auto-appoint`, `GET /api/doctor-schedules/announcements`, `DELETE /api/doctor-assessments/:a/:s`, `PUT /api/doctor-assessments/:a/:s/referral`.

Most are documented as "kept for old rows". They still run unauthenticated code on live tables; remove or guard them. The two `doctor-assessments` routes are not documented as legacy and are not called by any page, so the D3 risk is reachable only by direct API calls.

## Tests and build

- `react-scripts build`: compiles; only warnings are the five unused handlers in H2 plus unused import `FolderPlus` (`healthScreening.jsx` L7).
- `react-scripts test`: 2 suites, 5 failed / 3 passed.
  - `src/App.test.js`: default CRA test, fails (`useNavigate()` outside a Router). Delete or fix.
  - `src/components/scheduling/queue.smoke.test.jsx`: 4 of 5 failures are "Unable to find text" (`Call next`, `Time in`, `cough`, `fever`). Likely stale after the icon-only buttons and alert-modal UI rule; cause not confirmed.
- Backend has no tests, so every finding above is from reading the code, not from running it.

## Suggested order

1. H1 (data loss on every extend flow), D1 (wrong Completed state), D2 (diagnosis leak).
2. S1 / S2: real login token and a shared `requireRole(...)` on every mutation.
3. H2: restore or remove the dead screening actions; D3 / H8: audit rows for deletes.
4. Remove legacy routes; fix or delete the two stale test files.
