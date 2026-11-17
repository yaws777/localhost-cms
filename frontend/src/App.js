import { useState } from "react";
import { useNavigate } from "react-router";
import {
  FileText,
  UserCheck,
  CalendarCheck,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  BarChart2,
  Stethoscope,
  Lightbulb,
  Smartphone,
  FileCheck,
  Package,
  Pill,
  Shield,
  Send,
  ClipboardCheck,
  MessageSquare,
  LayoutGrid,
  Check,
  ChevronDown,
  LogIn,
  ArrowDown,
  Moon,
  Sun,
  HeartPulse,
  GraduationCap,
  Users,
  Target,
} from "lucide-react";
import logo from "./assets/sti-logof.png"; // Adjust path if your image is located elsewhere (e.g., ./assets/logo.png)
import "./styles/App.css";
import { formatCurrentDate } from "./utils/datetime";
import { useTheme } from "./context/ThemeContext";

const groups = [
  { id: "records", label: "Records" },
  { id: "clinic", label: "Clinic care" },
  { id: "insights", label: "Insights & stock" },
  { id: "access", label: "Requests & access" },
];

const portals = [
  { icon: ClipboardList, role: "Nurse", what: "Runs visits, stock and reports" },
  { icon: Stethoscope, role: "Doctor", what: "Sets schedules, runs the check-up queue" },
  { icon: GraduationCap, role: "Student", what: "Completes records, joins the queue" },
  { icon: Users, role: "Parent", what: "Gets SMS alerts, views clinic logs" },
];

const objectives = [
  {
    group: "records",
    icon: FileText,
    title: "Health Record & Requirements Monitoring",
    summary: "Student profiles and per-course requirements.",
    description: "Enable the school nurse to retrieve student health profiles — including personal info, emergency contacts, chronic conditions, and allergies — and monitor health requirements per course/strand (e.g., vaccines for Hospitality Management), plus view clinic visit history, medicine requests, and incident reports.",
  },
  {
    group: "records",
    icon: UserCheck,
    title: "Student Health Record Completion",
    summary: "Students fill in and upload their own records.",
    description: "Allow students to fill up and complete their health records including personal information, health information (chronic conditions & allergies), and emergency contacts. Students can also monitor and upload their course requirements.",
  },
  {
    group: "records",
    icon: FileCheck,
    title: "Student Requirement Management",
    summary: "Set deadlines and flag resubmissions.",
    description: "Enable nurses to add and manage health requirements for specific students, set submission deadlines, and add notes for requirements needing resubmission — with full tracking per course and strand.",
  },
  {
    group: "records",
    icon: Shield,
    title: "Student Insurance Requirements Vault",
    summary: "Insurance documents kept in one place.",
    description: "Compile and manage all student insurance requirement documents securely in one place, allowing the school nurse to easily access and verify insurance compliance for each student.",
  },
  {
    group: "records",
    icon: ClipboardList,
    title: "Student & Parent Clinic Logs & Records",
    summary: "Full clinic history for students and parents.",
    description: "Allow students and parents to view the student's complete record on the clinic, including clinic visit consultation history, medicine request history, issued excuse slip request history, screening & monitoring history, doctor check-up history, and incident report history.",
  },
  {
    group: "clinic",
    icon: CalendarCheck,
    title: "Health Screening & Monitoring Scheduling",
    summary: "Schedule and record routine check-ups.",
    description: "Manage the scheduling and recording of routine student health check-ups, enabling the school nurse to conduct and document regular health screenings and monitoring sessions.",
  },
  {
    group: "clinic",
    icon: ClipboardList,
    title: "Visit Log & Medication Documentation with SMS",
    summary: "Log each visit. Parents get an SMS.",
    description: "Document clinic visit consultations including time in, date, student name, course/strand & year, vital signs, complaints, and nursing interventions. Parents automatically receive SMS notifications for every clinic visit consultation.",
  },
  {
    group: "clinic",
    icon: AlertTriangle,
    title: "Incident & Emergency Reports with SMS",
    summary: "First aid records and emergency hotlines.",
    description: "Document incidents and first aid interventions with student details, reason for incident, and current situation. Instantly send SMS notifications to parents for manageable cases, and provides hospital emergency hotlines for critical cases.",
  },
  {
    group: "clinic",
    icon: Stethoscope,
    title: "Doctor Visit Scheduling",
    summary: "Appoint students to a doctor.",
    description: "Allow the school nurse to schedule doctor visits and appoint students to a doctor, enabling efficient coordination of medical check-ups within the school clinic.",
  },
  {
    group: "clinic",
    icon: MessageSquare,
    title: "Automated SMS Notification System",
    summary: "Real-time alerts to parents or guardians.",
    description: "Automatically send real-time SMS alerts to parents or guardians regarding clinic visit consultations and incident reports, ensuring immediate and transparent parent communication.",
  },
  {
    group: "insights",
    icon: TrendingUp,
    title: "Health Trends, Weekly Reports & Alerts",
    summary: "Common illnesses and repeat-visit alerts.",
    description: "Monitor health trends across specific timeframes, generate weekly reports on common illnesses, and send alerts for students with frequent sickness based on repeated clinic visits with the same complaint — all derived from visit log data.",
  },
  {
    group: "insights",
    icon: BarChart2,
    title: "Predictive Medicine Demand Analytics",
    summary: "Next month's expected medicine demand.",
    description: "Display a predictive graph showing the expected medicine demand for the upcoming month, calculated from past average health cases per month.",
  },
  {
    group: "insights",
    icon: Lightbulb,
    title: "Weekly Health Tips for Students",
    summary: "Tips built from this week's clinic trends.",
    description: "Provide students access to weekly health tips that are dynamically generated based on the current weekly health trend reports from the clinic.",
  },
  {
    group: "insights",
    icon: Package,
    title: "Medicine Inventory & Expiration Alerts",
    summary: "Stock levels and expiry warnings.",
    description: "Add medicine items, set and monitor expiration dates, edit stock quantities, and receive automated alerts for low stocks and near-expiration medicines to ensure continuous and safe supply.",
  },
  {
    group: "insights",
    icon: Pill,
    title: "Medicine Dispense Documentation",
    summary: "Every dose logged, stock updated live.",
    description: "Record all dispensed medicines including student name, course/strand and year, medicine given, and quantity. Dispensed quantities automatically update the medicine inventory in real time.",
  },
  {
    group: "access",
    icon: Smartphone,
    title: "Mobile Responsive Parent & Student Portal",
    summary: "Works on any phone.",
    description: "A fully mobile-responsive website that allows parents and students to easily access the system through any mobile device, ensuring accessibility and real-time information on the go.",
  },
  {
    group: "access",
    icon: Send,
    title: "Student Clinic Document Requests",
    summary: "Request excuse and referral slips online.",
    description: "Allow students to request clinic services and documents online, including excuse slips and referral slips, streamlining the request process without requiring physical visits.",
  },
  {
    group: "access",
    icon: ClipboardCheck,
    title: "Nurse Issuance of Student Requests",
    summary: "Review and issue slips digitally.",
    description: "Allow the nurse to review and issue requested clinic documents for students, including excuse slips and referral slips, with efficient digital processing and record-keeping.",
  },
];

const stats = [
  { icon: LayoutGrid, num: objectives.length, label: "Modules" },
  { icon: Users, num: portals.length, label: "Portals" },
  { icon: MessageSquare, num: "SMS", label: "Parent alerts" },
  { icon: Smartphone, num: "Mobile", label: "Ready" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState({});
  const [objectiveOpen, setObjectiveOpen] = useState(false);

  const formattedDate = formatCurrentDate();
  const groupLabel = Object.fromEntries(groups.map((g) => [g.id, g.label]));
  const visible = objectives.filter((o) => filter === "all" || o.group === filter);
  const countOf = (id) => (id === "all" ? objectives.length : objectives.filter((o) => o.group === id).length);
  const dark = theme === "dark";
  const goLogin = () => navigate("/Login");

  return (
    <div className="landing-page">
      <a className="skip-link" href="#modules">Skip to modules</a>

      {/* Header */}
      <header className="lp-header">
        <div className="lp-wrap lp-header-row">
          <div className="lp-brand">
            <img src={logo} alt="STI College Baliuag Logo" className="lp-logo" />
            <div>
              <h1 className="lp-brand-title">STI Baliuag</h1>
              <p className="lp-brand-sub">School Clinic Management System</p>
            </div>
          </div>
          <div className="lp-tools">
            <p className="lp-today">{formattedDate}</p>
            <button
              type="button"
              className="lp-btn"
              onClick={toggleTheme}
              aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
              title={dark ? "Switch to light theme" : "Switch to dark theme"}
            >
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="lp-btn lp-btn-yellow"
              onClick={goLogin}
              aria-label="Access your portal"
              title="Access your portal"
            >
              <LogIn aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="lp-hero" aria-labelledby="lp-hero-title">
          <div className="lp-wrap lp-hero-grid">
            <div>
              <p className="lp-eyebrow"><HeartPulse aria-hidden="true" />STI College Baliuag</p>
              <h2 id="lp-hero-title" className="lp-hero-title">
                Student Health Management &amp; Monitoring System
              </h2>
              <p className="lp-hero-lead">
                Records, clinic visits, medicine stock and parent alerts in one place.
              </p>
              <div className="lp-hero-actions">
                <button
                  type="button"
                  className="lp-btn lp-btn-yellow lp-btn-lg"
                  onClick={goLogin}
                  aria-label="Access your portal"
                  title="Access your portal"
                >
                  <LogIn aria-hidden="true" />
                </button>
                <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#modules" aria-label="See modules" title="See modules">
                  <ArrowDown aria-hidden="true" />
                </a>
              </div>
            </div>

            <aside className="lp-portals" aria-label="Portals">
              <p className="lp-portals-title">Four portals</p>
              {portals.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.role} className="lp-portal-row">
                    <div className="lp-portal-icon"><Icon aria-hidden="true" /></div>
                    <div>
                      <p className="lp-portal-role">{p.role}</p>
                      <p className="lp-portal-what">{p.what}</p>
                    </div>
                  </div>
                );
              })}
            </aside>
          </div>
        </section>

        {/* Stats */}
        <section className="lp-stats" aria-label="At a glance">
          <div className="lp-wrap lp-stats-row">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="lp-stat">
                  <Icon aria-hidden="true" />
                  <div>
                    <p className="lp-stat-num">{s.num}</p>
                    <p className="lp-stat-label">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* General objective */}
        <section className="lp-wrap lp-objective" aria-labelledby="lp-objective-title">
          <div className="lp-objective-card">
            <div className="lp-objective-icon"><Target aria-hidden="true" /></div>
            <div>
              <h2 id="lp-objective-title" className="lp-objective-title">General Objective</h2>
              <p>One web platform for faster, more accurate clinic work at STI College Baliuag.</p>
              <p id="lp-objective-full" className="lp-objective-full" hidden={!objectiveOpen}>
                To design and develop a <strong>Student Health Management and Monitoring System</strong> for
                STI College Baliuag with Analytics for both Senior High School and Tertiary that will
                improve the efficiency, accuracy, and accessibility of clinic operations through a
                centralized and automated web-based platform.
              </p>
            </div>
            <button
              type="button"
              className="lp-btn lp-toggle"
              aria-expanded={objectiveOpen}
              aria-controls="lp-objective-full"
              aria-label={objectiveOpen ? "Hide full objective" : "Show full objective"}
              title={objectiveOpen ? "Hide full objective" : "Show full objective"}
              onClick={() => setObjectiveOpen((v) => !v)}
            >
              <ChevronDown aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* System objectives */}
        <section id="modules" className="lp-wrap lp-modules" aria-labelledby="lp-modules-title" tabIndex={-1}>
          <div className="lp-modules-head">
            <h2 id="lp-modules-title" className="lp-modules-title">System Objectives</h2>
            <p className="lp-count" role="status" aria-live="polite">
              Showing {visible.length} of {objectives.length}
            </p>
          </div>

          <div className="lp-filters" role="group" aria-label="Filter modules">
            {[{ id: "all", label: "All" }, ...groups].map((g) => (
              <button
                key={g.id}
                type="button"
                className="lp-chip"
                aria-pressed={filter === g.id}
                onClick={() => setFilter(g.id)}
              >
                {g.id === "all" ? <LayoutGrid aria-hidden="true" /> : null}
                {filter === g.id && g.id !== "all" ? <Check aria-hidden="true" /> : null}
                {g.label}
                <span className="lp-chip-n">{countOf(g.id)}</span>
              </button>
            ))}
          </div>

          <div className="lp-grid">
            {visible.map((o) => {
              const Icon = o.icon;
              const id = `lp-more-${objectives.indexOf(o)}`;
              const isOpen = !!open[id];
              return (
                <article key={id} className={`lp-card lp-g-${o.group}`}>
                  <div className="lp-card-top">
                    <div className="lp-card-icon"><Icon aria-hidden="true" /></div>
                    <span className="lp-tag">{groupLabel[o.group]}</span>
                  </div>
                  <h3 className="lp-card-title">{o.title}</h3>
                  <p className="lp-card-sum">{o.summary}</p>
                  <p id={id} className="lp-card-more" hidden={!isOpen}>{o.description}</p>
                  <button
                    type="button"
                    className="lp-btn lp-toggle"
                    aria-expanded={isOpen}
                    aria-controls={id}
                    aria-label={isOpen ? "Hide details" : "Show details"}
                    title={isOpen ? "Hide details" : "Show details"}
                    onClick={() => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))}
                  >
                    <ChevronDown aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-row">
          <p>© {new Date().getFullYear()} STI College Baliuag. All rights reserved.</p>
          <p>Student Health Management &amp; Monitoring System</p>
        </div>
      </footer>
    </div>
  );
}
