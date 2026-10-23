# AGENTS.md

## Structure
- `backend/src/database/connection.js` — the entire Express API + MySQL pool + listen. `backend/src/routes/server.js` is dead commented-out code; `backend/src/services/` (`login.js`, `forgotpassword.js`) is unused. Do not add routes elsewhere.
- `frontend/src/index.js` — all routes (`/` landing `App.js`, `/Login`, nurse/*, student/*, parent/* under layout wrappers). `frontend/src/pages|components|layout|hooks|utils` per role.
- DB schema source: `cms schema (1).sql`. MySQL database `ClinicManagementSystem` required locally; no migrations, no ORM, raw `mysql2/promise` queries.
- No monorepo tooling, no tests in backend (`npm test` just errors), no lint/typecheck config, no CI.

## Doctor portal
- Role `DCTR` (`roles`), accounts are created by the nurse (`/ManageDoctorAccounts`, `POST /api/doctor-accounts`): default password `"123"`, `doctors.user_id` links the login. On first login `DoctorLayout` blocks the portal until the doctor saves a phone number (`PUT /api/doctor/phone` sets `phone_confirmed_at`); that number is the forgot-password identifier for doctors.
- Routes `/DoctorDashboard`, `/DoctorAppointments`, `/DoctorMySchedule` (not `/DoctorSchedule`, that is a nurse redirect), `/DoctorConsultations`, `/DoctorPatients`, `/DoctorTemplates`, `/DoctorProfile` under `frontend/src/layout/doctorLayout.jsx`; pages in `frontend/src/pages/doctor`, shared pieces in `frontend/src/components/doctor`.
- Visit purposes are `General Check Up | Dental | Vision | Other` (+ system `Follow-up`, `Referral`); `Other` needs `purpose_other`. Use `frontend/src/utils/visitPurpose.js` (`visitLabel`) to display them.
- Scheduling types: direct appointment (`POST /api/doctor-appointments/direct`, custom time block), open time block (`doctor_schedules`, `auto_confirm` decides whether bookings need approval), walk-in. Cancel / decline / reschedule require a reason and every change is written to `doctor_appointment_logs` (`logAppointment`). `doctor_unavailable_dates` blocks booking.
- DB changes live in `migration_doctor_role_portal.sql` (run after `migration_doctor_schedule_booking.sql`, idempotent, use `--default-character-set=utf8mb4`).

## Backend (`backend/`, CommonJS)
- Run: `cd backend && npm start` → `nodemon src/database/connection.js`, serves on port **3001** (`app.listen(3001)` at file end).
- Needs `backend/.env` (gitignored-ish, exists locally): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `IPROG_API_TOKEN`, `IPROG_SMS_ENDPOINT`, `DEFAULT_COUNTRY_CODE`. Never commit real values; code has hardcoded MySQL creds (`root` / `Yahweh0512` @ `localhost`) — keep local-only.
- Single ~9000-line file: search by `app.get|app.post|app.put|app.delete` section headers (login, profile, requirements, clinic-visits, incident-reports, inventory, notifications, push-subscriptions, messages). Add new endpoints inline there.
- Uploads: multer `diskStorage` to `backend/uploads/`, served at `/uploads`; file URLs built as `http://localhost:3001/uploads/...`.
- SMS: Twilio client initialized but visit/incident alerts send via iProg (`sendIprogSms`, form-urlencoded, PH numbers normalized to `09XXXXXXXXX`). Web push via `web-push` + `push_subscriptions` table; note codebase mixes `webpush.sendNotification` (correct) and `webpush.sendPushNotification` (broken) — use `sendNotification`.
- Passwords are bcrypt hashes in `users.password_hash` (`backend/src/utils/security.js`: `hashPassword` / `verifyPassword`; login still upgrades any leftover plaintext row). Default password is `"123"` (login returns `isDefaultPassword` from the typed password). Always `await hashPassword()` before writing `password_hash`.
- `messages.content` is AES-256-GCM encrypted (`enc:v1:` prefix) via `encryptText` on insert and `decryptMessageRows` on every read. Key is `MESSAGE_ENCRYPTION_KEY` in untracked `backend/.env.local` (losing it makes stored messages unreadable; back it up). `notifyUsers` stores a generic text for `MESSAGE` notifications. One-time migration: `node backend/scripts/encryptExistingData.js` (idempotent).

## Frontend (`frontend/`, CRA + React 18 + react-router-dom v6)
- Run: `cd frontend && npm start` (CRA dev server, port 3000). `npm run dev` / `vite` scripts exist but repo is CRA (`react-scripts`, `src/index.js`, `App.js`); prefer `npm start` and `npm run build` / `npm test` (react-scripts).
- API base is hardcoded `http://localhost:3001` per-fetch (only `studentDashboard.jsx` honors `VITE_API_BASE_URL`). Keep hardcoded pattern; `backend/package.json` `"proxy"` field is ineffective for this setup. Both servers must run.
- Auth state in `localStorage` (`userId`, role ids); role routing by `role_id`/`role` from `/api/login`.
- Styling: per-page CSS in `src/styles/` + Tailwind v4 (`@tailwindcss/vite`) + `lucide-react` icons.


