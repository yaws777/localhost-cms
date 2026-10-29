# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

The imported `AGENTS.md` is the source of truth for structure, commands, ports, the doctor/scheduling domain rules and backend/frontend conventions. Keep project facts there; do not duplicate them here.

## Quick commands
- Backend: `cd backend && npm start` (nodemon, port 3001). Frontend: `cd frontend && npm start` (CRA, port 3000). Both must run; MySQL database `ClinicManagementSystem` must exist locally.
- Frontend build/tests: `cd frontend && npm run build` / `npm test` (react-scripts). Backend has no tests, lint or typecheck.
- SQL migrations are run by hand, in the order named in `AGENTS.md`, with `--default-character-set=utf8mb4`.

## Working rules
- New endpoints go inline in `backend/src/database/connection.js`; new routes in `frontend/src/index.js`.
- Replies and commit messages: follow the Caveman style (terse) when the plugin is active, but never apply it to code, SQL, commit bodies or file contents.
