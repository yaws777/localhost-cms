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
  ResponsiveContainer,
  ComposedChart,
  Line
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
  Clock,
  Pill,
  QrCode,
  AlertCircle,
  FileCheck,
  ShieldAlert,
  Download,
  Megaphone,
  Send,
  Edit3,
  Trash2,
  FolderHeart,
  Plus
} from 'lucide-react';
import DashboardCalendar from '../../components/nurse/DashboardCalendar';
import stiLogo from '../../assets/sti-logof.png';
import { formatMonthDay, formatTime as formatTimeBase, formatDate as formatDateBase, formatDateTime as formatDateTimeBase } from '../../utils/datetime';
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
  // Stored labels such as "Tablet/s" or "Patch/es": singular is the base, plural adds the suffix
  const slashForm = /^(.+?)\s*[/(]\s*(e?s)\)?$/i.exec(String(word).trim());
  if (slashForm) return count <= 1 ? slashForm[1] : `${slashForm[1]}${slashForm[2]}`;
  if (count <= 1) return word;
  return /(x|s|ch|sh|z)$/i.test(word) ? `${word}es` : `${word}s`;
};

// Same rule for unit labels, but measurement symbols (mg, ml, ...) and non-nouns ("dispensed") stay as they are
const pluralizeUnit = (unit, count) => {
  if (!unit || isStandardUnit(unit) || unit === 'dispensed') return unit;
  return pluralize(unit, count);
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
        <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>({rawFormatted})</span>
      </>
    );
  }
  return <strong>{ceilVal}</strong>;
};

const getCurrentMonthString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getTodayString = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

// A custom range of up to 31 days is charted one bar per day (stacked), anything longer one bar per month
const isDailyRange = (from, to) => {
  if (!from || !to) return true;
  const days = Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1;
  return days <= 31;
};

// Normalize MySQL date strings (YYYY-MM-DD HH:mm:ss) to standard ISO format for safe JS Date parsing
const parseSafeDate = (d) => {
  if (!d) return new Date(NaN);
  if (d instanceof Date) return d;
  const isoStr = String(d).replace(' ', 'T');
  return new Date(isoStr);
};

const formatDateTimeForInput = (d) => {
  if (!d) return '';
  const date = parseSafeDate(d);
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
  const date = parseSafeDate(dateString);
  if (isNaN(date.getTime())) return dateString;
  return formatDateBase(date);
};

const formatDateTime = (dateTimeString) => {
  if (!dateTimeString) return 'N/A';
  const date = parseSafeDate(dateTimeString);
  if (isNaN(date.getTime())) return dateTimeString;
  return formatDateTimeBase(date);
};

const formatTime = (timeString) => {
  if (!timeString) return 'N/A';
  if (timeString.includes('T') || timeString.includes('-')) {
    const date = parseSafeDate(timeString);
    if (!isNaN(date.getTime())) {
      return formatTimeBase(date);
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
    scheduleDate = parseSafeDate(timeStr);
  } else if (dateStr && (dateStr.includes('T') || dateStr.includes('Z'))) {
    scheduleDate = parseSafeDate(dateStr);
  } else if (dateStr && timeStr) {
    const cleanDate = dateStr.split('T')[0];
    scheduleDate = parseSafeDate(`${cleanDate}T${timeStr}`);
  } else if (dateStr) {
    scheduleDate = parseSafeDate(dateStr);
  } else if (timeStr) {
    scheduleDate = parseSafeDate(timeStr);
  }

  if (!scheduleDate || isNaN(scheduleDate.getTime())) return true;
  return scheduleDate > now;
};

// Helper function to calculate announcement active status dynamically across all browsers
const getAnnouncementStatusInfo = (startAt, expiresAt) => {
  const now = new Date();
  const start = parseSafeDate(startAt);
  const expires = parseSafeDate(expiresAt);

  if (isNaN(start.getTime()) || isNaN(expires.getTime())) {
    return { label: 'UNKNOWN', color: 'var(--text-secondary)', bg: 'var(--bg-muted)', border: 'var(--card-border)' };
  }

  if (now < start) {
    return { label: 'UPCOMING', color: 'var(--text-brand)', bg: 'var(--sti-blue-light)', border: 'var(--card-border)' };
  } else if (now >= start && now <= expires) {
    return { label: 'ONGOING', color: 'var(--status-adequate-text)', bg: 'var(--status-adequate-bg)', border: 'var(--card-border)' };
  } else {
    return { label: 'EXPIRED', color: 'var(--text-secondary)', bg: 'var(--bg-muted)', border: 'var(--card-border)' };
  }
};

/* --- PDF REPORT GENERATOR HELPER --- */
const generatePDFReport = (title, periodText, tableHeaders, tableRows, onError) => {
  const printWindow = window.open('', '_blank', 'width=900,height=750');
  if (!printWindow) {
    if (onError) onError('Please allow popups in your browser settings to export the PDF report.');
    return;
  }

  const currentDateStr = formatDate(new Date());

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
// Shows both phases of the rolling forecast for the hovered target day
const ForecastTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const day = payload[0].payload;
  const p1 = day.phase1_prediction;
  const p2 = day.phase2_windowShift;
  const fmt = (n) => parseFloat(Number(n).toFixed(2));
  // Window for target day t+k is the 30 days before it (t+k-30 .. t+k-1); after the shift it is t+k-29 .. t+k.
  const shiftDate = (dateStr, days) => {
    const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
  };
  const oldestDate = shiftDate(day.targetDate, -30);
  const activeWindowRange = `${formatDateBase(oldestDate)} – ${formatDateBase(shiftDate(day.targetDate, -1))}`;
  const newWindowRange = `${formatDateBase(shiftDate(day.targetDate, -29))} – ${formatDateBase(day.targetDate)}`;
  // e.g. "20 − 1 = 19"; when the day's demand exceeds the stock left, the result is floored at 0 ("4 − 7 = −3 → 0")
  const stockDiff = parseFloat((day.stockBefore - p1.predictedDemand).toFixed(3));
  const stockLeftComputation = stockDiff < 0
    ? `${fmt(day.stockBefore)} − ${fmt(p1.predictedDemand)} = −${fmt(Math.abs(stockDiff))} → 0`
    : `${fmt(day.stockBefore)} − ${fmt(p1.predictedDemand)} = ${fmt(stockDiff)}`;

  return (
    <div className="custom-chart-tooltip-nd predictive-tooltip-width-nd">
      <h4 className="tooltip-header-nd">Day +{day.dayOffset} · {formatDateBase(day.targetDate)} ({day.dayOfWeek})</h4>
      <ul className="tooltip-items-list-standard-nd">
        <li className="tooltip-item-nd"><span className="tooltip-item-name-nd">Predicted demand</span><span className="tooltip-item-value-nd" style={{ color: 'var(--status-low-text)' }}>{fmt(p1.predictedDemand)} {pluralizeUnit(day.unit, fmt(p1.predictedDemand))}</span></li>
        <li className="tooltip-item-nd"><span className="tooltip-item-name-nd">Stock left after this day</span><span className="tooltip-item-value-nd" style={{ color: 'var(--text-brand)' }}>{day.remainingStock} {pluralizeUnit(day.unit, day.remainingStock)}</span></li>
        <li className="tooltip-item-nd tooltip-item-note-nd"><span className="tooltip-item-name-nd">Stock − predicted demand</span><span className="tooltip-item-value-nd">{stockLeftComputation}</span></li>
        <li className="tooltip-item-nd"><span className="tooltip-item-name-nd">Window sum</span><span className="tooltip-item-value-nd">{fmt(p1.activeWindowSum)} {pluralizeUnit(day.unit, fmt(p1.activeWindowSum))}</span></li>
        <li className="tooltip-item-nd tooltip-item-note-nd"><span className="tooltip-item-name-nd">Dates covered</span><span className="tooltip-item-value-nd">{activeWindowRange}</span></li>
        <li className="tooltip-item-nd"><span className="tooltip-item-name-nd">Avg daily demand</span><span className="tooltip-item-value-nd">{fmt(p1.activeADD)} {pluralizeUnit(day.unit, fmt(p1.activeADD))}/day</span></li>
        <li className="tooltip-item-nd tooltip-item-note-nd"><span className="tooltip-item-name-nd">Sundays excluded</span><span className="tooltip-item-value-nd">{fmt(p1.activeWindowSum)} ÷ {p1.activeDays} days</span></li>
        <li className="tooltip-item-nd"><span className="tooltip-item-name-nd">Day-of-week index</span><span className="tooltip-item-value-nd">×{parseFloat(Number(p1.seasonalityIndex).toFixed(2))}</span></li>
        <li className="tooltip-item-nd tooltip-item-note-nd"><span className="tooltip-item-name-nd">Avg daily demand × index</span><span className="tooltip-item-value-nd">{fmt(p1.activeADD)} × {parseFloat(Number(p1.seasonalityIndex).toFixed(2))} = {parseFloat(Number(p1.rawDemand).toFixed(3))}</span></li>
        <li className="tooltip-item-nd"><span className="tooltip-item-name-nd">Dropped oldest</span><span className="tooltip-item-value-nd">{fmt(p2.droppedOldestValue)} {pluralizeUnit(day.unit, fmt(p2.droppedOldestValue))}</span></li>
        <li className="tooltip-item-nd tooltip-item-note-nd"><span className="tooltip-item-name-nd">Date dropped</span><span className="tooltip-item-value-nd">{formatDateBase(oldestDate)}</span></li>
        <li className="tooltip-item-nd"><span className="tooltip-item-name-nd">New window sum</span><span className="tooltip-item-value-nd">{fmt(p2.newWindowSum)} {pluralizeUnit(day.unit, fmt(p2.newWindowSum))}</span></li>
        <li className="tooltip-item-nd tooltip-item-note-nd"><span className="tooltip-item-name-nd">Dates covered</span><span className="tooltip-item-value-nd">{newWindowRange}</span></li>
        <li className="tooltip-item-nd tooltip-item-note-nd"><span className="tooltip-item-name-nd">Window sum − dropped + predicted</span><span className="tooltip-item-value-nd">{fmt(p1.activeWindowSum)} − {fmt(p2.droppedOldestValue)} + {fmt(p2.appendedPrediction)} = {fmt(p2.newWindowSum)}</span></li>
      </ul>
    </div>
  );
};

const CustomTooltip = ({ active, payload, label, unitLabel = "case", medicinesUnitsMap = {}, showBrandOnly = false }) => {
  if (active && payload && payload.length) {
    const totalCases = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
    const activePayload = payload.filter((entry) => (Number(entry.value) || 0) > 0);

    // One day -> "Oct. 23, 2026"; a week or month bucket -> "Oct. 1, 2026 – Oct. 7, 2026"
    const { start, end } = payload[0].payload || {};
    const dateHeader = start
      ? (!end || start === end ? formatDateBase(start) : `${formatDateBase(start)} – ${formatDateBase(end)}`)
      : label;

    return (
      <div className="custom-chart-tooltip-nd trend-tooltip-widen-nd">
        <h4 className="tooltip-header-nd">{dateHeader}</h4>
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
                    {entry.value} {pluralizeUnit(specificUnit, entry.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="tooltip-divider-nd" />
        <div className="tooltip-footer-nd">
          <span className="tooltip-total-label-nd">Total</span>
          <span className="tooltip-total-value-nd">{Math.round(totalCases)} {pluralizeUnit(unitLabel, Math.round(totalCases))}</span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomXAxisTick = ({ x, y, payload, filterType, isCurrentYearSelected, currentMonthName }) => {
  const isCurrentMonth = filterType === 'monthly' && isCurrentYearSelected && payload.value === currentMonthName;
  return (
    <g transform={`translate(${x},${y})`}>
      {isCurrentMonth && (
        <rect x={-24} y={4} width={48} height={22} rx={11} fill="#0250A3" opacity={0.12} />
      )}
      <text
        x={0} y={0} dy={19} textAnchor="middle"
        fill={isCurrentMonth ? '#0250A3' : '#4B5563'}
        style={{ fontWeight: isCurrentMonth ? 700 : 500, fontSize: '0.875rem' }}
      >
        {payload.value}
      </text>
    </g>
  );
};

/* --- MAIN DASHBOARD COMPONENT --- */
const NurseDashboard = () => {
  const navigate = useNavigate();
  const { nurseId, userId } = useOutletContext() || {};

  const maxCurrentMonth = getCurrentMonthString();

  // CUSTOM MODAL SYSTEM STATE (Replaces all native alert and confirm popups)
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    type: 'info', // 'success' | 'error' | 'warning' | 'confirm'
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false,
    showCheckbox: false,
    checkboxLabel: '',
    onConfirm: null,
    onCancel: null
  });
  const [feedbackModalCheckbox, setFeedbackModalCheckbox] = useState(false);

  const showAlert = ({ type = 'info', title, message, onOk }) => {
    setFeedbackModal({
      isOpen: true,
      type,
      title: title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice'),
      message,
      confirmText: 'OK',
      cancelText: 'Cancel',
      showCancel: false,
      showCheckbox: false,
      checkboxLabel: '',
      onConfirm: () => {
        setFeedbackModal(prev => ({ ...prev, isOpen: false }));
        if (onOk) onOk();
      },
      onCancel: null
    });
  };

  const showConfirm = ({
    type = 'warning',
    title = 'Confirmation',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    showCheckbox = false,
    checkboxLabel = '',
    onConfirm
  }) => {
    setFeedbackModalCheckbox(false);
    setFeedbackModal({
      isOpen: true,
      type,
      title,
      message,
      confirmText,
      cancelText,
      showCancel: true,
      showCheckbox,
      checkboxLabel,
      onConfirm: (checkboxVal) => {
        setFeedbackModal(prev => ({ ...prev, isOpen: false }));
        if (onConfirm) onConfirm(checkboxVal);
      },
      onCancel: () => {
        setFeedbackModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

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
  const [filterType, setFilterType] = useState("daily");
  const [averageUnit, setAverageUnit] = useState("day");
  const [selectedMonth, setSelectedMonth] = useState(maxCurrentMonth);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [trendFromDate, setTrendFromDate] = useState(`${maxCurrentMonth}-01`);
  const [trendToDate, setTrendToDate] = useState(getTodayString);
  const [trendComplaintFilter, setTrendComplaintFilter] = useState(""); // "" = all medical conditions
  const [isLoading, setIsLoading] = useState(true);

  // 2. Medicine Dispensed Overview State
  const [dispensedData, setDispensedData] = useState([]);
  const [medicinesList, setMedicinesList] = useState([]);
  const [medicinesUnitsMap, setMedicinesUnitsMap] = useState({});
  const [dispensedTimelineLabel, setDispensedTimelineLabel] = useState("");
  const [dispensedPeriodLabel, setDispensedPeriodLabel] = useState("");
  const [dispensedFilterType, setDispensedFilterType] = useState("daily");
  const [dispensedSelectedMonth, setDispensedSelectedMonth] = useState(maxCurrentMonth);
  const [dispensedSelectedYear, setDispensedSelectedYear] = useState(new Date().getFullYear().toString());
  const [dispensedMedicineFilter, setDispensedMedicineFilter] = useState(""); // "" = all medicines
  const [dispensedFromDate, setDispensedFromDate] = useState(`${maxCurrentMonth}-01`);
  const [dispensedToDate, setDispensedToDate] = useState(getTodayString);
  const [isDispensedLoading, setIsDispensedLoading] = useState(true);

  // 3. Predictive Demand State
  const [predictiveData, setPredictiveData] = useState([]);
  const [predictiveTitle, setPredictiveTitle] = useState("");
  const [predictivePeriod, setPredictivePeriod] = useState("");
  const [isPredictiveLoading, setIsPredictiveLoading] = useState(true);
  const [selectedForecastMedicineId, setSelectedForecastMedicineId] = useState("");
  const [forecastStartDate, setForecastStartDate] = useState("");

  // 4. Frequent Complaint Alerts State
  const [alerts, setAlerts] = useState([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [modalDate, setModalDate] = useState('');

  // 5. Announcement State (CRUD & Management inside Manage Active Notices Tab)
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementsList, setAnnouncementsList] = useState([]);
  const [isAnnouncementLoading, setIsAnnouncementLoading] = useState(false);
  const [announcementModalTab, setAnnouncementModalTab] = useState('LIST'); // 'LIST' (Default) | 'CREATE' | 'EDIT'
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

  const visibleComplaints = trendComplaintFilter
    ? complaintsList.filter((complaint) => complaint === trendComplaintFilter)
    : complaintsList;

  // Daily-style (stacked) bars: day-by-day views and custom ranges of up to 31 days
  const isTrendStacked = filterType === 'daily' || (filterType === 'range' && isDailyRange(trendFromDate, trendToDate));
  const isDispensedStacked = dispensedFilterType === 'daily' || (dispensedFilterType === 'range' && isDailyRange(dispensedFromDate, dispensedToDate));

  // Sum of every bar in the selected window, per medicine (zero totals left out)
  const visibleDispensedMedicines = dispensedMedicineFilter
    ? medicinesList.filter((medicine) => medicine === dispensedMedicineFilter)
    : medicinesList;

  const dispensedWindowTotals = visibleDispensedMedicines
    .map((medicine) => ({
      medicine,
      total: parseFloat(dispensedData.reduce((sum, item) => sum + (Number(item[medicine]) || 0), 0).toFixed(3))
    }))
    .filter((entry) => entry.total > 0);

  // Dynamically Filtered Upcoming Schedules
  const upcomingHealthScreenings = (nurseDashboardData.upcomingHealthScreenings || []).filter((screen) =>
    isScheduleUpcoming(screen.scheduled_date, screen.start_time)
  );

  const upcomingDoctorVisits = (nurseDashboardData.upcomingDoctorVisits || []).filter((visit) =>
    isScheduleUpcoming(visit.scheduled_date || visit.start_time, visit.start_time)
  );

  // EXPORT HANDLERS FOR REPORTS
  const handleExportHealthTrends = () => {
    const headers = ['No.', 'Medical Condition', 'Total Cases Recorded', `Average Cases / ${averageUnit}`];
    const rows = visibleComplaints.map((complaint, index) => {
      const totalCases = trendData.reduce((sum, item) => sum + (Number(item[complaint]) || 0), 0);
      const avgVal = averages && averages[complaint] !== undefined ? averages[complaint] : 0;
      const ceilAvg = Math.ceil(Number(avgVal) || 0);

      return [
        index + 1,
        complaint,
        totalCases,
        `${ceilAvg} avg/${averageUnit}`
      ];
    });

    generatePDFReport(
      'Health Trends Summary Report',
      `${periodLabel || ''} ${timelineLabel ? `(${timelineLabel})` : ''}`,
      headers,
      rows,
      (errMsg) => showAlert({ type: 'error', title: 'Export Failed', message: errMsg })
    );
  };

  const handleExportMedicineDispensed = () => {
    const headers = ['No.', 'Medicine / Item Name', 'Unit of Measure', 'Total Dispensed'];
    const rows = visibleDispensedMedicines.map((medicine, index) => {
      const unit = pluralizeUnit(combinedUnitsMap[medicine] || 'unit', 1);
      const totalDispensed = dispensedData.reduce((sum, item) => sum + (Number(item[medicine]) || 0), 0);

      return [
        index + 1,
        medicine,
        unit,
        parseFloat(totalDispensed.toFixed(3))
      ];
    });

    generatePDFReport(
      'Medicine Dispensed Summary Report',
      `${dispensedPeriodLabel || ''} ${dispensedTimelineLabel ? `(${dispensedTimelineLabel})` : ''}`,
      headers,
      rows,
      (errMsg) => showAlert({ type: 'error', title: 'Export Failed', message: errMsg })
    );
  };

  const handleExportPredictiveDemand = () => {
    const headers = [
      'No.',
      'Medicine Name',
      'Package Strength / Form',
      'Current Stock',
      'Forecast: Next 30 Days',
      'Predicted Need',
      'Status'
    ];

    const rows = predictiveData.map((med, index) => {
      const currStock = Number(med.currentStock) || 0;
      const formLabel = med.dosageForm || 'unit';
      const next30 = Math.ceil(Number(med.forecast30d) || 0);
      const restock = Number(med.suggestedRestock) || 0;

      return [
        index + 1,
        med.name,
        `${med.packageStrength || 'N/A'} (${med.dosageForm || 'Unit'})`,
        `${currStock} ${pluralize(formLabel, currStock)}`,
        `${next30} ${pluralize(formLabel, next30)}`,
        `${restock} ${pluralize(formLabel, restock)}`,
        med.status || 'N/A'
      ];
    });

    generatePDFReport(
      'Next 30 Days Predictive Medicine Demand Forecast Report',
      `Forecast period: ${predictivePeriod || 'next 30 days'} (rolling 30-day forecast). Predicted need = 30-day forecast - current stock.`,
      headers,
      rows,
      (errMsg) => showAlert({ type: 'error', title: 'Export Failed', message: errMsg })
    );
  };

  // EXPORT HANDLER FOR ALL REPEATED COMPLAINT LOGS
  const handleExportFrequentComplaints = () => {
    const headers = ['No.', 'Student Name', 'Student ID', 'Repeated Medical Conditions', 'Monthly Visits', 'Clinical Advice'];
    const rows = alerts.map((alert, index) => [
      index + 1,
      alert.studentName || 'N/A',
      alert.studentId || 'N/A',
      alert.complaint || 'N/A',
      `${alert.visitCount || 0} ${pluralize('visit', alert.visitCount || 0)}`,
      alert.advice || 'N/A'
    ]);

    generatePDFReport(
      'Frequent Visit & Repeated Medical Condition Summary Report',
      'Summary of Students with Recurring Clinic Visit Logs & Frequent Health Concerns',
      headers,
      rows,
      (errMsg) => showAlert({ type: 'error', title: 'Export Failed', message: errMsg })
    );
  };

  // EXPORT HANDLER FOR INDIVIDUAL STUDENT REPEATED COMPLAINT VISIT HISTORY
  const handleExportStudentVisitHistory = () => {
    if (!selectedAlertHeader) return;

    const headers = [
      'No.', 
      'Visit Date & Time', 
      'Medical Conditions', 
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
      `Recurring Medical Condition Logs - ${selectedAlertHeader.studentName}`,
      `Student ID: ${selectedAlertHeader.studentId} | Program/Yr: ${selectedAlertHeader.gradeSection || 'N/A'} | Medical Conditions: ${selectedAlertHeader.complaint} (${detailVisits.length} ${pluralize('Visit', detailVisits.length)} Recorded)`,
      headers,
      rows,
      (errMsg) => showAlert({ type: 'error', title: 'Export Failed', message: errMsg })
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

      // Per-medicine stock (all batches added together, expired stock left out): the same numbers as the Restock Report
      let medicineStockAlerts = [];
      try {
        const stockResponse = await fetch('http://localhost:3001/api/medicine-stock-status?alerts=1');
        if (stockResponse.ok) {
          const stock = await stockResponse.json();
          medicineStockAlerts = (stock.medicines || []).map(m => ({
            medicine_id: m.medicine_id,
            generic_name: m.generic_name,
            brand_name: m.brand_name,
            dosage_form: m.dosage_form,
            current_stock: m.usable_stock,
            low_stock_level: m.low_stock_level,
            critical_stock_level: m.critical_stock_level,
            suggested_qty: m.suggested_qty,
            stock_status: m.status === 'Out of stock' ? 'OUT' : m.status.toUpperCase()
          }));
        }
      } catch (invErr) {
        console.error("Error fetching medicine stock alerts:", invErr);
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
      // daily and weekly show one month, monthly shows one year, range shows the chosen From -> To dates
      const apiDate = filterType === 'monthly' ? `${selectedYear}-01-01` : `${selectedMonth}-01`;

      const params = new URLSearchParams({ granularity: filterType, date: apiDate });
      if (filterType === 'range') {
        params.set('from', trendFromDate);
        params.set('to', trendToDate);
      }
      const response = await fetch(`http://localhost:3001/api/health-trends?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load health trends');

      setTrendData(result.data || []);
      setComplaintsList(result.complaintsList || []);
      setAverages(result.averages || null);
      setAveragesLabel(result.averagesLabel || "");
      setAverageUnit(result.averageUnit || "month");
      setTimelineLabel(result.timelineLabel || "");
      setPeriodLabel(result.periodLabel || "");
    } catch (error) {
      console.error("Failed to fetch health trend data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filterType, selectedMonth, selectedYear, trendFromDate, trendToDate]);

  // Fetch Medicine Dispensed Overview
  const fetchMedicineDispensed = useCallback(async () => {
    setIsDispensedLoading(true);
    try {
      const apiDate = dispensedFilterType === 'monthly'
        ? `${dispensedSelectedYear}-01-01`
        : dispensedFilterType === 'range'
        ? getTodayString()
        : `${dispensedSelectedMonth}-01`;

      const params = new URLSearchParams({ filterType: dispensedFilterType, date: apiDate });
      if (dispensedFilterType === 'range') {
        params.set('from', dispensedFromDate);
        params.set('to', dispensedToDate);
      }
      const response = await fetch(`http://localhost:3001/api/medicine-dispensed-overview?${params.toString()}`);
      const result = await response.json();

      setDispensedData(result.data || []);
      setMedicinesList(result.medicinesList || []);
      setMedicinesUnitsMap(result.medicinesUnitsMap || result.medicineUnits || result.unitsMap || {});

      setDispensedTimelineLabel(result.timelineLabel || "");
      setDispensedPeriodLabel(result.periodLabel || "");
    } catch (error) {
      console.error("Failed to fetch medicine dispensed overview:", error);
    } finally {
      setIsDispensedLoading(false);
    }
  }, [dispensedFilterType, dispensedSelectedMonth, dispensedSelectedYear, dispensedFromDate, dispensedToDate]);

  // Fetch Predictive Medicine Demand
  const fetchPredictiveDemand = useCallback(async () => {
    setIsPredictiveLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/predictive-medicine');
      if (!response.ok) throw new Error("Network issue fetching predictive calculation");
      const result = await response.json();
      setPredictiveData(result.data || []);
      setPredictiveTitle(result.graphTitle || "Next 30 Days Predictive Medicine Demand Forecast");
      setPredictivePeriod(result.periodLabel || "");
      setForecastStartDate(result.forecastStartDate || "");
    } catch (error) {
      console.error("Failed to fetch predictive demand:", error);
    } finally {
      setIsPredictiveLoading(false);
    }
  }, []);

  // Fetch Frequent Complaint Alerts
  const fetchFrequentAlerts = useCallback(async () => {
    setIsAlertsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/frequent-complaints');
      if (!response.ok) throw new Error("Network issue fetching alerts");
      const result = await response.json();
      setAlerts(result.data || []); 
    } catch (error) {
      console.error("Failed to fetch frequent medical condition alerts:", error);
    } finally {
      setIsAlertsLoading(false);
    }
  }, []);

  // Fetch Announcements List (for Active Notices Tab in Modal)
  const fetchAnnouncements = useCallback(async () => {
    setIsAnnouncementLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncementsList(data.data || (Array.isArray(data) ? data : []));
      } else {
        setAnnouncementsList([]);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
      setAnnouncementsList([]);
    } finally {
      setIsAnnouncementLoading(false);
    }
  }, []);

  // Fetch Programs for Announcement Form
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

  // Open Announcement Modal (Default: 'LIST' tab for active managed notices)
  const handleOpenAnnouncementModal = async (tab = 'LIST', ann = null) => {
    setAnnouncementError('');
    setAnnouncementModalTab(tab);
    fetchPrograms();
    await fetchAnnouncements();

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

    const startDate = parseSafeDate(announcementForm.start_at);
    const expiresDate = parseSafeDate(announcementForm.expires_at);

    if (startDate >= expiresDate) {
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

      const formattedPayload = {
        nurse_id: nurseId || 'NURSE02000',
        user_id: userId,
        ...announcementForm,
        start_at: announcementForm.start_at.replace('T', ' '),
        expires_at: announcementForm.expires_at.replace('T', ' ')
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedPayload)
      });

      const result = await response.json();

      if (result.success) {
        showAlert({
          type: 'success',
          title: isEditing ? 'Announcement Updated' : 'Announcement Published',
          message: isEditing ? 'Announcement updated successfully!' : 'Announcement created and published successfully!',
          onOk: async () => {
            await fetchAnnouncements();
            await fetchNurseDashboard();
            setAnnouncementModalTab('LIST');
          }
        });
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

  // Handle Delete / Cancel Announcement with Custom Confirmation Modal
  const handleDeleteAnnouncement = (announcementId, title) => {
    showConfirm({
      type: 'warning',
      title: 'Delete Announcement',
      message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmText: 'Delete Announcement',
      cancelText: 'Cancel',
      showCheckbox: true,
      checkboxLabel: 'Send push notification to affected students and parents alerting them that this announcement was cancelled.',
      onConfirm: async (notifyCancellation) => {
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
            showAlert({
              type: 'success',
              title: 'Announcement Deleted',
              message: notifyCancellation
                ? 'Announcement deleted and cancellation push notification sent successfully!'
                : 'Announcement deleted successfully!',
              onOk: async () => {
                await fetchAnnouncements();
                await fetchNurseDashboard();
              }
            });
          } else {
            showAlert({
              type: 'error',
              title: 'Delete Failed',
              message: result.message || 'Failed to delete announcement.'
            });
          }
        } catch (err) {
          console.error('Error deleting announcement:', err);
          showAlert({
            type: 'error',
            title: 'Network Error',
            message: 'Unable to reach the server to delete the announcement.'
          });
        }
      }
    });
  };

  const handleDismissAlert = (studentId, complaint) => {
    showConfirm({
      type: 'warning',
      title: 'Dismiss Frequent Illness Alert',
      message: `Are you sure you want to dismiss the recurring illness alert for ${complaint}?`,
      confirmText: 'Dismiss Alert',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const response = await fetch('http://localhost:3001/api/frequent-complaints/dismiss', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, complaint })
          });
          const result = await response.json();

          if (result.success) {
            setAlerts(prev => prev.filter(a => !(a.studentId === studentId && a.complaint === complaint)));
            showAlert({
              type: 'success',
              title: 'Alert Dismissed',
              message: `The frequent illness alert for ${complaint} has been dismissed successfully.`
            });
          } else {
            showAlert({
              type: 'error',
              title: 'Dismiss Failed',
              message: result.message || 'Failed to dismiss alert.'
            });
          }
        } catch (error) {
          console.error('Error dismissing alert:', error);
          showAlert({
            type: 'error',
            title: 'Error',
            message: 'An error occurred while dismissing the alert.'
          });
        }
      }
    });
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

  const activeComplaintsInGraph = visibleComplaints.filter(complaint =>
    trendData.some(dataPoint => (Number(dataPoint[complaint]) || 0) > 0)
  );

  const activeMedicinesInGraph = visibleDispensedMedicines.filter(medicine =>
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

  // Dispense units such as g / L produce fractional totals, so the axis must allow decimals
  const dispensedHasDecimals = dispensedData.some(dataPoint =>
    activeMedicinesInGraph.some(medicine => !Number.isInteger(Number(dataPoint[medicine]) || 0))
  );

  // 30-day rolling forecast: only medicines dispensed in the trailing 30 days can be forecast
  const forecastMedicines = predictiveData.filter(med =>
    Array.isArray(med.forecast) && (med.history || []).some(v => Number(v) > 0)
  );
  const selectedForecastMedicine =
    forecastMedicines.find(med => String(med.id) === String(selectedForecastMedicineId)) || forecastMedicines[0];
  // Current stock is counted in containers of the dosage form; demand is in dispense units, so convert stock to dispense units
  const forecastContainerStrength = selectedForecastMedicine?.containerStrength || 1;
  const forecastStockBase = parseFloat(((Number(selectedForecastMedicine?.currentStock) || 0) * forecastContainerStrength).toFixed(3));
  let forecastRunningStock = forecastStockBase;
  const forecastChartData = (selectedForecastMedicine?.forecast || []).map(day => {
    const stockBefore = Math.max(0, parseFloat(forecastRunningStock.toFixed(3)));
    forecastRunningStock -= day.phase1_prediction.predictedDemand;
    return {
      ...day,
      stockBefore,
      label: `${formatMonthDay(day.targetDate)} ${day.dayOfWeek}`,
      predictedDemand: day.phase1_prediction.predictedDemand,
      remainingStock: Math.max(0, parseFloat(forecastRunningStock.toFixed(3))),
      unit: selectedForecastMedicine.unitOfMeasure,
      dosageForm: selectedForecastMedicine.dosageForm || 'unit',
      packageStrength: selectedForecastMedicine.packageStrength
    };
  });
  // Daily demand stays fractional; the total is rounded up once on the summed dispense units (done by the backend,
  // at the unit's precision) so small daily amounts don't inflate it
  const forecastDailySum = parseFloat(forecastChartData.reduce((sum, day) => sum + day.predictedDemand, 0).toFixed(3));
  const forecastTotalBase = selectedForecastMedicine?.forecastTotalUnits ?? forecastDailySum;
  const forecastTotalRaw = forecastTotalBase / forecastContainerStrength;
  const forecastTotal = Math.ceil(parseFloat(forecastTotalRaw.toFixed(6)));
  const forecastDosageForm = selectedForecastMedicine?.dosageForm || 'unit';
  // Stock vs demand: difference = stock - 30-day demand (negative = shortfall)
  // Average daily demand is shown exact (total / open days) so that average x open days always equals the 30-day total on the card.
  // Sundays are closed (forecast 0), so they are left out of the divisor.
  const forecastOpenDays = forecastChartData.filter(day => day.dayOfWeek !== 'Sun').length;
  const forecastAvgDaily = forecastTotalBase / (forecastOpenDays || 1);
  const forecastDifference = parseFloat((forecastStockBase - forecastTotalBase).toFixed(3));
  const forecastStockOutDay = forecastChartData.find(day => day.remainingStock <= 0);
  // Days of stock left: walk the daily forecast until the stock is used up. On the stock-out day (day k) the stock
  // left before it covers only a fraction of that day's demand, so days = (k - 1) + stockLeft / demandOfDayK.
  // null = no forecast demand; forecastCoversFull = stock outlasts the 30 forecast days (shown as "30+").
  let forecastDaysCovered = null;
  let forecastCoversFull = false;
  if (forecastTotalBase > 0) {
    let stockLeft = forecastStockBase;
    forecastDaysCovered = 0;
    for (let i = 0; i < forecastChartData.length; i++) {
      const demand = forecastChartData[i].predictedDemand;
      if (demand > 0 && stockLeft <= demand) {
        forecastDaysCovered = i + stockLeft / demand;
        break;
      }
      stockLeft -= demand;
      forecastDaysCovered = i + 1;
    }
    forecastCoversFull = !forecastStockOutDay;
    forecastDaysCovered = forecastCoversFull ? forecastChartData.length : parseFloat(forecastDaysCovered.toFixed(1));
  }
  const yearOptions = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

  const viewAllBtnStyle = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-brand)',
    fontSize: '0.875rem',
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
                <FileCheck size={24} color="var(--text-brand)" />
              </div>
            </div>
            <div className="stat-card-footer-nd">
              <div className="stat-pill-nd warning-pill-nd">
                <Clock size={12} />
                <span><strong>{nurseDashboardData.requirementsOverview.waitingForApprovalCount || 0}</strong> Waiting for Approval</span>
              </div>
              <div className="stat-pill-nd danger-pill-nd">
                <AlertCircle size={12} />
                <span><strong>{nurseDashboardData.requirementsOverview.incompleteCount || 0}</strong> Incomplete {pluralize('Requirement', nurseDashboardData.requirementsOverview.incompleteCount || 0)}</span>
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
                <FileText size={24} color="var(--status-low-text)" />
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
            onClick={() => navigate('/ReportsAnalytics?tab=inventory')}
            onKeyDown={(event) => handleOverviewCardKeyDown(event, '/ReportsAnalytics?tab=inventory')}
          >
            <div className="stat-card-header-nd">
              <div>
                <span className="stat-card-label-nd">Medicine Stock Alerts</span>
                <h3 className="stat-card-number-nd">{nurseDashboardData.medicineStockAlerts.length}</h3>
                <p className="stat-card-subtext-nd">Medicines to Restock</p>
              </div>
              <div className="stat-icon-wrapper-nd bg-red-light-nd">
                <ShieldAlert size={24} color="var(--status-critical-text)" />
              </div>
            </div>
            <div className="stat-card-footer-nd">
              <div className="stat-pill-nd danger-pill-nd">
                <span>Critical / Out: <strong>{nurseDashboardData.medicineStockAlerts.filter(m => ['CRITICAL', 'OUT'].includes(m.stock_status)).length}</strong></span>
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
                <Calendar size={24} color="var(--status-adequate-text)" />
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

      {/* CALENDAR + QUICK ACTIONS ROW */}
      <div className="dashboard-top-row-nd">
        {/* MINI CALENDAR: requirement deadlines, medicine expirations, screenings, doctor consultations */}
        <div className="detail-panel-nd mini-cal-panel-nd">
          <div className="panel-header-nd">
            <div className="panel-title-wrapper-nd">
              <Calendar size={18} className="panel-icon-nd text-blue-nd" />
              <h3 className="panel-title-nd">Calendar of Deadlines & Schedules</h3>
            </div>
          </div>
          <DashboardCalendar />
        </div>

        {/* QUICK ACTIONS SECTION */}
        <div className="detail-panel-nd quick-actions-section-nd">
          <div className="panel-header-nd">
            <div className="panel-title-wrapper-nd">
              <QrCode size={18} className="panel-icon-nd text-blue-nd" />
              <h3 className="panel-title-nd">Quick Actions</h3>
            </div>
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
            onClick={() => navigate('/HealthRecords')}
          >
            <span className="quick-action-icon-nd icon-blue-nd">
              <FolderHeart size={22} />
            </span>
            <span className="quick-action-content-nd">
              <strong>Find Health Record</strong>
              <span>Search and manage student health records</span>
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
              <span>Post announcements and set reminders</span>
            </span>
            <ChevronRight size={18} className="quick-action-arrow-nd" />
          </button>
        </div>
        </div>
      </div>

      {/* MEDICINE STOCK LEVEL ALERTS */}
      {!isNurseDashboardLoading && (
        <div className="dashboard-details-grid-nd dashboard-details-single-nd">

          {/* Medicine Inventory Low & Critical Batch Stock Details */}
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
                  onClick={() => navigate('/ReportsAnalytics?tab=inventory')}
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
                  <CheckCircle2 size={18} color="var(--status-adequate-text)" />
                  <span>All medicines are currently adequately stocked.</span>
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
                        <th>Predicted Need</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nurseDashboardData.medicineStockAlerts.map((med) => (
                        <tr key={med.medicine_id}>
                          <td>
                            <div className="font-semibold-nd">{med.generic_name}</div>
                            {med.brand_name && <div className="text-xs-nd text-muted-nd">({med.brand_name})</div>}
                          </td>
                          <td>{med.dosage_form || 'N/A'}</td>
                          <td>
                            <strong className={['CRITICAL', 'OUT'].includes(med.stock_status) ? 'text-red-nd' : 'text-orange-nd'}>
                              {med.current_stock} {pluralize(med.dosage_form || 'unit', med.current_stock)}
                            </strong>
                          </td>
                          <td className="text-xs-nd text-muted-nd">
                            Low: {med.low_stock_level} | Crit: {med.critical_stock_level}
                          </td>
                          <td><strong>+{med.suggested_qty} {pluralize(med.dosage_form || 'unit', med.suggested_qty)}</strong></td>
                          <td>
                            <span className={`status-badge-nd ${['CRITICAL', 'OUT'].includes(med.stock_status) ? 'badge-critical-nd' : 'badge-low-nd'}`}>
                              {med.stock_status === 'OUT' ? 'OUT OF STOCK' : med.stock_status}
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


        </div>
      )}

      <div className="dashboard-divider-line-nd" />

      {/* SECTION 1: HEALTH TREND OVERVIEW */}
      <div className="dashboard-header-nd">
        <h2 className="dashboard-title-nd">Health Trend Overview</h2>
        <div className="filter-group-nd">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-input-nd filter-select-nd" aria-label="Trend period">
            <option value="daily">Daily (day by day of a month)</option>
            <option value="weekly">Weekly (week by week of a month)</option>
            <option value="monthly">Monthly (month by month of a year)</option>
            <option value="range">Custom Date Range</option>
          </select>
          <select
            value={trendComplaintFilter}
            onChange={(e) => setTrendComplaintFilter(e.target.value)}
            className="filter-input-nd filter-select-nd"
            aria-label="Filter by medical condition"
          >
            <option value="">All Medical Conditions</option>
            {complaintsList.map((complaint) => (
              <option key={complaint} value={complaint}>{complaint}</option>
            ))}
          </select>
          {filterType === 'range' && (
            <>
              <label className="filter-label-nd">From</label>
              <input
                type="date"
                value={trendFromDate}
                max={trendToDate || undefined}
                onChange={(e) => e.target.value && setTrendFromDate(e.target.value)}
                className="filter-input-nd date-picker-nd"
              />
              <label className="filter-label-nd">To</label>
              <input
                type="date"
                value={trendToDate}
                min={trendFromDate || undefined}
                onChange={(e) => e.target.value && setTrendToDate(e.target.value)}
                className="filter-input-nd date-picker-nd"
              />
            </>
          )}
          {(filterType === 'daily' || filterType === 'weekly') && (
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
          {filterType === 'monthly' && (
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
                {filterType === 'monthly' && isCurrentYearSelected && (
                  <ReferenceArea x1={currentRealTimeMonthName} x2={currentRealTimeMonthName} fill="#0250A3" fillOpacity={0.04} stroke="#0250A3" strokeOpacity={0.1} strokeDasharray="3 3" />
                )}
                <XAxis dataKey="name" tickLine={false} tick={(props) => <CustomXAxisTick {...props} filterType={filterType} isCurrentYearSelected={isCurrentYearSelected} currentMonthName={currentRealTimeMonthName} />} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: '0.875rem' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip unitLabel="case" />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.4 }} />
                <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={14} wrapperStyle={{ paddingTop: '15px' }} />
                
                {activeComplaintsInGraph.map((complaint) => (
                  <Bar key={complaint} dataKey={complaint} name={complaint} fill={getComplaintColor(complaint)} radius={isTrendStacked ? 0 : [4, 4, 0, 0]} stackId={isTrendStacked ? 'cases' : undefined} />
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
              {visibleComplaints.map((complaint) => (
                <div key={complaint} className="average-badge-card-nd">
                  <span className="badge-dot-nd" style={{ backgroundColor: getComplaintColor(complaint) }} />
                  <span className="badge-name-nd">{complaint}</span>
                  <span className="badge-value-nd">
                    {averages[complaint] !== undefined ? (
                      <>{formatCeilAvg(averages[complaint])} avg/{averageUnit}</>
                    ) : (
                      `0 avg/${averageUnit}`
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {visibleComplaints.length > 3 && (
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
            <option value="daily">Daily (day by day of a month)</option>
            <option value="weekly">Weekly (week by week of a month)</option>
            <option value="monthly">Monthly (month by month of a year)</option>
            <option value="range">Custom Date Range</option>
          </select>
          <select
            value={dispensedMedicineFilter}
            onChange={(e) => setDispensedMedicineFilter(e.target.value)}
            className="filter-input-nd filter-select-nd"
            aria-label="Filter by medicine"
          >
            <option value="">All Medicines</option>
            {medicinesList.map((medicine) => (
              <option key={medicine} value={medicine}>{medicine}</option>
            ))}
          </select>
          {dispensedFilterType === 'range' && (
            <>
              <label className="filter-label-nd">From</label>
              <input
                type="date"
                value={dispensedFromDate}
                max={dispensedToDate || undefined}
                onChange={(e) => e.target.value && setDispensedFromDate(e.target.value)}
                className="filter-input-nd date-picker-nd"
              />
              <label className="filter-label-nd">To</label>
              <input
                type="date"
                value={dispensedToDate}
                min={dispensedFromDate || undefined}
                onChange={(e) => e.target.value && setDispensedToDate(e.target.value)}
                className="filter-input-nd date-picker-nd"
              />
            </>
          )}
          {(dispensedFilterType === 'daily' || dispensedFilterType === 'weekly') && (
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
          {dispensedFilterType === 'monthly' && (
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
          <div className="dispensed-graphs-row-nd">
          {/* GRAPH 1: STANDARD DOSAGE UNITS */}
          <div className="graph-container-nd">
            <h3 className="chart-subtitle-nd">Liquid Based</h3>
            {standardMedicinesInGraph.length === 0 ? (
              <div className="no-data-container-nd" style={{ padding: '20px' }}>
                <p className="no-data-title-nd" style={{ fontSize: '0.875rem' }}>No records found for liquid-based medicines.</p>
              </div>
            ) : (
              <div className="chart-wrapper-nd">
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={dispensedData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    {dispensedFilterType === 'monthly' && isDispensedCurrentYearSelected && (
                      <ReferenceArea x1={currentRealTimeMonthName} x2={currentRealTimeMonthName} fill="#0250A3" fillOpacity={0.04} stroke="#0250A3" strokeOpacity={0.1} strokeDasharray="3 3" />
                    )}
                    <XAxis dataKey="name" tickLine={false} tick={(props) => <CustomXAxisTick {...props} filterType={dispensedFilterType} isCurrentYearSelected={isDispensedCurrentYearSelected} currentMonthName={currentRealTimeMonthName} />} />
                    <YAxis allowDecimals={dispensedHasDecimals} tick={{ fill: 'var(--text-secondary)', fontSize: '0.875rem' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unitLabel="dispensed" medicinesUnitsMap={combinedUnitsMap} showBrandOnly={true} />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.4 }} />
                    {standardMedicinesInGraph.map((medicine) => (
                      <Bar key={medicine} dataKey={medicine} name={medicine} fill={getMedicineColor(medicine)} radius={isDispensedStacked ? 0 : [4, 4, 0, 0]} stackId={isDispensedStacked ? 'dispensed' : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <div className="chart-legend-nd">
                  {standardMedicinesInGraph.map((medicine) => (
                    <span key={medicine} className="chart-legend-item-nd">
                      <span className="chart-legend-swatch-nd" style={{ backgroundColor: getMedicineColor(medicine) }} />
                      {medicine}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* GRAPH 2: OTHER UNITS OF MEASURE */}
          <div className="graph-container-nd">
            <h3 className="chart-subtitle-nd">Other Units of Measure</h3>
            {otherMedicinesInGraph.length === 0 ? (
              <div className="no-data-container-nd" style={{ padding: '20px' }}>
                <p className="no-data-title-nd" style={{ fontSize: '0.875rem' }}>No records found for other units of measure.</p>
              </div>
            ) : (
              <div className="chart-wrapper-nd">
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={dispensedData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    {dispensedFilterType === 'monthly' && isDispensedCurrentYearSelected && (
                      <ReferenceArea x1={currentRealTimeMonthName} x2={currentRealTimeMonthName} fill="#0250A3" fillOpacity={0.04} stroke="#0250A3" strokeOpacity={0.1} strokeDasharray="3 3" />
                    )}
                    <XAxis dataKey="name" tickLine={false} tick={(props) => <CustomXAxisTick {...props} filterType={dispensedFilterType} isCurrentYearSelected={isDispensedCurrentYearSelected} currentMonthName={currentRealTimeMonthName} />} />
                    <YAxis allowDecimals={dispensedHasDecimals} tick={{ fill: 'var(--text-secondary)', fontSize: '0.875rem' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip unitLabel="dispensed" medicinesUnitsMap={combinedUnitsMap} showBrandOnly={true} />} cursor={{ fill: 'var(--bg-muted)', opacity: 0.4 }} />
                    {otherMedicinesInGraph.map((medicine) => (
                      <Bar key={medicine} dataKey={medicine} name={medicine} fill={getMedicineColor(medicine)} radius={isDispensedStacked ? 0 : [4, 4, 0, 0]} stackId={isDispensedStacked ? 'dispensed' : undefined} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <div className="chart-legend-nd">
                  {otherMedicinesInGraph.map((medicine) => (
                    <span key={medicine} className="chart-legend-item-nd">
                      <span className="chart-legend-swatch-nd" style={{ backgroundColor: getMedicineColor(medicine) }} />
                      {medicine}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </>
      )}

      {!isDispensedLoading && dispensedWindowTotals.length > 0 && (
        <div className="averages-container-nd">
          <h4 className="averages-title-nd">
            Total Dispensed in Window{dispensedFilterType === 'range' ? ` (${dispensedFromDate} to ${dispensedToDate})` : ''}
          </h4>
          <div className="averages-badges-wrapper-nd">
            {dispensedWindowTotals.map(({ medicine, total }) => (
              <div key={medicine} className="average-badge-card-nd">
                <span className="badge-dot-nd" style={{ backgroundColor: getMedicineColor(medicine) }} />
                <span className="badge-name-nd">{medicine}</span>
                <span className="badge-value-nd">{total} {pluralizeUnit(combinedUnitsMap[medicine] || 'dispensed', total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: PREDICTIVE MEDICINE DEMAND (CENTER ALIGNED GRAPH CONTAINER) */}
      <div className="dashboard-divider-line-nd" />

      <div className="dashboard-header-nd">
        <h2 className="dashboard-title-nd">{predictiveTitle}</h2>
        <div className="filter-group-nd">
          {predictivePeriod && <span className="filter-label-nd">Next 30 days: <strong>{predictivePeriod}</strong></span>}
          <button type="button" className="export-btn-nd" onClick={() => navigate('/ReportsAnalytics?tab=inventory')}>
            <Pill size={16} /> Restock Report
          </button>
          <button type="button" className="export-btn-nd" onClick={handleExportPredictiveDemand}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="graph-container-nd">
        {isPredictiveLoading ? (
          <div className="loading-container-nd">
            <div className="spinner-nd"></div>
            <p className="loading-text-nd">Calculating predictive medicine demand stock requirements...</p>
          </div>
        ) : !selectedForecastMedicine ? (
          <div className="no-data-container-nd"><h3 className="no-data-title-nd">No Dispensing Records In The Last 30 Days To Forecast From</h3></div>
        ) : (
          <>
            <div className="filter-group-nd" style={{ justifyContent: 'center', marginBottom: 12 }}>
              <label className="filter-label-nd">Medicine: </label>
              <select
                className="filter-input-nd"
                value={selectedForecastMedicine.id}
                onChange={(e) => setSelectedForecastMedicineId(e.target.value)}
              >
                {forecastMedicines.map(med => (
                  <option key={med.id} value={med.id}>{med.name}</option>
                ))}
              </select>
              <span className="filter-label-nd">
                30-day total: <strong>{forecastTotalBase} {selectedForecastMedicine.unitOfMeasure}</strong> = {forecastTotal} {pluralize(forecastDosageForm, forecastTotal)} ({selectedForecastMedicine.packageStrength} per {forecastDosageForm})
                {forecastStartDate && <> · from {formatDateBase(forecastStartDate)}</>}
              </span>
            </div>
            <div className="chart-wrapper-nd scrollable-chart-nd">
              {/* Tall enough that the hover tooltip (~350px) pinned to the top never reaches the axis labels or legend */}
              <div style={{ width: '100%', minWidth: 800, margin: '0 auto', height: 550 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastChartData} margin={{ top: 20, right: 10, left: 10, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis dataKey="label" interval={0} angle={-45} textAnchor="end" height={70} tick={{ fontSize: '0.875rem', fill: 'var(--text-secondary)', fontWeight: 500 }} tickLine={false} />
                    <YAxis yAxisId="demand" allowDecimals={forecastChartData.some(day => !Number.isInteger(day.predictedDemand))} tick={{ fill: '#F97316', fontSize: '0.875rem' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="stock" orientation="right" allowDecimals={false} tick={{ fill: 'var(--text-brand)', fontSize: '0.875rem' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ForecastTooltip />} position={{ y: 10 }} cursor={{ fill: 'var(--bg-muted)', opacity: 0.4 }} />
                    <Legend verticalAlign="bottom" height={36} iconType="rect" iconSize={14} wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar yAxisId="demand" dataKey="predictedDemand" name={`Predicted Daily Demand (${selectedForecastMedicine.unitOfMeasure})`} fill="#F97316" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="stock" type="monotone" dataKey="remainingStock" name={`Remaining Stock (${selectedForecastMedicine.unitOfMeasure})`} stroke="#0250A3" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="forecast-compare-nd">
              <div className="forecast-compare-item-nd">
                <span className="forecast-compare-label-nd">Current stock</span>
                <strong>{forecastStockBase} {pluralizeUnit(selectedForecastMedicine.unitOfMeasure, forecastStockBase)}</strong>
                <span className="forecast-compare-sub-nd">{selectedForecastMedicine.currentStock} {pluralize(forecastDosageForm, selectedForecastMedicine.currentStock)}</span>
              </div>
              <div className="forecast-compare-item-nd">
                <span className="forecast-compare-label-nd">Total predicted demand</span>
                <strong>{forecastTotalBase} {pluralizeUnit(selectedForecastMedicine.unitOfMeasure, forecastTotalBase)}</strong>
                <span className="forecast-compare-sub-nd">Sum of the next {forecastChartData.length} {pluralize('day', forecastChartData.length)}</span>
              </div>
              <div className="forecast-compare-item-nd">
                <span className="forecast-compare-label-nd">Average daily demand</span>
                <strong>{parseFloat(forecastAvgDaily.toFixed(2))} {pluralizeUnit(selectedForecastMedicine.unitOfMeasure, forecastAvgDaily)}/day</strong>
                <span className="forecast-compare-sub-nd">{forecastTotalBase} {pluralizeUnit(selectedForecastMedicine.unitOfMeasure, forecastTotalBase)} ÷ {forecastOpenDays} {pluralize('day', forecastOpenDays)} (Sundays excluded)</span>
              </div>
              <div className="forecast-compare-item-nd">
                <span className="forecast-compare-label-nd">Stock minus 30-day demand</span>
                <strong style={{ color: forecastDifference < 0 ? 'var(--status-critical-text)' : 'var(--status-adequate-text)' }}>
                  {forecastDifference > 0 ? '+' : ''}{forecastDifference} {pluralizeUnit(selectedForecastMedicine.unitOfMeasure, Math.abs(forecastDifference))}
                </strong>
                <span className="forecast-compare-sub-nd">{forecastDifference < 0 ? 'Shortfall' : 'Surplus'}</span>
              </div>
              <div className="forecast-compare-item-nd">
                <span className="forecast-compare-label-nd">Days of stock left</span>
                <strong>{forecastDaysCovered === null ? 'No demand' : forecastCoversFull ? `${forecastDaysCovered}+ days` : `${forecastDaysCovered} ${forecastDaysCovered === 1 ? 'day' : 'days'}`}</strong>
                <span className="forecast-compare-sub-nd">{forecastStockOutDay ? `Runs out ${forecastStockOutDay.label}` : 'Lasts the full 30 days'}</span>
              </div>
              <div className="forecast-compare-item-nd forecast-compare-need-nd">
                <span className="forecast-compare-label-nd">Predicted need</span>
                <strong>{selectedForecastMedicine.suggestedRestock} {pluralize(forecastDosageForm, selectedForecastMedicine.suggestedRestock)}</strong>
                <span className="forecast-compare-sub-nd">
                  {selectedForecastMedicine.suggestedRestock > 0
                    ? `${forecastTotal} needed − ${selectedForecastMedicine.currentStock} in stock`
                    : 'Current stock covers the forecast'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SECTION 5: FREQUENT COMPLAINT ALERTS */}
      <div className="dashboard-divider-line-nd" />

      <div className="dashboard-header-nd">
        <div className="title-with-badge-nd">
          <h2 className="dashboard-title-nd">Frequent Illness Alerts</h2>
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
          <h3 className="empty-title-nd">No Frequent Medical Condition Alerts</h3>
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
                  <span className="visit-badge-nd">{alert.visitCount} {pluralize('Visit', alert.visitCount)} in 1 Month</span>
                </div>
                <div className="complaint-chip-nd">
                  <strong>illness:</strong> {alert.complaint}
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
                  style={{ height: '34px', fontSize: '0.875rem', padding: '0 12px', flex: 1 }}
                  onClick={() => handleViewDetails(alert)}
                >
                  View Visit Log
                </button>
                <button 
                  className="retry-btn-nd" 
                  style={{ height: '34px', fontSize: '0.875rem', padding: '0 12px', backgroundColor: 'var(--danger-fill)' }}
                  onClick={() => handleDismissAlert(alert.studentId, alert.complaint)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ANNOUNCEMENT CRUD MODAL WITH MANAGE ACTIVE NOTICES TAB */}
      {isAnnouncementModalOpen && (
        <div className="modal-overlay-nd" onClick={() => setIsAnnouncementModalOpen(false)}>
          <div className="modal-container-nd modal-container-narrow-nd" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-nd">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone size={20} color="var(--text-brand)" />
                <div>
                  <h3 className="modal-title-nd">
                    {announcementModalTab === 'EDIT' 
                      ? 'Edit Announcement' 
                      : announcementModalTab === 'CREATE' 
                      ? 'Post New Announcement' 
                      : 'Active & Managed Notices Directory'}
                  </h3>
                  <p className="modal-subtitle-nd">Broadcast and manage targeted campus health notices</p>
                </div>
              </div>
              <button className="modal-close-btn-nd" onClick={() => setIsAnnouncementModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {/* TAB NAVIGATION HEADER */}
            <div style={{ display: 'flex', gap: '8px', padding: '12px 20px 0 20px', borderBottom: '1px solid var(--card-border)' }}>
              <button
                type="button"
                style={{
                  padding: '8px 14px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: announcementModalTab === 'LIST' ? '#0250A3' : '#F3F4F6',
                  color: announcementModalTab === 'LIST' ? '#FFF' : '#374151',
                  border: 'none',
                  borderRadius: '6px 6px 0 0'
                }}
                onClick={async () => {
                  setAnnouncementModalTab('LIST');
                  await fetchAnnouncements();
                }}
              >
                Manage Active Notices ({announcementsList.length})
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 14px',
                  fontSize: '0.875rem',
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
            </div>

            <div className="modal-body-scroll-nd" style={{ padding: '20px' }}>
              {/* TAB 1: MANAGE ACTIVE NOTICES (LIST TAB) */}
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
                                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
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
                                    background: 'var(--sti-blue-light)',
                                    border: '1px solid #BFDBFE',
                                    color: 'var(--text-brand)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.875rem'
                                  }}
                                  onClick={() => handleOpenAnnouncementModal('EDIT', ann)}
                                >
                                  <Edit3 size={13} /> Edit / Update
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    background: 'var(--status-critical-bg)',
                                    border: '1px solid #FCA5A5',
                                    color: 'var(--status-critical-text)',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.875rem'
                                  }}
                                  onClick={() => handleDeleteAnnouncement(ann.announcement_id || ann.id, ann.title)}
                                >
                                  <Trash2 size={13} /> Delete / Cancel
                                </button>
                              </div>
                            </div>

                            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                              {ann.content}
                            </p>

                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
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
                /* TAB 2 & 3: FORM TAB (CREATE / EDIT) */
                <form onSubmit={handleAnnouncementSubmit}>
                  {announcementError && (
                    <div style={{ padding: '10px 14px', backgroundColor: 'var(--status-critical-bg)', color: 'var(--status-critical-text)', borderRadius: '6px', marginBottom: '16px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} />
                      <span>{announcementError}</span>
                    </div>
                  )}

                  {/* Title */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
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
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
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
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
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
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
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
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
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
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
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
                      <label style={{ display: 'block', fontWeight: '600', fontSize: '0.875rem', marginBottom: '6px', color: 'var(--text-primary)' }}>
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
                      <label htmlFor="notify_update_check" style={{ fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                        Resend System & Web Push Notification to target recipients upon update
                      </label>
                    </div>
                  )}

                  <div className="modal-footer-nd" style={{ padding: '0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="modal-close-secondary-btn-nd"
                      onClick={() => setAnnouncementModalTab('LIST')}
                      disabled={isAnnouncementSubmitting}
                    >
                      Back to Active Notices
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
                <h3 className="modal-title-nd">Frequent Illness Alerts</h3>
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
                  placeholder="Search by student name, ID, or medical conditions..."
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
                      <th>Medical Conditions</th>
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
                            <span className="visit-badge-table-nd">{alert.visitCount} {pluralize('visit', alert.visitCount)}</span>
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

      {/* REUSABLE FEEDBACK & CONFIRMATION DIALOG MODAL (REPLACES NATIVE ALERT & CONFIRM) */}
      {feedbackModal.isOpen && (
        <div 
          className="modal-overlay-nd" 
          style={{ zIndex: 1300 }} 
          onClick={() => {
            if (feedbackModal.showCancel && feedbackModal.onCancel) {
              feedbackModal.onCancel();
            } else {
              setFeedbackModal(prev => ({ ...prev, isOpen: false }));
            }
          }}
        >
          <div 
            className="modal-container-nd modal-container-narrow-nd" 
            style={{ maxWidth: '480px', padding: '0' }} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-nd" style={{ borderBottom: '1px solid var(--card-border)', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {feedbackModal.type === 'success' && <CheckCircle2 size={22} color="var(--status-adequate-text)" />}
                {feedbackModal.type === 'error' && <AlertCircle size={22} color="var(--status-critical-text)" />}
                {feedbackModal.type === 'warning' && <ShieldAlert size={22} color="var(--status-low-text)" />}
                {feedbackModal.type === 'info' && <Lightbulb size={22} color="var(--text-brand)" />}
                <h3 className="modal-title-nd" style={{ fontSize: '1rem', margin: 0 }}>
                  {feedbackModal.title}
                </h3>
              </div>
              <button 
                className="modal-close-btn-nd" 
                onClick={() => {
                  if (feedbackModal.showCancel && feedbackModal.onCancel) {
                    feedbackModal.onCancel();
                  } else {
                    setFeedbackModal(prev => ({ ...prev, isOpen: false }));
                  }
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                {feedbackModal.message}
              </p>

              {feedbackModal.showCheckbox && (
                <div style={{ marginTop: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="feedbackModalCheckbox"
                    style={{ marginTop: '3px', cursor: 'pointer' }}
                    checked={feedbackModalCheckbox}
                    onChange={(e) => setFeedbackModalCheckbox(e.target.checked)}
                  />
                  <label htmlFor="feedbackModalCheckbox" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.4' }}>
                    {feedbackModal.checkboxLabel}
                  </label>
                </div>
              )}
            </div>

            <div className="modal-footer-nd" style={{ padding: '12px 20px', gap: '10px', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-subtle)' }}>
              {feedbackModal.showCancel && (
                <button
                  type="button"
                  className="modal-close-secondary-btn-nd"
                  onClick={() => {
                    if (feedbackModal.onCancel) feedbackModal.onCancel();
                    else setFeedbackModal(prev => ({ ...prev, isOpen: false }));
                  }}
                >
                  {feedbackModal.cancelText || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                className="export-btn-nd"
                style={{
                  backgroundColor: feedbackModal.type === 'error' || (feedbackModal.type === 'warning' && feedbackModal.showCancel) ? '#EF4444' : '#0250A3',
                  borderColor: feedbackModal.type === 'error' || (feedbackModal.type === 'warning' && feedbackModal.showCancel) ? '#EF4444' : '#0250A3'
                }}
                onClick={() => {
                  if (feedbackModal.onConfirm) {
                    feedbackModal.onConfirm(feedbackModalCheckbox);
                  } else {
                    setFeedbackModal(prev => ({ ...prev, isOpen: false }));
                  }
                }}
              >
                {feedbackModal.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NurseDashboard;