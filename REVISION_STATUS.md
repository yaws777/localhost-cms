# Revision status (sections A to J of REVISION_PROMPT.md)

Everything below is in the working tree. **Nothing is committed.**

## Run order for the database changes

Take a backup first (`mysqldump ClinicManagementSystem > backup.sql`). Each file is safe to re-run (checked: every file was run twice without errors).

```
mysql --default-character-set=utf8mb4 -u root < migration_doctor_dental_vision.sql
mysql --default-character-set=utf8mb4 -u root < migration_doctor_schedule_booking.sql
mysql --default-character-set=utf8mb4 -u root < migration_health_screening_transactions.sql
mysql --default-character-set=utf8mb4 -u root < migration_restock_reports.sql
```

The `--default-character-set=utf8mb4` flag matters: without it the CHECK constraint texts are stored in the console charset.
They run on top of the existing medicine migrations (`migration_dispense_limit_and_condition.sql` and the other `migration_*.sql` files that were already in the repo).
Pre-migration dumps made along the way are in `backups/` (do not commit them).

## Status per item

| Item | Status | Notes |
|---|---|---|
| **A** Dental/Vision moved to Doctor Visits | Done | New visit types, dental and vision assessment forms and tables, legacy records kept and labelled "(legacy)". Health Screening now offers BMI, Vital Signs, Hearing. Optional extras (Scoliosis, Lab) were **not** added. |
| **B** Doctor schedule and booking | Done | Doctor Schedule page, student "Book a Check-up", approve/decline, server-side conflict checks. Parents see bookings in the existing Doctor Visits tab of Child Clinic Records (no separate parent page). **Behaviour change:** a mass batch is rejected unless the doctor has an open schedule covering it. |
| **C** Doctor Visit transactions (12) | Done | Walk-in, per-student reschedule/cancel, attendance with reasons (Excused), follow-up, referral slip, edit/delete assessment with audit fields, printable certificate and summary, parent notifications, student history, Start/Reminders wired, dead fallback removed, notification routing fixed. |
| **D** Health Screening transactions (11) | Done | Edit/delete result, refer to doctor, make-up session, attendance override with reason, soft-cancel, announcement saved, Start/Reminders (also daily cron), parent notification, results report + CSV, student history, one-transaction create. |
| **E** "Error when presenting" | Done | Root cause: the participants query joined the result table and its NULL `student_id` overwrote the real one, so documenting a present student sent a null id. Also fixed: present counts, duplicate rows (unique keys), BMI 29.9 boundary, server-side BMI, `res.ok` guards, absences by a job instead of inside GET. |
| **F** Folders and paging | Done | Program > Year-Section folders (plus Walk-ins & Individual, and All) for both pages, server-side pagination and search, participants lists paged and searchable. A batch appears in the folder of every section it has students from. |
| **G** Automated low-stock report | Done | Per-medicine status (expired stock excluded), daily 7:00 AM report, check after every stock change and every 15 minutes, history tables, nurse + admin notifications once per worsening, Restock Report page with print, dashboard uses the same numbers. The admin account has no screen of its own, so the page lives in the nurse portal. |
| **H** 30-day forecast only | Done | Monthly baseline fields and the month picker removed; live usable stock; restock suggestion = forecast + critical level - stock. The monthly stock snapshot cron job was left in place (nothing uses it now). |
| **I** Trends, weekly report, illness summary | Done | Daily/Weekly/Monthly on the dashboard and on the Weekly Reports page, every visit counted with distinct students, doctor diagnoses as a second source, past-30-days illness summary, incidents counted, PDF with tables and bars. **Lab results are not included: there is no lab table in the system.** |
| **J** Quality | Done, see below | |

## Section J checks

- **Migrations:** all four run twice, no errors.
- **Production build:** `react-scripts build` compiled. Only warnings left are old ones outside this work (an unused constant in `utils/datetime.js` and a hook-dependency warning in `healthScreening.jsx`).
- **API regression:** the B/C suite (64 checks) and the D/E suite (56 checks) were re-run after all later changes and passed. The old section A suite no longer applies as written, because mass batches now need a doctor schedule (that is the B6 rule working).
- **Student and parent pages:** student dashboard, Clinic Logs (Health Screening and Doctor Visits tabs, with the new visit type and flags) and parent Child Clinic Records load and show data.
- **QR attendance:** Health Screening (manual ID) and Doctor Visits (manual ID) both mark Present. Fixed along the way: the Doctor Visits scanner used to close itself when the camera was unavailable, which made manual entry impossible.
- **Phones (390px wide):** found that every nurse page pushed the page sideways because `.main-content` could not shrink. Added `min-width: 0` to the nurse, student and parent layouts, plus wrapping rules for the Doctor Visits, Health Screening and Weekly Reports headers and tabs. Doctor Visits, Health Screening, Doctor Schedule, Restock Report, Weekly Reports, Medicine Inventory, Book a Check-up and the student dashboard now fit. **The nurse dashboard is still about 800px wide on a phone** (it was already like that, and was not part of this work).

## Not verified (could not or did not test)

- The print / save-as-PDF windows (weekly report, restock report, medical certificate, referral slip, results report) and the CSV download were not opened. The data behind them was checked.
- Push notifications were sent by the server but delivery to a real browser was not checked.
- Camera QR scanning was not possible in the test browser (manual entry was tested).
- The dental and vision assessment forms were tested through the API but not clicked through in the browser.
- The first real 7:00 AM restock report and reminder jobs will run for the first time tomorrow.

## Files

New: `migration_doctor_dental_vision.sql`, `migration_doctor_schedule_booking.sql`, `migration_health_screening_transactions.sql`, `migration_restock_reports.sql`, `frontend/src/pages/nurse/doctorSchedule.jsx`, `frontend/src/pages/nurse/restockReport.jsx`, `frontend/src/pages/student/bookCheckup.jsx`, `frontend/src/components/common/RecordFolders.jsx` and their CSS files, `REVISION_PROMPT.md`, this file.

Changed (main ones): `backend/src/database/connection.js` (all endpoints and jobs), `doctorVisits.jsx`, `healthScreening.jsx`, `nurseDashboard.jsx`, `weeklyReports.jsx`, the nurse/student/parent layouts, `index.js`, `clinicLogs&Records.jsx`, and the matching CSS.
Other modified files in `git status` (dispensed medicine, inventory, etc.) were already changed before this work.

## Project notes

`AGENTS.md` says the project has no migrations. It now has four more `migration_*.sql` files that must be run in the order above on any other copy of the database.
