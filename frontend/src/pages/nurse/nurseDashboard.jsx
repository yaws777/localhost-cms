import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer
} from 'recharts';
import { 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight, 
  Lightbulb, 
  CheckCircle2, 
  X, 
  Search, 
  Calendar,
  FileText,
  Stethoscope,
  Activity,
  Clock,
  Pill,
  QrCode,
  AlertCircle,
  GraduationCap,
  FileCheck,
  UserCheck,
  ShieldAlert,
  Download,
  Megaphone,
  Send,
  Edit3,
  Trash2,
  Plus
} from 'lucide-react';
import stiLogo from '../../assets/sti-logof.png';
import '../../styles/nurse/NurseDashboard.css';

const COLORS = ['#0250A3', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#6366F1'];
const STANDARD_UNITS = ['mg', 'g', 'mcg', 'ml', 'l'];

const isStandardUnit = (unit) => {
  if (!unit) return false;
  return STANDARD_UNITS.includes(String(unit).trim().toLowerCase());
};

/* --- HELPER FUNCTIONS --- */
const pluralize = (word, count) => {
  if (!word) return '';
  if (count <= 1) return word;
  return /(x|s|ch|sh|z)$/i.test(word) ? `${word}es` : `${word}s`;
};

const formatCeilAvg = (val) => {
  if (val === undefined || val === null || val === '') return '0';
  const num = Number(val);
  if (isNaN(num)) return val;

  const ceilVal = Math.ceil(num);
  if (num !== ceilVal) {
    const rawFormatted = Number.isInteger(num) ? num : parseFloat(num.toFixed(1));
    return (
      <>
        <strong>{ceilVal}</strong>
        <span style={{ color: '#6B7280', fontWeight: 'normal' }}>({rawFormatted})</span>
      </>
    );
  }
  return <strong>{ceilVal}</strong>;
};

const getNextMonthString = () => {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = nextMonth.getFullYear();
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getCurrentMonthString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatDateTimeForInput = (d) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getBrandNameOnly = (fullName) => {
  if (!fullName) return '';
  const match = fullName.match(/\(([^)]+)\)/);
  return match && match[1] ? match[1].trim() : fullName;
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) return dateTimeString;
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
};

const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  if (timeString.includes('T') || timeString.includes('-')) {
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }
  const parts = timeString.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHour = hours % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  }
  return timeString;
};

const isScheduleUpcoming = (dateStr, timeStr) => {
  if (!dateStr && !timeStr) return false;
  const now = new Date();
  let scheduleDate;

  if (timeStr && (timeStr.includes('T') || timeStr.includes('Z'))) {
    scheduleDate = new Date(timeStr);
  } else if (dateStr && (dateStr.includes('T') || dateStr.includes('Z'))) {
    scheduleDate = new Date(dateStr);
  } else if (dateStr && timeStr) {
    const cleanDate = dateStr.split('T')[0];
    scheduleDate = new Date(`${cleanDate}T${timeStr}`);
  } else if (dateStr) {
    scheduleDate = new Date(dateStr);
  } else if (timeStr) {
    scheduleDate = new Date(timeStr);
  }

  if (!scheduleDate || isNaN(scheduleDate.getTime())) return true;
  return scheduleDate > now;
};

// Helper function to calculate announcement active status dynamically
const getAnnouncementStatusInfo = (startAt, expiresAt) => {
  const now = new Date();
  const start = new Date(startAt);
  const expires = new Date(expiresAt);

  if (now < start) {
    return { label: 'UPCOMING', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
  } else if (now >= start && now <= expires) {
    return { label: 'ONGOING', color: '#059669', bg: '#D1FAE5', border: '#A7F3D0' };
  } else {
    return { label: 'EXPIRED', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' };
  }
};

/* --- PDF REPORT GENERATOR HELPER --- */
const generatePDFReport = (title, periodText, tableHeaders, tableRows) => {
  const printWindow = window.open('', '_blank', 'width=900,height=750');
  if (!printWindow) {
    alert('Please allow popups to export the PDF report.');
    return;
  }

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1f2937;
            margin: 0;
            padding: 20px;
            background: #ffffff;
          }
          .report-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #0250a3;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 16px;
          }
          .sti-logo {
            height: 60px;
            width: auto;
            object-fit: contain;
          }
          .header-info h1 {
            font-size: 18px;
            font-weight: 800;
            color: #0250a3;
            margin: 0 0 4px 0;
            text-transform: uppercase;
          }
          .header-info p {
            font-size: 11px;
            color: #4b5563;
            margin: 0;
            line-height: 1.35;
          }
          .header-meta {
            text-align: right;
            font-size: 11px;
            color: #6b7280;
          }
          .report-title-container {
            text-align: center;
            margin-bottom: 20px;
          }
          .report-title {
            font-size: 16px;
            font-weight: 700;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 4px 0;
          }
          .report-subtitle {
            font-size: 12px;
            color: #4b5563;
            margin: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            font-size: 12px;
          }
          th {
            background-color: #0250a3;
            color: #ffffff;
            font-weight: 600;
            text-align: left;
            padding: 9px 12px;
            border: 1px solid #0250a3;
          }
          td {
            padding: 9px 12px;
            border: 1px solid #e5e7eb;
            color: #374151;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .signature-section {
            margin-top: 50px;
            display: flex;
            justify-content: flex-start;
            page-break-inside: avoid;
          }
          .signature-box {
            width: 240px;
          }
          .prepared-by-label {
            font-size: 12px;
            color: #374151;
            margin-bottom: 45px;
          }
          .nurse-name {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
            border-bottom: 1px solid #111827;
            padding-bottom: 3px;
            margin-bottom: 4px;
          }
          .nurse-title {
            font-size: 11px;
            color: #4b5563;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="header-left">
            <img src="${stiLogo}" alt="STI Logo" class="sti-logo" />
            <div class="header-info">
              <h1>STI College</h1>
              <p>Address: Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan.</p>
              <p>Clinic & Health Services Department</p>
            </div>
          </div>
          <div class="header-meta">
            <p><strong>Date Generated:</strong> ${currentDateStr}</p>
          </div>
        </div>

        <div class="report-title-container">
          <h2 class="report-title">${title}</h2>
          ${periodText ? `<p class="report-subtitle">${periodText}</p>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              ${tableHeaders.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${tableRows.length > 0 ? tableRows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('') : `<tr><td colspan="${tableHeaders.length}" style="text-align:center; padding: 18px;">No records available for this report.</td></tr>`}
          </tbody>
        </table>

        <div class="signature-section">
          <div class="signature-box">
            <p class="prepared-by-label">Prepared by:</p>
            <div class="nurse-name">Marilou H. Balarao</div>
            <div class="nurse-title">School Nurse</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/* --- CUSTOM CHART TOOLTIPS --- */
const PredictiveTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const itemData = payload[0]?.payload;
    const dosageUnit = itemData?.dosageForm || 'Unit';

    return (
      <div className="custom-chart-tooltip-nd predictive-tooltip-width-nd">
        <h4 className="tooltip-header-nd">{label}</h4>
        <ul className="tooltip-items-list-standard-nd">
          {payload.map((entry, index) => {
            const isStock = entry.dataKey === 'currentStock';
            const displayUnit = isStock 
              ? pluralize(dosageUnit, entry.value)
              : 'package(s)/bottle(s)';

            return (
              <li key={index} className="tooltip-item-nd">
                <div className="tooltip-item-left-nd">
                  <span className="tooltip-marker-nd" style={{ backgroundColor: entry.color }} />
                  <span className="tooltip-item-name-nd">{entry.name}</span>
                </div>
                <span className="tooltip-item-value-nd" style={{ color: entry.color }}>
                  {formatCeilAvg(entry.value)} {displayUnit}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return null;
};

const CustomTooltip = ({ active, payload, label, unitLabel = "cases", medicinesUnitsMap = {}, showBrandOnly = false }) => {
  if (active && payload && payload.length) {
    const totalCases = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
    const activePayload = payload.filter((entry) => (Number(entry.value) || 0) > 0);

    return (
      <div className="custom-chart-tooltip-nd trend-tooltip-widen-nd">
        <h4 className="tooltip-header-nd">{label}</h4>
        {activePayload.length === 0 ? (
          <div className="tooltip-no-records-nd">No records found</div>
        ) : (
          <ul className="tooltip-items-grid-nd">
            {activePayload.map((entry, index) => {
              const specificUnit = medicinesUnitsMap[entry.name] || unitLabel;
              const displayName = showBrandOnly ? getBrandNameOnly(entry.name) : entry.name;

              return (
                <li key={index} className="tooltip-item-nd">
                  <div className="tooltip-item-left-nd">
                    <span className="tooltip-marker-nd" style={{ backgroundColor: entry.color }} />
                    <span className="tooltip-item-name-nd">{displayName}</span>
                  </div>
                  <span className="tooltip-item-value-nd" style={{ color: entry.color }}>
                    {entry.value} {specificUnit}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="tooltip-divider-nd" />
        <div className="tooltip-footer-nd">
          <span className="tooltip-total-label-nd">Total</span>
          <span className="tooltip-total-value-nd">{totalCases.toFixed(1)} {unitLabel}</span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomXAxisTick = ({ x, y, payload, filterType, isCurrentYearSelected, currentMonthName }) => {
  const isCurrentMonth = filterType === 'yearly' && isCurrentYearSelected && payload.value === currentMonthName;
  return (
    <g transform={`translate(${x},${y})`}>
      {isCurrentMonth && (
        <rect x={-24} y={4} width={48} height={22} rx={11} fill="#0250A3" opacity={0.12} />
      )}
      <text
        x={0} y={0} dy={19} textAnchor="middle"
        fill={isCurrentMonth ? '#0250A3' : '#4B5563'}
        style={{ fontWeight: isCurrentMonth ? 700 : 500, fontSize: 11 }}
      >
        {payload.value}
      </text>
    </g>
  );
};

/* --- MAIN DASHBOARD COMPONENT --- */
const NurseDashboard = () => {
  const navigate = useNavigate();
  // Get active nurseId and account userId from NurseLayout outlet context
  const { nurseId, userId } = useOutletContext() || {};

  const maxCurrentMonth = getCurrentMonthString();
  const defaultNextMonth = getNextMonthString();

  // 0. Unified Nurse Dashboard Operational Overview State
  const [nurseDashboardData, setNurseDashboardData] = useState({
    requirementsOverview: {
      waitingForApprovalCount: 0,
      incompleteCount: 0,
      totalAttentionCount: 0
    },
    upcomingRequirementDeadlines: [],
    pendingDocumentRequests: {
      pending_excuse_slips: 0,
      pending_referral_slips: 0,
      total_pending_requests: 0
    },
    medicineStockAlerts: [],
    upcomingHealthScreenings: [],
    upcomingDoctorVisits: []
  });
  const [isNurseDashboardLoading, setIsNurseDashboardLoading] = useState(true);

  // 1. Health Trends State
  const [trendData, setTrendData] = useState([]);
  const [complaintsList, setComplaintsList] = useState([]);
  const [averages, setAverages] = useState(null);
  const [averagesLabel, setAveragesLabel] = useState(""); 
  const [timelineLabel, setTimelineLabel] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [filterType, setFilterType] = useState("current"); 
  const [selectedMonth, setSelectedMonth] = useState(maxCurrentMonth); 
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString()); 
  const [isLoading, setIsLoading] = useState(true);

  // 2. Medicine Dispensed Overview State
  const [dispensedData, setDispensedData] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);
  const [medicinesUnitsMap, setMedicinesUnitsMap] = useState({});
  const [dispensedAverages, setDispensedAverages] = useState(null);
  const [dispensedAveragesLabel, setDispensedAveragesLabel] = useState("");
  const [dispensedTimelineLabel, setDispensedTimelineLabel] = useState("");
  const [dispensedPeriodLabel, setDispensedPeriodLabel] = useState("");
  const [dispensedFilterType, setDispensedFilterType] = useState("current");
  const [dispensedSelectedMonth, setDispensedSelectedMonth] = useState(maxCurrentMonth);
  const [dispensedSelectedYear, setDispensedSelectedYear] = useState(new Date().getFullYear().toString());
  const [isDispensedLoading, setIsDispensedLoading] = useState(true);

  // 3. Predictive Demand State
  const [predictiveData, setPredictiveData] = useState([]);
  const [predictiveTitle, setPredictiveTitle] = useState("");
  const [predictiveMonth, setPredictiveMonth] = useState(defaultNextMonth);
  const [isPredictiveLoading, setIsPredictiveLoading] = useState(true);

  // 4. Frequent Complaint Alerts State
  const [alerts, setAlerts] = useState([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalDate, setModalDate] = useState('');

  // 5. Announcement State (CRUD & Management)
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState([]);
  const [isAnnouncementLoading, setIsAnnouncementLoading] = useState(false);
  const [announcementModalTab, setAnnouncementModalTab] = useState('CREATE'); // 'CREATE' | 'EDIT' | 'LIST'
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [programsList, setProgramsList] = useState([]);
  const [announcementError, setAnnouncementError] = useState('');
  const [isAnnouncementSubmitting, setIsAnnouncementSubmitting] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    target_audience: 'BOTH',
    target_program_id: '',
    target_year_level: '',
    start_at: '',
    expires_at: '',
    notify_update: false
  });

  // Frequent Visit Details State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAlertHeader, setSelectedAlertHeader] = useState(null);
  const [detailVisits, setDetailVisits] = useState([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Expand / Collapse UI States
  const [isAveragesExpanded, setIsAveragesExpanded] = useState(false);
  const [isDispensedAveragesExpanded, setIsDispensedAveragesExpanded] = useState(false);
  const [isPredictiveExpanded, setIsPredictiveExpanded] = useState(false);

  const realTimeDate = new Date();
  const currentMonthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentRealTimeMonthName = currentMonthNamesShort[realTimeDate.getMonth()];
  const isCurrentYearSelected = selectedYear === realTimeDate.getFullYear().toString();
  const isDispensedCurrentYearSelected = dispensedSelectedYear === realTimeDate.getFullYear().toString();

  const getComplaintColor = (complaint) => {
    const index = complaintsList.indexOf(complaint);
    return COLORS[(index >= 0 ? index : 0) % COLORS.length];
  };

  const getMedicineColor = (medicine) => {
    const index = medicinesList.indexOf(medicine);
    return COLORS[(index >= 0 ? index : 0) % COLORS.length];
  };

  const combinedUnitsMap = {
    ...predictiveData.reduce((acc, med) => {
      if (med.name) acc[med.name] = med.unitOfMeasure;
      return acc;
    }, {}),
    ...medicinesUnitsMap
  };

  // Dynamically Filtered Upcoming Schedules
  const upcomingHealthScreenings = (nurseDashboardData.upcomingHealthScreenings || []).filter((screen) =>
    isScheduleUpcoming(screen.scheduled_date, screen.start_time)
  );

  const upcomingDoctorVisits = (nurseDashboardData.upcomingDoctorVisits || []).filter((visit) =>
    isScheduleUpcoming(visit.scheduled_date || visit.start_time, visit.start_time)
  );

  // EXPORT HANDLERS FOR REPORTS
  const handleExportHealthTrends = () => {
    const headers = ['No.', 'Health Complaint / Symptom', 'Total Cases Recorded', 'Average Cases / Month'];
    const rows = complaintsList.map((complaint, index) => {
      const totalCases = trendData.reduce((sum, item) => sum + (Number(item[complaint]) || 0), 0);
      const avgVal = averages && averages[complaint] !== undefined ? averages[complaint] : 0;
      const ceilAvg = Math.ceil(Number(avgVal) || 0);

      return [
        index + 1,
        complaint,
        totalCases,
        `${ceilAvg} avg/mo`
      ];
    });

    generatePDFReport(
      'Health Trends Summary Report',
      `${periodLabel || ''} ${timelineLabel ? `(${timelineLabel})` : ''}`,
      headers,
      rows
    );
  };

  const handleExportMedicineDispensed = () => {
    const headers = ['No.', 'Medicine / Item Name', 'Unit of Measure', 'Total Dispensed', 'Monthly Average Dispensed'];
    const rows = medicinesList.map((medicine, index) => {
      const unit = combinedUnitsMap[medicine] || 'units';
      const totalDispensed = dispensedData.reduce((sum, item) => sum + (Number(item[medicine]) || 0), 0);

      let avgValue = dispensedAverages?.[medicine];
      if (avgValue === undefined || avgValue === null) {
        if (dispensedData.length > 0) {
          avgValue = totalDispensed / dispensedData.length;
        } else {
          avgValue = 0;
        }
      }
      const ceilAvg = Math.ceil(Number(avgValue) || 0);

      return [
        index + 1,
        medicine,
        unit,
        totalDispensed,
        `${ceilAvg} ${unit}/mo`
      ];
    });

    generatePDFReport(
      'Medicine Dispensed Summary Report',
      `${dispensedPeriodLabel || ''} ${dispensedTimelineLabel ? `(${dispensedTimelineLabel})` : ''}`,
      headers,
      rows
    );
  };

  const handleExportPredictiveDemand = () => {
    const headers = [
      'No.', 
      'Medicine Name', 
      'Package Strength / Form', 
      'Current Stock', 
      'Monthly Avg Dispensed', 
      'Predicted Demand (Packages/Bottles)'
    ];

    const rows = predictiveData.map((med, index) => {
      const ceilAvgBase = Math.ceil(Number(med.avgMonthlyDispensedBase) || 0);
      const ceilPredicted = Math.ceil(Number(med.predictedNeed) || 0);

      return [
        index + 1,
        med.name,
        `${med.packageStrength || 'N/A'} (${med.dosageForm || 'Unit'})`,
        `${med.currentStock} ${pluralize(med.dosageForm, med.currentStock)}`,
        `${ceilAvgBase} ${med.unitOfMeasure}`,
        `${ceilPredicted} package(s)/bottle(s)`
      ];
    });

    generatePDFReport(
      'Predictive Medicine Demand Forecast Report',
      `Forecast Target Month: ${predictiveMonth}`,
      headers,
      rows
    );
  };

  // EXPORT HANDLER FOR ALL REPEATED COMPLAINT LOGS
  const handleExportFrequentComplaints = () => {
    const headers = ['No.', 'Student Name', 'Student ID', 'Repeated Complaint', 'Monthly Visits', 'Clinical Advice'];
    const rows = alerts.map((alert, index) => [
      index + 1,
      alert.studentName || 'N/A',
      alert.studentId || 'N/A',
      alert.complaint || 'N/A',
      `${alert.visitCount || 0} visits`,
      alert.advice || 'N/A'
    ]);

    generatePDFReport(
      'Frequent Visit & Repeated Complaint Summary Report',
      'Summary of Students with Recurring Clinic Visit Logs & Frequent Health Concerns',
      headers,
      rows
    );
  };

  // EXPORT HANDLER FOR INDIVIDUAL STUDENT REPEATED COMPLAINT VISIT HISTORY
  const handleExportStudentVisitHistory = () => {
    if (!selectedAlertHeader) return;

    const headers = [
      'No.', 
      'Visit Date & Time', 
      'Chief Complaint', 
      'Vitals (BP / Temp / Resp / Pulse)', 
      'Nursing Intervention', 
      'Clinical Assessment'
    ];

    const rows = detailVisits.map((visit, index) => {
      const bp = visit.bloodPressure || visit.blood_pressure || 'N/A';
      const temp = visit.temperature ? `${visit.temperature} °C` : 'N/A';
      const resp = visit.respiratoryRate || visit.respiratory_rate ? `${visit.respiratoryRate || visit.respiratory_rate} cpm` : 'N/A';
      const pulse = visit.pulseRate || visit.pulse_rate ? `${visit.pulseRate || visit.pulse_rate} bpm` : 'N/A';
      const vitalsStr = `BP: ${bp} | Temp: ${temp} | RR: ${resp} | PR: ${pulse}`;

      const formattedDateTime = `${formatDate(visit.visitDate || visit.visit_date)} ${formatTime(visit.timeIn || visit.time_in)}`;

      return [
        index + 1,
        formattedDateTime,
        visit.complaint || visit.chief_complaint || selectedAlertHeader.complaint,
        vitalsStr,
        visit.nursingIntervention || visit.nursing_intervention || visit.treatment_provided || visit.treatment || 'No intervention logged.',
        visit.assessment || visit.remarks || visit.notes || 'No assessment logged.'
      ];
    });

    generatePDFReport(
      `Recurring Complaint Logs - ${selectedAlertHeader.studentName}`,
      `Student ID: ${selectedAlertHeader.studentId} | Program/Yr: ${selectedAlertHeader.gradeSection || 'N/A'} | Complaint: ${selectedAlertHeader.complaint} (${detailVisits.length} Visits Recorded)`,
      headers,
      rows
    );
  };

  // Fetch Unified Nurse Operational Dashboard Overview
  const fetchNurseDashboard = useCallback(async () => {
    setIsNurseDashboardLoading(true);
    try {
      const studentsResponse = await fetch('http://localhost:3001/api/students');
      const studentsData = await studentsResponse.json();

      let waitingForApprovalCount = 0;
      let incompleteCount = 0;

      if (Array.isArray(studentsData)) {
        studentsData.forEach(student => {
          const stats = student.stats || {};
          const hasWaiting = ((stats.submitted || 0) + (stats.late || 0)) > 0;
          const hasIncomplete = (stats.total || 0) > (stats.completed || 0);

          if (hasWaiting) waitingForApprovalCount++;
          if (hasIncomplete) incompleteCount++;
        });
      }

      const totalAttentionCount = waitingForApprovalCount + incompleteCount;

      const response = await fetch('http://localhost:3001/api/nurse/dashboard');
      if (!response.ok) throw new Error("Failed to fetch nurse dashboard data");
      const result = await response.json();
      const dashData = result.success && result.data ? result.data : {};

      let medicineStockAlerts = [];
      try {
        const invResponse = await fetch('http://localhost:3001/api/inventory');
        if (invResponse.ok) {
          const inventoryBatches = await invResponse.json();

          medicineStockAlerts = inventoryBatches
            .filter(batch => Number(batch.current_stock) <= Number(batch.low_stock_level))
            .map(batch => {
              const stock = Number(batch.current_stock);
              const crit = Number(batch.critical_stock_level);
              const low = Number(batch.low_stock_level);

              let stock_status = 'ADEQUATE';
              if (stock <= crit) {
                stock_status = 'CRITICAL';
              } else if (stock <= low) {
                stock_status = 'LOW';
              }

              return {
                ...batch,
                stock_status
              };
            });
        }
      } catch (invErr) {
        console.error("Error fetching batch inventory stock alerts:", invErr);
      }

      const rawScreenings = dashData.upcomingHealthScreenings || [];
      const rawDoctorVisits = dashData.upcomingDoctorVisits || [];

      const filteredScreenings = rawScreenings.filter((screen) =>
        isScheduleUpcoming(screen.scheduled_date, screen.start_time)
      );

      const filteredDoctorVisits = rawDoctorVisits.filter((visit) =>
        isScheduleUpcoming(visit.scheduled_date || visit.start_time, visit.start_time)
      );

      setNurseDashboardData({
        requirementsOverview: {
          waitingForApprovalCount,
          incompleteCount,
          totalAttentionCount
        },
        upcomingRequirementDeadlines: dashData.upcomingRequirementDeadlines || [],
        pendingDocumentRequests: dashData.pendingDocumentRequests || { pending_excuse_slips: 0, pending_referral_slips: 0, total_pending_requests: 0 },
        medicineStockAlerts,
        upcomingHealthScreenings: filteredScreenings,
        upcomingDoctorVisits: filteredDoctorVisits
      });
    } catch (error) {
      console.error("Error fetching nurse operational dashboard:", error);
    } finally {
      setIsNurseDashboardLoading(false);
    }
  }, []);

  // Fetch Health Trends
  const fetchHealthTrends = useCallback(async () => {
    setIsLoading(true);
    try {
      let apiDate = filterType === 'weekly' 
        ? `${selectedMonth}-01` 
        : filterType === 'yearly' 
        ? `${selectedYear}-01-01` 
        : new Date().toISOString().split('T')[0];

      const params = new URLSearchParams({ filterType, date: apiDate });
      const response = await fetch(`http://localhost:3001/api/health-trends?${params.toString()}`);
      const result = await response.json();

      setTrendData(result.data || []);
      setComplaintsList(result.complaintsList || []);
      setAverages(result.averages || null);
      setAveragesLabel(result.averagesLabel || ""); 
      setTimelineLabel(result.timelineLabel || "");
      setPeriodLabel(result.periodLabel || "");
    } catch (error) {
      console.error("Failed to fetch health trend data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filterType, selectedMonth, selectedYear]);

  // Fetch Medicine Dispensed Overview
  const fetchMedicineDispensed = useCallback(async () => {
    setIsDispensedLoading(true);
    try {
      let apiDate = dispensedFilterType === 'weekly' 
        ? `${dispensedSelectedMonth}-01` 
        : dispensedFilterType === 'yearly' 
        ? `${dispensedSelectedYear}-01-01` 
        : new Date().toISOString().split('T')[0];

      const params = new URLSearchParams({ filterType: dispensedFilterType, date: apiDate });
      const response = await fetch(`http://localhost:3001/api/medicine-dispensed-overview?${params.toString()}`);
      const result = await response.json();

      setDispensedData(result.data || []);
      setMedicinesList(result.medicinesList || []);
      setMedicinesUnitsMap(result.medicinesUnitsMap || result.medicineUnits || result.unitsMap || {});

      setDispensedAverages(result.averages || result.dispensedAverages || null);
      setDispensedAveragesLabel(result.averagesLabel || "Average Medicine Dispensed per Month");
      setDispensedTimelineLabel(result.timelineLabel || "");
      setDispensedPeriodLabel(result.periodLabel || "");
    } catch (error) {
      console.error("Failed to fetch medicine dispensed overview:", error);
    } finally {
      setIsDispensedLoading(false);
    }
  }, [dispensedFilterType, dispensedSelectedMonth, dispensedSelectedYear]);

  // Fetch Predictive Medicine Demand
  const fetchPredictiveDemand = useCallback(async () => {
    setIsPredictiveLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/predictive-medicine?month=${predictiveMonth}`);
      if (!response.ok) throw new Error("Network issue fetching predictive calculation");
      const result = await response.json();
      setPredictiveData(result.data || []);
      setPredictiveTitle(result.graphTitle || "Predictive Medicine Demand");
    } catch (error) {
      console.error("Failed to fetch predictive demand:", error);
    } finally {
      setIsPredictiveLoading(false);
    }
  }, [predictiveMonth]);

  // Fetch Frequent Complaint Alerts
  const fetchFrequentAlerts = useCallback(async () => {
    setIsAlertsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/frequent-complaints');
      if (!response.ok) throw new Error("Network issue fetching alerts");
      const result = await response.json();
      setAlerts(result.data || []); 
    } catch (error) {
      console.error("Failed to fetch frequent complaint alerts:", error);
    } finally {
      setIsAlertsLoading(false);
    }
  }, []);

  // Fetch Announcements List (for Read, Edit, and Delete)
  const fetchAnnouncements = useCallback(async () => {
    setIsAnnouncementLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncementsList(data.data || (Array.isArray(data) ? data : []));
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setIsAnnouncementLoading(false);
    }
  }, []);

  // Fetch Programs for Announcement Modal
  const fetchPrograms = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/programs');
      if (res.ok) {
        const data = await res.json();
        setProgramsList(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch programs:', err);
    }
  };

  // Open Announcement Modal (Mode: 'CREATE', 'EDIT', 'LIST')
  const handleOpenAnnouncementModal = (tab = 'CREATE', ann = null) => {
    setAnnouncementError('');
    setAnnouncementModalTab(tab);
    fetchPrograms();
    fetchAnnouncements();

    if (tab === 'EDIT' && ann) {
      setEditingAnnouncementId(ann.announcement_id || ann.id);
      setAnnouncementForm({
        title: ann.title || '',
        content: ann.content || '',
        target_audience: ann.target_audience || 'BOTH',
        target_program_id: ann.target_program_id || '',
        target_year_level: ann.target_year_level !== null && ann.target_year_level !== undefined ? String(ann.target_year_level) : '',
        start_at: formatDateTimeForInput(ann.start_at),
        expires_at: formatDateTimeForInput(ann.expires_at),
        notify_update: false
      });
    } else if (tab === 'CREATE') {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setEditingAnnouncementId(null);
      setAnnouncementForm({
        title: '',
        content: '',
        target_audience: 'BOTH',
        target_program_id: '',
        target_year_level: '',
        start_at: formatDateTimeForInput(now),
        expires_at: formatDateTimeForInput(nextWeek),
        notify_update: false
      });
    }
    setIsAnnouncementModalOpen(true);
  };

  // Handle Create or Update Announcement Submit
  const handleAnnouncementSubmit = async (e) => {
    e.preventDefault();
    setAnnouncementError('');

    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      setAnnouncementError('Announcement title and details are required.');
      return;
    }

    if (!announcementForm.start_at || !announcementForm.expires_at) {
      setAnnouncementError('Please select both Start Date and Expiration Date.');
      return;
    }

    if (new Date(announcementForm.start_at) >= new Date(announcementForm.expires_at)) {
      setAnnouncementError('Expiration Date & Time must be set after the Start Date & Time.');
      return;
    }

    setIsAnnouncementSubmitting(true);

    try {
      const isEditing = Boolean(editingAnnouncementId);
      const url = isEditing
        ? `http://localhost:3001/api/announcements/${editingAnnouncementId}`
        : 'http://localhost:3001/api/announcements';
      const method = isEditing ? 'PUT' : 'POST';

      // Pass nurse_id for the announcements table and user_id for notifyUsers sender_id
      const payload = {
        nurse_id: nurseId || 'NURSE02000',
        user_id: userId,
        ...announcementForm
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        alert(isEditing ? 'Announcement updated successfully!' : 'Announcement created and published successfully!');
        fetchAnnouncements();
        fetchNurseDashboard();
        setAnnouncementModalTab('LIST');
      } else {
        setAnnouncementError(result.message || 'Failed to save announcement.');
      }
    } catch (err) {
      console.error('Error saving announcement:', err);
      setAnnouncementError('Network error. Unable to reach server.');
    } finally {
      setIsAnnouncementSubmitting(false);
    }
  };

  // Handle Delete / Cancel Announcement with Push Notification Prompt
  const handleDeleteAnnouncement = async (announcementId, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    // Ask nurse whether to trigger a push notification to target users regarding the cancellation
    const notifyCancellation = window.confirm(
      `Would you like to send a push notification to affected students/parents alerting them that "${title}" was cancelled?`
    );

    try {
      const response = await fetch(`http://localhost:3001/api/announcements/${announcementId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          notify_cancellation: notifyCancellation
        })
      });
      const result = await response.json();

      if (result.success) {
        alert(
          notifyCancellation
            ? 'Announcement deleted and cancellation push notification sent!'
            : 'Announcement deleted successfully!'
        );
        fetchAnnouncements();
        fetchNurseDashboard();
      } else {
        alert(result.message || 'Failed to delete announcement.');
      }
    } catch (err) {
      console.error('Error deleting announcement:', err);
      alert('Network error. Unable to delete announcement.');
    }
  };

  const handleDismissAlert = async (studentId, complaint) => {
    if (!window.confirm(`Are you sure you want to dismiss the alert for ${complaint}?`)) {
      return;
    }
    try {
      const response = await fetch('http://localhost:3001/api/frequent-complaints/dismiss', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, complaint })
      });
      const result = await response.json();
      if (result.success) {
        setAlerts(prev => prev.filter(a => !(a.studentId === studentId && a.complaint === complaint)));
      } else {
        alert(result.message || 'Failed to dismiss alert.');
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
      alert('An error occurred while dismissing the alert.');
    }
  };

  const handleViewDetails = async (alertData) => {
    setSelectedAlertHeader(alertData);
    setIsDetailModalOpen(true);
    setIsDetailLoading(true);

    try {
      const targetMonth = alertData.date ? alertData.date.slice(0, 7) : new Date().toISOString().slice(0, 7);
      const response = await fetch(
        `http://localhost:3001/api/frequent-complaints/details?studentId=${alertData.studentId}&complaint=${encodeURIComponent(alertData.complaint)}&month=${targetMonth}`
      );
      const result = await response.json();
      if (result.success) {
        setDetailVisits(result.data || []);
      } else {
        setDetailVisits([]);
      }
    } catch (error) {
      console.error('Error fetching frequent visit details:', error);
      setDetailVisits([]);
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchNurseDashboard();
    fetchHealthTrends();
    fetchMedicineDispensed();
    fetchPredictiveDemand();
    fetchFrequentAlerts();
    fetchAnnouncements();
  }, [fetchNurseDashboard, fetchHealthTrends, fetchMedicineDispensed, fetchPredictiveDemand, fetchFrequentAlerts, fetchAnnouncements]);

  const activeComplaintsInGraph = complaintsList.filter(complaint => 
    trendData.some(dataPoint => (Number(dataPoint[complaint]) || 0) > 0)
  );

  const activeMedicinesInGraph = medicinesList.filter(medicine => 
    dispensedData.some(dataPoint => (Number(dataPoint[medicine]) || 0) > 0)
  );

  const standardMedicinesInGraph = activeMedicinesInGraph.filter(medicine => {
    const unit = combinedUnitsMap[medicine];
    return isStandardUnit(unit);
  });

  const otherMedicinesInGraph = activeMedicinesInGraph.filter(medicine => {
    const unit = combinedUnitsMap[medicine];
    return !isStandardUnit(unit);
  });

  const activePredictiveData = predictiveData.filter(med => 
    (Number(med.predictedNeed) || 0) > 0 || (Number(med.currentStock) || 0) > 0
  );

  const predictiveChartMinWidth = Math.max(activePredictiveData.length * 140, 800);
  const yearOptions = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

  const viewAllBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: '#0250A3',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background 0.2s ease'
  };

  const handleOverviewCardKeyDown = (event, path) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(path);
    }
  };

  return (
    <div className="dashboard-container-nd">
      
      {/* TOP SUMMARY STAT CARDS */}
      <div className="dashboard-section-header-nd">
        <h2 className="dashboard-title-nd">Nurse Operational Overview</h2>
        <span className="last-updated-tag-nd">Live System Data</span>
      </div>

      {isNurseDashboardLoading ? (
        <div className="loading-container-nd">
          <div className="spinner-nd"></div>
          <p className="loading-text-nd">Loading operational dashboard overview...</p>
        </div>
      ) : (
        <div className="overview-cards-grid-nd">
          
          {/* Card 1: Requirements Overview */}
          <div
            className="overview-card-nd stat-card-blue-nd"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/RequirementManagement')}
            onKeyDown={(event) => handleOverviewCardKeyDown(event, '/RequirementManagement')}
          >
            <div className="stat-card-header-nd">
              <div>
                <span className="stat-card-label-nd">Requirements Overview</span>
                <h3 className="stat-card-number-nd">{nurseDashboardData.requirementsOverview.totalAttentionCount || 0}</h3>
                <p className="stat-card-subtext-nd">Students Needing Requirement Attention</p>
              </div>
              <div className="stat-icon-wrapper-nd bg-blue-light-nd">
                <FileCheck size={24} color="#0250A3" />
              </div>
            </div>
            <div className="stat-card-footer-nd">
              <div className="stat-pill-nd warning-pill-nd">
                <Clock size={12} />
                <span><strong>{nurseDashboardData.requirementsOverview.waitingForApprovalCount || 0}</strong> Waiting for Approval</span>
              </div>
              <div className="stat-pill-nd danger-pill-nd">
                <AlertCircle size={12} />
                <span><strong>{nurseDashboardData.requirementsOverview.incompleteCount || 0}</strong> Incomplete Requirements</span>
              </div>
            </div>
            <span className="overview-card-view-all-nd">View All <ChevronRight size={14} /></span>
          </div>

          {/* Card 2: Document Requests Pending Approval */}
          <div
            className="overview-card-nd stat-card-orange-nd"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/DocumentIssuance')}
            onKeyDown={(event) => handleOverviewCardKeyDown(event, '/DocumentIssuance')}
          >
            <div className="stat-card-header-nd">
              <div>
                <span className="stat-card-label-nd">Pending Document Requests</span>
                <h3 className="stat-card-number-nd">{nurseDashboardData.pendingDocumentRequests.total_pending_requests || 0}</h3>
                <p className="stat-card-subtext-nd">Awaiting Nurse Review</p>
              </div>
              <div className="stat-icon-wrapper-nd bg-orange-light-nd">
                <FileText size={24} color="#F59E0B" />
              </div>
            </div>
            <div className="stat-card-footer-nd">
              <div className="stat-pill-nd neutral-pill-nd">
                <span>Excuse Slips: <strong>{nurseDashboardData.pendingDocumentRequests.pending_excuse_slips || 0}</strong></span>
              </div>
              <div className="stat-pill-nd neutral-pill-nd">
                <span>Referral Slips: <strong>{nurseDashboardData.pendingDocumentRequests.pending_referral_slips || 0}</strong></span>
              </div>
            </div>
            <span className="overview-card-view-all-nd">View All <ChevronRight size={14} /></span>
          </div>

          {/* Card 3: Medicine Low & Critical Batch Stock */}
          <div
            className="overview-card-nd stat-card-red-nd"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/MedicineInventory')}
            onKeyDown={(event) => handleOverviewCardKeyDown(event, '/MedicineInventory')}
          >
            <div className="stat-card-header-nd">
              <div>
                <span className="stat-card-label-nd">Medicine Stock Alerts</span>
                <h3 className="stat-card-number-nd">{nurseDashboardData.medicineStockAlerts.length}</h3>
                <p className="stat-card-subtext-nd">Batches Requiring Action</p>
              </div>
              <div className="stat-icon-wrapper-nd bg-red-light-nd">
                <ShieldAlert size={24} color="#EF4444" />
              </div>
            </div>
            <div className="stat-card-footer-nd">
              <div className="stat-pill-nd danger-pill-nd">
                <span>Critical: <strong>{nurseDashboardData.medicineStockAlerts.filter(m => m.stock_status === 'CRITICAL').length}</strong></span>
              </div>
              <div className="stat-pill-nd warning-pill-nd">
                <span>Low Stock: <strong>{nurseDashboardData.medicineStockAlerts.filter(m => m.stock_status === 'LOW').length}</strong></span>
              </div>
            </div>
            <span className="overview-card-view-all-nd">View All <ChevronRight size={14} /></span>
          </div>

          {/* Card 4: Upcoming Screenings & Doctor Visits */}
          <div
            className="overview-card-nd stat-card-green-nd"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/HealthScreening')}
            onKeyDown={(event) => handleOverviewCardKeyDown(event, '/HealthScreening')}
          >
            <div className="stat-card-header-nd">
              <div>
                <span className="stat-card-label-nd">Upcoming Schedules</span>
                <h3 className="stat-card-number-nd">
                  {upcomingHealthScreenings.length + upcomingDoctorVisits.length}
                </h3>
                <p className="stat-card-subtext-nd">Screenings & Doctor Visits</p>
              </div>
              <div className="stat-icon-wrapper-nd bg-green-light-nd">
                <Calendar size={24} color="#10B981" />
              </div>
            </div>
            <div className="stat-card-footer-nd">
              <div className="stat-pill-nd success-pill-nd">
                <span>Screenings: <strong>{upcomingHealthScreenings.length}</strong></span>
              </div>
              <div className="stat-pill-nd info-pill-nd">
                <span>Doctor Visits: <strong>{upcomingDoctorVisits.length}</strong></span>
              </div>
            </div>
            <span className="overview-card-view-all-nd">View All <ChevronRight size={14} /></span>
          </div>

        </div>
      )}

      {/* QUICK ACTIONS SECTION */}
      <div className="quick-actions-section-nd">
        <div className="quick-actions-header-nd">
          <h2 className="dashboard-title-nd">Quick Actions</h2>
        </div>
        <div className="quick-actions-grid-nd">
          <button
            type="button"
            className="quick-action-card-nd"
            onClick={() => navigate('/VisitLogConsultation', { state: { openQrScanner: true } })}
          >
            <span className="quick-action-icon-nd icon-blue-nd">
              <QrCode size={22} />
            </span>
            <span className="quick-action-content-nd">
              <strong>Clinic Visit with QR</strong>
              <span>Scan a student QR code to start a clinic visit</span>
            </span>
            <ChevronRight size={18} className="quick-action-arrow-nd" />
          </button>

          <button
            type="button"
            className="quick-action-card-nd"
            onClick={() => navigate('/DispensedMedicine', { state: { openQrScanner: true } })}
          >
            <span className="quick-action-icon-nd icon-indigo-nd">
              <Pill size={22} />
            </span>
            <span className="quick-action-content-nd">
              <strong>Dispense Medicine with QR</strong>
              <span>Scan a student QR code to dispense medicine</span>
            </span>
            <ChevronRight size={18} className="quick-action-arrow-nd" />
          </button>

          <button
            type="button"
            className="quick-action-card-nd"
            onClick={() => handleOpenAnnouncementModal('LIST')}
          >
            <span className="quick-action-icon-nd icon-blue-nd">
              <Megaphone size={22} />
            </span>
            <span className="quick-action-content-nd">
              <strong>Manage Announcements</strong>
              <span>Create, update, delete, and send system & web push notices</span>
            </span>
            <ChevronRight size={18} className="quick-action-arrow-nd" />
          </button>
        </div>
      </div>

      <div className="dashboard-divider-line-nd" />

      {/* SECTION 1: HEALTH TREND OVERVIEW */}
      <div className="dashboard-header-nd">
        <h2 className="dashboard-title-nd">Health Trend Overview</h2>
        <div className="filter-group-nd">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-input-nd filter-select-nd">
            <option value="current">Current Health Trends (Default)</option>
            <option value="weekly">Weekly Overview (By Month)</option>
            <option value="yearly">Yearly Overview</option>
          </select>
          {filterType === 'weekly' && (
            <input 
              type="month" 
              value={selectedMonth} 
              max={maxCurrentMonth} 
              onChange={(e) => {
                const val = e.target.value;
                if (!val || val <= maxCurrentMonth) setSelectedMonth(val);
              }} 
              className="filter-input-nd date-picker-nd" 
            />
          )}
          {filterType === 'yearly' && (
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-input-nd filter-select-year-nd">
              {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          )}
          <button type="button" className="export-btn-nd" onClick={handleExportHealthTrends}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="timeline-info-nd">
        <p className="period-label-nd">{periodLabel || "Loading timeline..."}</p>
        <p className="timeline-subtext-nd">{timelineLabel}</p>
      </div>

      <div className="graph-container-nd">
        {isLoading ? (
          <div className="loading-container-nd">
            <div className="spinner-nd"></div>
            <p className="loading-text-nd">Analyzing database records...</p>
          </div>
        ) : trendData.length === 0 ? (
          <div className="no-data-container-nd"><h3 className="no-data-title-nd">No Clinic Records Found</h3></div>
        ) : (
          <div className="chart-wrapper-nd">
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                {filterType === 'yearly' && isCurrentYearSelected && (
                  <ReferenceArea x1={currentRealTimeMonthName} x2={currentRealTimeMonthName} fill="#0250A3" fillOpacity={0.04} stroke="#0250A3" strokeOpacity={0.1} strokeDasharray="3 3" />
                )}
                <XAxis dataKey="name" tickLine={false} tick={(props) => <CustomXAxisTick {...props} filterType={filterType} isCurrentYearSelected={isCurrentYearSelected} currentMonthName={currentRealTimeMonthName} />} />
                <YAxis allowDecimals={false} tick={{ fill: '#4B5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip unitLabel="cases" />} cursor={{ fill: '#F3F4F6', opacity: 0.4 }} />
                <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={14} wrapperStyle={{ paddingTop: '15px' }} />
                
                {activeComplaintsInGraph.map((complaint) => (
                  <Bar key={complaint} dataKey={complaint} name={complaint} fill={getComplaintColor(complaint)} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {!isLoading && averages && (
        <div className="averages-container-nd">
          <h4 className="averages-title-nd">{averagesLabel}</h4>
          <div className={`collapsible-container-nd badge-collapsible-nd ${isAveragesExpanded ? 'expanded-nd' : ''}`}>
            <div className="averages-badges-wrapper-nd">
              {complaintsList.map((complaint) => (
                <div key={complaint} className="average-badge-card-nd">
                  <span className="badge-dot-nd" style={{ backgroundColor: getComplaintColor(complaint) }} />
                  <span className="badge-name-nd">{complaint}</span>
                  <span className="badge-value-nd">
                    {averages[complaint] !== undefined ? (
                      <>{formatCeilAvg(averages[complaint])} avg/mo</>
                    ) : (
                      '0 avg/mo'
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {complaintsList.length > 3 && (
            <button className="view-more-toggle-btn-nd" onClick={() => setIsAveragesExpanded(!isAveragesExpanded)}>
              {isAveragesExpanded ? <>View Less <ChevronUp size={14} /></> : <>View More <ChevronDown size={14} /></>}
            </button>
          )}
        </div>
      )}

      {/* SECTION 2: MEDICINE DISPENSED OVERVIEW */}
      <div className="dashboard-divider-line-nd" />

      <div className="dashboard-header-nd">
        <h2 className="dashboard-title-nd">Medicine Dispensed Overview</h2>
        <div className="filter-group-nd">
          <select value={dispensedFilterType} onChange={(e) => setDispensedFilterType(e.target.value)} className="filter-input-nd filter-select-nd">
            <option value="current">Current Medicine Dispensed (Default)</option>
            <option value="weekly">Weekly Overview (By Month)</option>
            <option value="yearly">Yearly Overview</option>
          </select>
          {dispensedFilterType === 'weekly' && (
            <input 
              type="month" 
              value={dispensedSelectedMonth} 
              max={maxCurrentMonth} 
              onChange={(e) => {
                const val = e.target.value;
                if (!val || val <= maxCurrentMonth) setDispensedSelectedMonth(val);
              }} 
              className="filter-input-nd date-picker-nd" 
            />
          )}
          {dispensedFilterType === 'yearly' && (
            <select value={dispensedSelectedYear} onChange={(e) => setDispensedSelectedYear(e.target.value)} className="filter-input-nd filter-select-year-nd">
              {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          )}
          <button type="button" className="export-btn-nd" onClick={handleExportMedicineDispensed}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="timeline-info-nd">
        <p className="period-label-nd">{dispensedPeriodLabel || "Loading dispensation timeline..."}</p>
        <p className="timeline-subtext-nd">{dispensedTimelineLabel}</p>
      </div>

      {isDispensedLoading ? (
        <div className="loading-container-nd">
          <div className="spinner-nd"></div>
          <p className="loading-text-nd">Analyzing medicine dispensation logs...</p>
        </div>
      ) : dispensedData.length === 0 ? (
        <div className="no-data-container-nd"><h3 className="no-data-title-nd">No Dispensation Records Found</h3></div>
      ) : (
        <>
          {/* GRAPH 1: STANDARD DOSAGE UNITS */}
          <div className="graph-container-nd">
            <h3 className="chart-subtitle-nd">Standard Dosage Units (mg, g, mcg, mL, L)</h3>
            {standardMedicinesInGraph.length === 0 ? (
              <div className="no-data-container-nd" style={{ padding: '20px' }}>
                <p className="no-data-title-nd" style={{ fontSize: '14px' }}>No records found for standard dosage units.</p>
              </div>
            ) : (
              <div className="chart-wrapper-nd">
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={dispensedData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    {dispensedFilterType === 'yearly' && isDispensedCurrentYearSelected && (
                      <ReferenceArea x1={currentRealTimeMonthName} x2={currentRealTimeMonthName} fill="#0250A3" fillOpacity={0.04} stroke="#0250A3" strokeOpacity={0.1} strokeDasharray="3 3" />
                    )}
                    <XAxis dataKey="name" tickLine={false} tick={(props) => <CustomXAxisTick {...props} filterType={dispensedFilterType} isCurrentYearSelected={isDispensedCurrentYearSelected} currentMonthName={currentRealTimeMonthName} />} />
                    <YAxis allowDecimals={false} tick={{ fill: '#4B5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unitLabel="dispensed" medicinesUnitsMap={combinedUnitsMap} showBrandOnly={true} />} cursor={{ fill: '#F3F4F6', opacity: 0.4 }} />
                    <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={14} wrapperStyle={{ paddingTop: '15px' }} />
                    
                    {standardMedicinesInGraph.map((medicine) => (
                      <Bar key={medicine} dataKey={medicine} name={medicine} fill={getMedicineColor(medicine)} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* GRAPH 2: OTHER UNITS OF MEASURE */}
          <div className="graph-container-nd">
            <h3 className="chart-subtitle-nd">Other Units of Measure</h3>
            {otherMedicinesInGraph.length === 0 ? (
              <div className="no-data-container-nd" style={{ padding: '20px' }}>
                <p className="no-data-title-nd" style={{ fontSize: '14px' }}>No records found for other units of measure.</p>
              </div>
            ) : (
              <div className="chart-wrapper-nd">
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={dispensedData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    {dispensedFilterType === 'yearly' && isDispensedCurrentYearSelected && (
                      <ReferenceArea x1={currentRealTimeMonthName} x2={currentRealTimeMonthName} fill="#0250A3" fillOpacity={0.04} stroke="#0250A3" strokeOpacity={0.1} strokeDasharray="3 3" />
                    )}
                    <XAxis dataKey="name" tickLine={false} tick={(props) => <CustomXAxisTick {...props} filterType={dispensedFilterType} isCurrentYearSelected={isDispensedCurrentYearSelected} currentMonthName={currentRealTimeMonthName} />} />
                    <YAxis allowDecimals={false} tick={{ fill: '#4B5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unitLabel="dispensed" medicinesUnitsMap={combinedUnitsMap} showBrandOnly={true} />} cursor={{ fill: '#F3F4F6', opacity: 0.4 }} />
                    <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={14} wrapperStyle={{ paddingTop: '15px' }} />
                    
                    {otherMedicinesInGraph.map((medicine) => (
                      <Bar key={medicine} dataKey={medicine} name={medicine} fill={getMedicineColor(medicine)} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}

      {!isDispensedLoading && (dispensedAverages || dispensedData.length > 0) && (
        <div className="averages-container-nd">
          <h4 className="averages-title-nd">{dispensedAveragesLabel || "Average Medicine Dispensed per Month"}</h4>
          <div className={`collapsible-container-nd badge-collapsible-nd ${isDispensedAveragesExpanded ? 'expanded-nd' : ''}`}>
            <div className="averages-badges-wrapper-nd">
              {medicinesList.map((medicine) => {
                const unit = combinedUnitsMap[medicine] || 'dispensed';
                let avgValue = dispensedAverages?.[medicine];

                if (avgValue === undefined || avgValue === null) {
                  if (dispensedData.length > 0) {
                    const total = dispensedData.reduce((sum, item) => sum + (Number(item[medicine]) || 0), 0);
                    avgValue = total > 0 ? (total / dispensedData.length) : 0;
                  } else {
                    avgValue = 0;
                  }
                }

                return (
                  <div key={medicine} className="average-badge-card-nd">
                    <span className="badge-dot-nd" style={{ backgroundColor: getMedicineColor(medicine) }} />
                    <span className="badge-name-nd">{medicine}</span>
                    <span className="badge-value-nd">
                      {formatCeilAvg(avgValue)} {unit}/mo
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {medicinesList.length > 3 && (
            <button className="view-more-toggle-btn-nd" onClick={() => setIsDispensedAveragesExpanded(!isDispensedAveragesExpanded)}>
              {isDispensedAveragesExpanded ? <>View Less <ChevronUp size={14} /></> : <>View More <ChevronDown size={14} /></>}
            </button>
          )}
        </div>
      )}

      {/* SECTION 3: PREDICTIVE MEDICINE DEMAND */}
      <div className="dashboard-divider-line-nd" />

      <div className="dashboard-header-nd">
        <h2 className="dashboard-title-nd">{predictiveTitle}</h2>
        <div className="filter-group-nd">
          <label className="filter-label-nd">Select Month: </label>
          <input 
            type="month" 
            value={predictiveMonth} 
            max={defaultNextMonth}
            onChange={(e) => {
              const selectedValue = e.target.value;
              if (!selectedValue || selectedValue <= defaultNextMonth) {
                setPredictiveMonth(selectedValue);
              }
            }} 
            className="filter-input-nd date-picker-nd" 
          />
          <button type="button" className="export-btn-nd" onClick={handleExportPredictiveDemand}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="graph-container-nd">
        {isPredictiveLoading ? (
          <div className="loading-container-nd">
            <div className="spinner-nd"></div>
            <p className="loading-text-nd">Calculating container package stock requirements...</p>
          </div>
        ) : activePredictiveData.length === 0 ? (
          <div className="no-data-container-nd"><h3 className="no-data-title-nd">No Predictive Demand Records Found</h3></div>
        ) : (
          <div className="chart-wrapper-nd scrollable-chart-nd">
            <div style={{ width: predictiveChartMinWidth, height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activePredictiveData} margin={{ top: 20, right: 30, left: 10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                  <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} tick={{ fontSize: 12, fill: '#4B5563', fontWeight: 500 }} tickLine={false} />
                  <YAxis tick={{ fill: '#4B5563', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<PredictiveTooltip />} cursor={{ fill: '#F3F4F6', opacity: 0.4 }} />
                  <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={14} wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="currentStock" name="Current Stock (Dosage Form)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="predictedNeed" name="Predicted Need (Packages/Bottles)" fill="#F97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {!isPredictiveLoading && predictiveData.length > 0 && (
        <div className="averages-container-nd">
          <h4 className="averages-title-nd">Predictive Calculation Breakdown (Dispense Avg / Container Strength)</h4>
          <div className={`collapsible-container-nd card-collapsible-nd ${isPredictiveExpanded ? 'expanded-nd' : ''}`}>
            <div className="predictive-mapping-grid-nd">
              {predictiveData.map((med, index) => (
                <div key={index} className="predictive-mapping-card-nd">
                  <div className="predictive-card-title-nd">{med.name}</div>
                  <div className="predictive-card-text-nd">
                    <strong>Package Strength: </strong>{med.packageStrength} ({med.dosageForm})<br />
                    <strong>Stock at Date: </strong>{med.currentStock} {pluralize(med.dosageForm, med.currentStock)}<br />
                    <strong>Monthly Avg Dispense: </strong>{formatCeilAvg(med.avgMonthlyDispensedBase)} {med.unitOfMeasure}<br />
                    <strong>Calculated Container Demand: </strong>{formatCeilAvg(med.predictedNeed)} package(s)/bottle(s)
                  </div>
                </div>
              ))}
            </div>
          </div>
          {predictiveData.length > 2 && (
            <button className="view-more-toggle-btn-nd" onClick={() => setIsPredictiveExpanded(!isPredictiveExpanded)}>
              {isPredictiveExpanded ? <>View Less <ChevronUp size={14} /></> : <>View More <ChevronDown size={14} /></>}
            </button>
          )}
        </div>
      )}

      {/* SECTION 4: DETAILED PANELS GRID */}
      <div className="dashboard-divider-line-nd" />

      <div className="dashboard-section-header-nd">
        <h2 className="dashboard-title-nd">Detailed Clinic Records & Deadlines</h2>
      </div>

      {!isNurseDashboardLoading && (
        <div className="dashboard-details-grid-nd">
          
          {/* 1. Upcoming Requirement Deadlines Details */}
          <div className="detail-panel-nd">
            <div className="panel-header-nd">
              <div className="panel-title-wrapper-nd">
                <Clock size={18} className="panel-icon-nd text-blue-nd" />
                <h3 className="panel-title-nd">Upcoming Requirement Deadlines</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge-nd">{nurseDashboardData.upcomingRequirementDeadlines.length}</span>
                <button 
                  style={viewAllBtnStyle} 
                  onClick={() => navigate('/RequirementManagement')}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f0f5fa'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="panel-content-nd">
              {nurseDashboardData.upcomingRequirementDeadlines.length === 0 ? (
                <div className="panel-empty-nd">No upcoming requirement deadlines recorded.</div>
              ) : (
                <div className="table-responsive-nd">
                  <table className="overview-table-nd">
                    <thead>
                      <tr>
                        <th>Requirement Name</th>
                        <th>Type</th>
                        <th>Target Scope</th>
                        <th>Deadline</th>
                        <th>Late Submission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nurseDashboardData.upcomingRequirementDeadlines.map((req, idx) => (
                        <tr key={req.id || idx}>
                          <td className="font-semibold-nd">{req.requirement_name}</td>
                          <td>
                            <span className={`badge-pill-nd ${req.requirement_type === 'Program' ? 'badge-program-nd' : 'badge-special-nd'}`}>
                              {req.requirement_type}
                            </span>
                          </td>
                          <td className="text-muted-nd">
                            {req.requirement_type === 'Program' 
                              ? `Program: ${req.program_name || req.program_code || 'All Programs'} (Yr ${req.year_level || 'All'})`
                              : `Student: ${req.student_name || 'Specific Student'}`
                            }
                          </td>
                          <td className="text-highlight-nd">{formatDate(req.submission_deadline)}</td>
                          <td>
                            <span className={`status-tag-nd ${req.allow_late_submission ? 'tag-allowed-nd' : 'tag-strict-nd'}`}>
                              {req.allow_late_submission ? 'Allowed' : 'Not Allowed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 2. Medicine Inventory Low & Critical Batch Stock Details */}
          <div className="detail-panel-nd">
            <div className="panel-header-nd">
              <div className="panel-title-wrapper-nd">
                <Pill size={18} className="panel-icon-nd text-red-nd" />
                <h3 className="panel-title-nd">Medicine Stock Level Alerts</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge-nd count-badge-red-nd">{nurseDashboardData.medicineStockAlerts.length}</span>
                <button 
                  style={viewAllBtnStyle} 
                  onClick={() => navigate('/MedicineInventory')}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f0f5fa'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="panel-content-nd">
              {nurseDashboardData.medicineStockAlerts.length === 0 ? (
                <div className="panel-empty-nd panel-empty-success-nd">
                  <CheckCircle2 size={18} color="#10B981" />
                  <span>All medicine batch stock levels are currently adequate.</span>
                </div>
              ) : (
                <div className="table-responsive-nd">
                  <table className="overview-table-nd">
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Form</th>
                        <th>Current Stock</th>
                        <th>Thresholds (Low / Crit)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nurseDashboardData.medicineStockAlerts.map((med) => (
                        <tr key={med.batch_id || med.medicine_id}>
                          <td>
                            <div className="font-semibold-nd">{med.generic_name}</div>
                            {med.brand_name && <div className="text-xs-nd text-muted-nd">({med.brand_name})</div>}
                          </td>
                          <td>{med.dosage_form || 'N/A'}</td>
                          <td>
                            <strong className={med.stock_status === 'CRITICAL' ? 'text-red-nd' : 'text-orange-nd'}>
                              {med.current_stock}
                            </strong>
                          </td>
                          <td className="text-xs-nd text-muted-nd">
                            Low: {med.low_stock_level} | Crit: {med.critical_stock_level}
                          </td>
                          <td>
                            <span className={`status-badge-nd ${med.stock_status === 'CRITICAL' ? 'badge-critical-nd' : 'badge-low-nd'}`}>
                              {med.stock_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* 3. Upcoming Health Screenings Details */}
          <div className="detail-panel-nd">
            <div className="panel-header-nd">
              <div className="panel-title-wrapper-nd">
                <Activity size={18} className="panel-icon-nd text-green-nd" />
                <h3 className="panel-title-nd">Upcoming Health Screenings</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge-nd">{upcomingHealthScreenings.length}</span>
                <button 
                  style={viewAllBtnStyle} 
                  onClick={() => navigate('/HealthScreening')}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f0f5fa'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="panel-content-nd">
              {upcomingHealthScreenings.length === 0 ? (
                <div className="panel-empty-nd">No upcoming health screenings scheduled.</div>
              ) : (
                <div className="cards-list-nd">
                  {upcomingHealthScreenings.map((screen) => (
                    <div key={screen.screening_schedule_id} className="detail-card-nd border-left-green-nd">
                      <div className="card-top-row-nd">
                        <h4 className="card-item-title-nd">{screen.title}</h4>
                        <span className="badge-pill-nd badge-green-nd">{screen.screening_type || 'Screening'}</span>
                      </div>
                      <div className="card-meta-grid-nd">
                        <div>
                          <Calendar size={13} className="inline-icon-nd" />
                          <strong>Date:</strong> {formatDate(screen.scheduled_date)}
                        </div>
                        <div>
                          <Clock size={13} className="inline-icon-nd" />
                          <strong>Time:</strong> {formatTime(screen.start_time)} - {formatTime(screen.end_time)}
                        </div>
                        <div>
                          <GraduationCap size={13} className="inline-icon-nd" />
                          <strong>Target:</strong> Program: {screen.target_program_name || screen.target_program || 'All Programs'}, Yr {screen.target_year_level || 'All'} ({screen.target_section || 'All Sections'})
                        </div>
                      </div>
                      {screen.announcement && (
                        <div className="card-announcement-nd">
                          <strong>Announcement:</strong> {screen.announcement}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 4. Upcoming Doctor Visits Details */}
          <div className="detail-panel-nd">
            <div className="panel-header-nd">
              <div className="panel-title-wrapper-nd">
                <Stethoscope size={18} className="panel-icon-nd text-purple-nd" />
                <h3 className="panel-title-nd">Upcoming Doctor Visits</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge-nd">{upcomingDoctorVisits.length}</span>
                <button 
                  style={viewAllBtnStyle} 
                  onClick={() => navigate('/DoctorVisit')}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f0f5fa'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <div className="panel-content-nd">
              {upcomingDoctorVisits.length === 0 ? (
                <div className="panel-empty-nd">No upcoming doctor visits scheduled.</div>
              ) : (
                <div className="cards-list-nd">
                  {upcomingDoctorVisits.map((visit) => (
                    <div key={visit.appointment_id} className="detail-card-nd border-left-purple-nd">
                      <div className="card-top-row-nd">
                        <h4 className="card-item-title-nd">{visit.title || `Doctor Visit`}</h4>
                        <span className="badge-pill-nd badge-purple-nd">{visit.status || 'Scheduled'}</span>
                      </div>
                      <div className="card-meta-grid-nd">
                        <div>
                          <Clock size={13} className="inline-icon-nd" />
                          <strong>Schedule:</strong> {formatDateTime(visit.start_time)}
                        </div>
                        <div>
                          <UserCheck size={13} className="inline-icon-nd" />
                          <strong>Doctor:</strong> {visit.doctor_name || visit.doctor || 'Assigned Doctor'}
                        </div>
                        {visit.assigned_by_nurse_name && (
                          <div>
                            <strong>Assigned By:</strong> Nurse {visit.assigned_by_nurse_name}
                          </div>
                        )}
                      </div>
                      {visit.announcement && (
                        <div className="card-announcement-nd">
                          <strong>Notes:</strong> {visit.announcement}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* SECTION 5: FREQUENT COMPLAINT ALERTS */}
      <div className="dashboard-divider-line-nd" />

      <div className="dashboard-header-nd">
        <div className="title-with-badge-nd">
          <h2 className="dashboard-title-nd">Frequent Complaint Alerts</h2>
          {alerts.length > 0 && <span className="alert-count-badge-nd">{alerts.length}</span>}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button type="button" className="export-btn-nd" onClick={handleExportFrequentComplaints}>
            <Download size={16} /> Export
          </button>
          <button className="view-all-btn-nd" onClick={() => setIsModalOpen(true)}>
            <Eye size={16} /> View All Alerts
          </button>
        </div>
      </div>
      <p className="section-subtitle-nd">Students with recurring clinic visits for similar health concerns</p>

      {isAlertsLoading ? (
        <div className="loading-container-nd">
          <div className="spinner-nd"></div>
          <p className="loading-text-nd">Checking frequent visit patterns...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty-alert-card-nd">
          <div className="empty-icon-nd"><CheckCircle2 size={32} /></div>
          <h3 className="empty-title-nd">No Frequent Complaint Alerts</h3>
          <p className="empty-subtext-nd">All student clinic visit patterns are currently within standard ranges.</p>
        </div>
      ) : (
        <div className="frequent-alerts-grid-nd">
          {alerts.slice(0, 3).map((alert, idx) => (
            <div key={idx} className="alert-card-nd">
              <div>
                <div className="alert-card-header-nd">
                  <div>
                    <h4 className="alert-student-name-nd">{alert.studentName}</h4>
                    <span className="alert-student-id-nd">ID: {alert.studentId}</span>
                  </div>
                  <span className="visit-badge-nd">{alert.visitCount} Visits / Mo</span>
                </div>
                <div className="complaint-chip-nd">
                  <strong>Complaint:</strong> {alert.complaint}
                </div>
                <div className="advice-box-nd">
                  <div className="advice-header-nd">
                    <Lightbulb size={14} />
                    <strong>Clinical Advice:</strong>
                  </div>
                  <p className="advice-text-nd">{alert.advice}</p>
                </div>
              </div>
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                <button 
                  className="retry-btn-nd" 
                  style={{ height: '34px', fontSize: '12.5px', padding: '0 12px', flex: 1 }}
                  onClick={() => handleViewDetails(alert)}
                >
                  View Visit Log
                </button>
                <button 
                  className="retry-btn-nd" 
                  style={{ height: '34px', fontSize: '12.5px', padding: '0 12px', backgroundColor: '#EF4444' }}
                  onClick={() => handleDismissAlert(alert.studentId, alert.complaint)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ANNOUNCEMENT CRUD MODAL */}
      {isAnnouncementModalOpen && (
        <div className="modal-overlay-nd" onClick={() => setIsAnnouncementModalOpen(false)}>
          <div className="modal-container-nd modal-container-narrow-nd" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-nd">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={20} color="#0250A3" />
                <div>
                  <h3 className="modal-title-nd">
                    {announcementModalTab === 'EDIT' 
                      ? 'Edit Announcement' 
                      : announcementModalTab === 'LIST' 
                      ? 'Active & Scheduled Announcements Directory' 
                      : 'Post New Announcement'}
                  </h3>
                  <p className="modal-subtitle-nd">Broadcast and manage targeted campus health notices</p>
                </div>
              </div>
              <button className="modal-close-btn-nd" onClick={() => setIsAnnouncementModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* TAB NAVIGATION HEADER */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 0 20px', borderBottom: '1px solid #E5E7EB' }}>
              <button
                type="button"
                style={{
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: announcementModalTab === 'CREATE' ? '#0250A3' : '#F3F4F6',
                  color: announcementModalTab === 'CREATE' ? '#FFF' : '#374151',
                  border: 'none',
                  borderRadius: '6px 6px 0 0'
                }}
                onClick={() => handleOpenAnnouncementModal('CREATE')}
              >
                <Plus size={14} style={{ display: 'inline', marginRight: '4px' }} /> Post New
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: announcementModalTab === 'LIST' ? '#0250A3' : '#F3F4F6',
                  color: announcementModalTab === 'LIST' ? '#FFF' : '#374151',
                  border: 'none',
                  borderRadius: '6px 6px 0 0'
                }}
                onClick={() => {
                  setAnnouncementModalTab('LIST');
                  fetchAnnouncements();
                }}
              >
                Manage Active Notices ({announcementsList.length})
              </button>
            </div>

            <div className="modal-body-scroll-nd" style={{ padding: '20px' }}>
              {/* LIST TAB: READ, EDIT, DELETE ACTIVE, UPCOMING & EXPIRED NOTICES */}
              {announcementModalTab === 'LIST' ? (
                <div>
                  {isAnnouncementLoading ? (
                    <div className="loading-container-nd" style={{ height: '180px' }}>
                      <div className="spinner-nd"></div>
                      <p className="loading-text-nd">Fetching announcements...</p>
                    </div>
                  ) : announcementsList.length === 0 ? (
                    <div className="panel-empty-nd">No announcements recorded.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {announcementsList.map((ann) => {
                        const statusInfo = getAnnouncementStatusInfo(ann.start_at, ann.expires_at);

                        return (
                          <div 
                            key={ann.announcement_id || ann.id} 
                            style={{
                              border: `1px solid ${statusInfo.border}`,
                              borderRadius: '8px',
                              padding: '14px',
                              backgroundColor: '#FAFAFA'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                                  {ann.title}
                                </h4>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  color: statusInfo.color,
                                  backgroundColor: statusInfo.bg,
                                  border: `1px solid ${statusInfo.border}`,
                                  padding: '2px 8px',
                                  borderRadius: '12px'
                                }}>
                                  {statusInfo.label}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  style={{
                                    background: '#EFF6FF',
                                    border: '1px solid #BFDBFE',
                                    color: '#1D4ED8',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => handleOpenAnnouncementModal('EDIT', ann)}
                                >
                                  <Edit3 size={13} /> Edit / Update
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    background: '#FEE2E2',
                                    border: '1px solid #FCA5A5',
                                    color: '#991B1B',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                  }}
                                  onClick={() => handleDeleteAnnouncement(ann.announcement_id || ann.id, ann.title)}
                                >
                                  <Trash2 size={13} /> Delete / Cancel
                                </button>
                              </div>
                            </div>

                            <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                              {ann.content}
                            </p>

                            <div style={{ fontSize: '11px', color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                              <span><strong>Target Audience:</strong> {ann.target_audience}</span>
                              <span><strong>Start Date:</strong> {formatDateTime(ann.start_at)}</span>
                              <span><strong>Expiration Date:</strong> {formatDateTime(ann.expires_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* FORM TAB: CREATE / EDIT */
                <form onSubmit={handleAnnouncementSubmit}>
                  {announcementError && (
                    <div style={{ padding: '10px 14px', backgroundColor: '#FEE2E2', color: '#991B1B', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} />
                      <span>{announcementError}</span>
                    </div>
                  )}

                  {/* Title */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                      Announcement Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Annual Student Physical Health Examination 2026"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                      className="filter-input-nd"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Content */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                      Announcement Details / Content *
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Write full announcement details here..."
                      value={announcementForm.content}
                      onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                      className="filter-input-nd"
                      style={{ width: '100%', height: 'auto', padding: '8px 12px' }}
                    />
                  </div>

                  {/* Target Audience */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                      Target Audience *
                    </label>
                    <select
                      value={announcementForm.target_audience}
                      onChange={(e) => setAnnouncementForm(prev => ({ ...prev, target_audience: e.target.value }))}
                      className="filter-input-nd filter-select-nd"
                      style={{ width: '100%' }}
                    >
                      <option value="BOTH">Both Students & Parents</option>
                      <option value="STUDENT">Students Only</option>
                      <option value="PARENT">Parents Only</option>
                    </select>
                  </div>

                  {/* Program & Year Level Filters */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                        Target Program (Optional)
                      </label>
                      <select
                        value={announcementForm.target_program_id}
                        onChange={(e) => setAnnouncementForm(prev => ({ ...prev, target_program_id: e.target.value }))}
                        className="filter-input-nd filter-select-nd"
                        style={{ width: '100%' }}
                      >
                        <option value="">All Programs</option>
                        {programsList.map((prog) => (
                          <option key={prog.program_id || prog.id} value={prog.program_id || prog.id}>
                            {prog.program_name || prog.code || prog.program_id}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                        Target Year Level (Optional)
                      </label>
                      <select
                        value={announcementForm.target_year_level}
                        onChange={(e) => setAnnouncementForm(prev => ({ ...prev, target_year_level: e.target.value }))}
                        className="filter-input-nd filter-select-nd"
                        style={{ width: '100%' }}
                      >
                        <option value="">All Year Levels</option>
                        <option value="1">1st Year</option>
                        <option value="2">2nd Year</option>
                        <option value="3">3rd Year</option>
                        <option value="4">4th Year</option>
                      </select>
                    </div>
                  </div>

                  {/* Start Date & End Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                        Start Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={announcementForm.start_at}
                        onChange={(e) => setAnnouncementForm(prev => ({ ...prev, start_at: e.target.value }))}
                        className="filter-input-nd date-picker-nd"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '6px', color: '#374151' }}>
                        Expiration Date & Time *
                      </label>
                      <input
                        type="datetime-local"
                        required
                        value={announcementForm.expires_at}
                        onChange={(e) => setAnnouncementForm(prev => ({ ...prev, expires_at: e.target.value }))}
                        className="filter-input-nd date-picker-nd"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* System & Push Notification Flag on Edit */}
                  {announcementModalTab === 'EDIT' && (
                    <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="notify_update_check"
                        checked={announcementForm.notify_update}
                        onChange={(e) => setAnnouncementForm(prev => ({ ...prev, notify_update: e.target.checked }))}
                      />
                      <label htmlFor="notify_update_check" style={{ fontSize: '13px', color: '#374151', cursor: 'pointer' }}>
                        Resend System & Web Push Notification to target recipients upon update
                      </label>
                    </div>
                  )}

                  <div className="modal-footer-nd" style={{ padding: '0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="modal-close-secondary-btn-nd"
                      onClick={() => setIsAnnouncementModalOpen(false)}
                      disabled={isAnnouncementSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="export-btn-nd"
                      style={{ backgroundColor: '#0250A3', color: '#FFF', border: 'none' }}
                      disabled={isAnnouncementSubmitting}
                    >
                      <Send size={15} />{' '}
                      {isAnnouncementSubmitting
                        ? 'Saving...'
                        : announcementModalTab === 'EDIT'
                        ? 'Update Announcement'
                        : 'Publish Announcement'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ALL ALERTS MODAL */}
      {isModalOpen && (
        <div className="modal-overlay-nd" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container-nd" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-nd">
              <div>
                <h3 className="modal-title-nd">Frequent Complaint Alerts</h3>
                <p className="modal-subtitle-nd">Complete list of students requiring recurring care attention</p>
              </div>
              <button className="modal-close-btn-nd" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-filter-bar-nd">
              <div className="search-input-wrapper-nd">
                <Search size={16} className="search-icon-nd" />
                <input
                  type="text"
                  placeholder="Search by student name, ID, or complaint..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="filter-input-nd modal-search-input-nd"
                />
              </div>
              <div className="date-input-wrapper-nd">
                <Calendar size={16} className="date-icon-nd" />
                <input
                  type="month"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="filter-input-nd date-picker-nd"
                />
              </div>
              {modalDate && (
                <button className="clear-date-btn-nd" onClick={() => setModalDate('')}>
                  Clear Date
                </button>
              )}
            </div>

            <div className="modal-body-scroll-nd">
              <div className="modal-alerts-table-wrapper-nd">
                <table className="modal-alerts-table-nd">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Complaint</th>
                      <th>Monthly Visits</th>
                      <th>Clinical Advice</th>
                      <th className="action-col-header-nd">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="empty-table-cell-nd">No alerts found.</td>
                      </tr>
                    ) : (
                      alerts.map((alert, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="table-student-name-nd">{alert.studentName}</div>
                            <div className="table-student-id-nd">{alert.studentId}</div>
                          </td>
                          <td>
                            <span className="complaint-tag-nd">{alert.complaint}</span>
                          </td>
                          <td>
                            <span className="visit-badge-table-nd">{alert.visitCount} visits</span>
                          </td>
                          <td>
                            <div className="table-advice-cell-nd">{alert.advice}</div>
                          </td>
                          <td className="action-col-cell-nd">
                            <button 
                              className="row-action-icon-btn-nd" 
                              title="View Visit Log"
                              onClick={() => handleViewDetails(alert)}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer-nd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="export-btn-nd" onClick={handleExportFrequentComplaints}>
                <Download size={16} /> Export PDF Report
              </button>
              <button className="modal-close-secondary-btn-nd" onClick={() => setIsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL VISIT LOGS MODAL */}
      {isDetailModalOpen && selectedAlertHeader && (
        <div className="modal-overlay-nd" onClick={() => setIsDetailModalOpen(false)}>
          <div className="modal-container-nd modal-container-narrow-nd" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-nd">
              <div>
                <h3 className="modal-title-nd">Recurring Visit History</h3>
                <p className="modal-subtitle-nd">
                  <strong>{selectedAlertHeader.studentName}</strong> ({selectedAlertHeader.studentId})
                  {selectedAlertHeader.gradeSection ? ` \u2014 ${selectedAlertHeader.gradeSection}` : ''} |{' '}
                  <span className="modal-complaint-label-nd">{selectedAlertHeader.complaint}</span>
                </p>
              </div>
              <button className="modal-close-btn-nd" onClick={() => setIsDetailModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-scroll-nd">
              {isDetailLoading ? (
                <div className="loading-container-nd" style={{ height: '220px' }}>
                  <div className="spinner-nd"></div>
                  <p className="loading-text-nd">Fetching student visit logs...</p>
                </div>
              ) : detailVisits.length === 0 ? (
                <div className="panel-empty-nd">No individual visit records found for this timeframe.</div>
              ) : (
                <div className="visit-list-nd">
                  {detailVisits.map((visit, idx) => (
                    <div key={visit.visitId || idx} className="visit-card-nd">
                      <div className="visit-card-header-nd">
                        <div className="visit-title-group-nd">
                          <span className="visit-number-nd">Visit #{detailVisits.length - idx}</span>
                          <span className="complaint-tag-nd">{visit.complaint || visit.chief_complaint || selectedAlertHeader.complaint}</span>
                        </div>
                        <div className="visit-time-meta-nd">
                          <Calendar size={13} />
                          <span>
                            {formatDate(visit.visitDate || visit.visit_date || visit.created_at)} &bull; {formatTime(visit.timeIn || visit.time_in)}
                            {visit.timeOut || visit.time_out ? ` - ${formatTime(visit.timeOut || visit.time_out)}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="vitals-grid-nd">
                        <div className="vital-sign-nd">
                          <strong>Blood Pressure</strong>
                          <span>{visit.bloodPressure || visit.blood_pressure || 'N/A'}</span>
                        </div>
                        <div className="vital-sign-nd">
                          <strong>Temperature</strong>
                          <span>{visit.temperature ? `${visit.temperature} °C` : 'N/A'}</span>
                        </div>
                        <div className="vital-sign-nd">
                          <strong>Resp. Rate</strong>
                          <span>{visit.respiratoryRate || visit.respiratory_rate ? `${visit.respiratoryRate || visit.respiratory_rate} cpm` : 'N/A'}</span>
                        </div>
                        <div className="vital-sign-nd">
                          <strong>Pulse Rate</strong>
                          <span>{visit.pulseRate || visit.pulse_rate ? `${visit.pulseRate || visit.pulse_rate} bpm` : 'N/A'}</span>
                        </div>
                      </div>

                      <div className="visit-note-grid-nd">
                        <div className="visit-note-nd intervention-note-nd">
                          <strong>Nursing Intervention:</strong>
                          <p>{visit.nursingIntervention || visit.nursing_intervention || visit.treatment_provided || visit.treatment || 'No specific intervention logged.'}</p>
                        </div>
                        <div className="visit-note-nd advice-note-nd">
                          <strong>Assessment & Remarks:</strong>
                          <p>{visit.assessment || visit.remarks || visit.notes || 'No assessment added.'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer-nd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button" 
                className="export-btn-nd" 
                onClick={handleExportStudentVisitHistory}
                disabled={isDetailLoading || detailVisits.length === 0}
              >
                <Download size={16} /> Export Student Log PDF
              </button>
              <button className="modal-close-secondary-btn-nd" onClick={() => setIsDetailModalOpen(false)}>
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NurseDashboard;