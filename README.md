# SUST CSE Class & Exam Coordination System

A full-stack, role-based academic coordination system for the SUST CSE department, built with:

- **Backend:** Node.js, Express, SQLite (via `better-sqlite3`), JWT auth, bcrypt password hashing
- **Frontend:** React (Vite), Tailwind CSS, React Router

Four roles — **Student**, **CR (Class Representative)**, **Teacher**, **Administration** — each with
their own dashboard. Role-based access control (RBAC) is enforced **on the backend**, on every route,
not just by hiding UI buttons: a Student/CR/Teacher token can never successfully call an `/api/admin/*`
route (it gets a `403`), and a CR can never touch another section's data because every CR query is
scoped server-side to that CR's own batch/section from their authenticated profile.

## Project structure

```
sust-cse-system/
├── backend/          Express API + SQLite database
│   ├── db/            schema + seed data (db.js) — the .sqlite file is created here on first run
│   ├── middleware/     auth (JWT + RBAC) and file-upload (multer) middleware
│   ├── routes/         auth, students, cr, teacher, admin route handlers
│   └── server.js       entry point
└── frontend/         React + Vite app
    └── src/
        ├── pages/       Login, Register, ForgotPassword, and the 4 role dashboards
        ├── components/  shared UI (dashboard shell, alerts, badges, loaders)
        ├── context/     AuthContext (session/token storage)
        └── api.js       thin fetch wrapper for the backend API
```

## Running it locally

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # optionally change JWT_SECRET
npm start                  # runs on http://localhost:4000
```

On first run it creates `backend/db/sust_cse.sqlite`, seeds a default admin account, and seeds a
handful of sample courses.

**Default admin login:** username `admin`, password `admin123` — **change this immediately** by
adding a way to update it, or by editing the `users` row directly, before using this anywhere real.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                # runs on http://localhost:5173, proxies /api to :4000
```

Open `http://localhost:5173`.

- **Students / CRs / Teachers** sign in and register from the main page (`/`).
- **Administration** signs in from a separate, unlinked route: `http://localhost:5173/portal-admin`.
  This page is intentionally not linked from anywhere in the student/CR/teacher UI, per the
  "admin panel must be completely hidden from normal users" requirement.

## How the core workflows map to the requirements

- **Student registration → Admin approval → login.** New students register as `pending`; they cannot
  log in until Administration approves them from the "Student Approvals" tab.
- **CR creates a class/exam/extra class → goes to the selected teacher as "pending" → teacher
  Approves/Rejects.** Only once approved does it appear on students' "Tomorrow's Routine" / "Upcoming
  Exams" views. A background job (`server.js`, checked every 5 minutes) auto-cancels any request that's
  still pending once its date arrives — the CR sees it flip to "Auto-cancelled" in "My Requests".
- **Room-availability check** happens server-side before an extra class is created (`POST
  /api/cr/extra-class`), rejecting overlapping bookings in the same room.
- **Drop-course routine.** If a student marked "Yes" with a course code at registration, their
  dashboard shows the routine for that course wherever else it's taught (typically a junior batch), in
  addition to their own batch's routine.
- **Passwords** are hashed with bcrypt everywhere (student self-registration, CRs and teachers added by
  Admin, and the admin account itself). Password reset is token-based (`/api/auth/forgot-password` →
  `/api/auth/reset-password`); wire the returned token into an actual email/SMS provider for production
  use instead of returning it in the API response as this demo does.
- **A CR is just a Student record with `is_cr = 1`.** Logging in with CR credentials issues a JWT with
  role `cr`, which unlocks the CR-only routes (`/api/cr/*`) in addition to the shared student routes
  (`/api/students/*`) — so a CR can also see their own "student" views (materials, directory, notices).

## Notes on scope / what to harden before production

This was built as a complete, working reference implementation of everything in the spec, using SQLite
for portability. Before real deployment you'd want to:

- Swap SQLite for MySQL/PostgreSQL (the `better-sqlite3` calls in `backend/db/db.js` are close to
  drop-in-replaceable with `pg` or `mysql2`, but connection pooling and migrations should be added).
- Send password-reset tokens by email instead of returning them in the API response.
- Add rate limiting / login throttling, HTTPS, and a production `JWT_SECRET`.
- Add pagination to the "All Students" / "Directory" endpoints once batch sizes grow large.
- Uploaded files currently save to `backend/uploads/` on local disk — move to S3-compatible storage for
  a real multi-instance deployment.
