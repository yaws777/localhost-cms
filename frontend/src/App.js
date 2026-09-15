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
} from "lucide-react";
import "./styles/App.css";

const objectives = [
  {
    icon: FileText,
    title: "Health Record & Requirements Monitoring",
    description: "Enable the school nurse to retrieve student health profiles — including personal info, emergency contacts, chronic conditions, and allergies — and monitor health requirements per course/strand (e.g., vaccines for Hospitality Management), plus view clinic visit history, medicine requests, and incident reports.",
    theme: "blue",
  },
  {
    icon: UserCheck,
    title: "Student Health Record Completion",
    description: "Allow students to fill up and complete their health records including personal information, health information (chronic conditions & allergies), and emergency contacts. Students can also monitor and upload their course requirements.",
    theme: "indigo",
  },
  {
    icon: CalendarCheck,
    title: "Health Screening & Monitoring Scheduling",
    description: "Manage the scheduling and recording of routine student health check-ups, enabling the school nurse to conduct and document regular health screenings and monitoring sessions.",
    theme: "green",
  },
  {
    icon: ClipboardList,
    title: "Visit Log & Medication Documentation with SMS",
    description: "Document clinic visit consultations including time in, date, student name, course/strand & year, vital signs, complaints, and nursing interventions. Parents automatically receive SMS notifications for every clinic visit consultation.",
    theme: "orange",
  },
  {
    icon: AlertTriangle,
    title: "Incident & Emergency Reports with SMS",
    description: "Document incidents and first aid interventions with student details, reason for incident, and current situation. Instantly send SMS notifications to parents for manageable cases, and provides hospital emergency hotlines for critical cases.",
    theme: "red",
  },
  {
    icon: TrendingUp,
    title: "Health Trends, Weekly Reports & Alerts",
    description: "Monitor health trends across specific timeframes, generate weekly reports on common illnesses, and send alerts for students with frequent sickness based on repeated clinic visits with the same complaint — all derived from visit log data.",
    theme: "purple",
  },
  {
    icon: BarChart2,
    title: "Predictive Medicine Demand Analytics",
    description: "Display a predictive graph showing the expected medicine demand for the upcoming month, calculated from past average health cases per month.",
    theme: "yellow",
  },
  {
    icon: Stethoscope,
    title: "Doctor Visit Scheduling",
    description: "Allow the school nurse to schedule doctor visits and appoint students to a doctor, enabling efficient coordination of medical consultations within the school clinic.",
    theme: "teal",
  },
  {
    icon: Lightbulb,
    title: "Weekly Health Tips for Students",
    description: "Provide students access to weekly health tips that are dynamically generated based on the current weekly health trend reports from the clinic.",
    theme: "cyan",
  },
  {
    icon: Smartphone,
    title: "Mobile Responsive Parent & Student Portal",
    description: "A fully mobile-responsive website that allows parents and students to easily access the system through any mobile device, ensuring accessibility and real-time information on the go.",
    theme: "blue-light",
  },
  {
    icon: FileCheck,
    title: "Student Requirement Management",
    description: "Enable nurses to add and manage health requirements for specific students, set submission deadlines, and add notes for requirements needing resubmission — with full tracking per course and strand.",
    theme: "emerald",
  },
  {
    icon: Package,
    title: "Medicine Inventory & Expiration Alerts",
    description: "Add medicine items, set and monitor expiration dates, edit stock quantities, and receive automated alerts for low stocks and near-expiration medicines to ensure continuous and safe supply.",
    theme: "amber",
  },
  {
    icon: Pill,
    title: "Medicine Dispense Documentation",
    description: "Record all dispensed medicines including student name, course/strand and year, medicine given, and quantity. Dispensed quantities automatically update the medicine inventory in real time.",
    theme: "pink",
  },
  {
    icon: Shield,
    title: "Student Insurance Requirements Vault",
    description: "Compile and manage all student insurance requirement documents securely in one place, allowing the school nurse to easily access and verify insurance compliance for each student.",
    theme: "violet",
  },
  {
    icon: Send,
    title: "Student Clinic Document Requests",
    description: "Allow students to request clinic services and documents online, including excuse slips and referral slips, streamlining the request process without requiring physical visits.",
    theme: "sky",
  },
  {
    icon: ClipboardCheck,
    title: "Nurse Issuance of Student Requests",
    description: "Allow the nurse to review and issue requested clinic documents for students, including excuse slips and referral slips, with efficient digital processing and record-keeping.",
    theme: "indigo-light",
  },
  {
    icon: MessageSquare,
    title: "Automated SMS Notification System",
    description: "Automatically send real-time SMS alerts to parents or guardians regarding clinic visit consultations and incident reports, ensuring immediate and transparent parent communication.",
    theme: "orange-light",
  },
  {
    icon: ClipboardList,
    title: "Student & Parent Clinic Logs & Records",
    description: "Allow students and parents to view the student's complete record on the clinic, including clinic visit consultation history, medicine request history, issued excuse slip request history, screening & monitoring history, doctor consultation history, and incident report history.",
    theme: "teal",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="main-header">
        <div className="header-container">
          <div className="brand-group">
            <div className="logo-badge">
              <span>STI</span>
            </div>
            <div>
              <h1 className="brand-title">STI Baliuag</h1>
              <p className="brand-subtitle">School Clinic Management System</p>
            </div>
          </div>
          <div className="header-meta">
            <p className="current-date">{formattedDate}</p>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <h2 className="hero-heading">
            Student Health Management
            <br />
            & Monitoring System
          </h2>
          <p className="hero-description">
            A centralized digital platform for managing student health records,
            clinic operations, medicine inventory, insurance documentation,
            predictive analytics, and seamless parent communication — all in one
            place.
          </p>
          <button className="portal-btn" onClick={() => navigate("/Login")}>
            Access Your Portal
          </button>
        </div>
      </section>

      {/* General Objective Banner */}
      <section className="objective-banner">
        <div className="banner-container">
          <h3 className="banner-title">General Objective</h3>
          <p className="banner-text">
            To design and develop a <strong>Student Health Management and Monitoring System</strong> for
            STI College Baliuag with Analytics for both Senior High School and Tertiary that will
            improve the efficiency, accuracy, and accessibility of clinic operations through a
            centralized and automated web-based platform.
          </p>
        </div>
      </section>

      {/* System Objectives Section */}
      <section className="objectives-section">
        <div className="section-container">
          <div className="section-header">
            <h3 className="section-title">System Objectives</h3>
            <p className="section-subtitle">
              The STI Baliuag Clinic Management System is built to modernize
              school healthcare through the following key modules and features:
            </p>
          </div>

          <div className="objectives-grid">
            {objectives.map((objective, index) => {
              const Icon = objective.icon;
              return (
                <div key={index} className="objective-card">
                  <div className="card-top">
                    <div className={`icon-wrapper theme-${objective.theme}`}>
                      <Icon className="lucide-icon" />
                    </div>
                  </div>
                  <h4 className="card-title">{objective.title}</h4>
                  <p className="card-description">{objective.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="main-footer">
        <div className="footer-container">
          <p className="footer-copyright">
            © {new Date().getFullYear()} STI College Baliuag. All rights reserved.
          </p>
          <p className="footer-subtext">
            Student Health Management & Monitoring System — Designed for efficient healthcare operations
          </p>
        </div>
      </footer>
    </div>
  );
}