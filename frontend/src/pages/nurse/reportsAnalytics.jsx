import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  Activity,
  FileText,
  Pill,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import '../../styles/nurse/WeeklyReports.css';
import { useAlert } from '../../context/AlertContext';

// Import logos and signature images
import stiLogo from '../../assets/sti-logof.png';
import { formatMonthDay, formatDate, formatCurrentDate } from '../../utils/datetime';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const GRANULARITIES = [
  { value: 'daily', label: 'Daily', unit: 'day' },
  { value: 'weekly', label: 'Weekly', unit: 'week' },
  { value: 'monthly', label: 'Monthly', unit: 'month' }
];

const ymd = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// The period shown for a granularity and an offset (0 = the current day / week / month, 1 = the one before ...)
const getPeriod = (granularity, offset) => {
  const today = new Date();

  if (granularity === 'daily') {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
    return {
      startDate: ymd(day),
      endDate: ymd(day),
      displayText: formatCurrentDate(day),
      shortText: formatDate(ymd(day)),
      offsetLabel: offset === 0 ? 'Today' : offset === 1 ? 'Yesterday' : `${offset} days ago`
    };
  }

  if (granularity === 'monthly') {
    const first = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    return {
      startDate: ymd(first),
      endDate: ymd(last),
      displayText: `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`,
      shortText: `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`,
      offsetLabel: offset === 0 ? 'This Month' : offset === 1 ? '1 month ago' : `${offset} months ago`
    };
  }

  // weekly: Monday to Sunday
  const dayOfWeek = today.getDay();
  const diffToCurrentMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToCurrentMonday - (offset * 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    startDate: ymd(monday),
    endDate: ymd(sunday),
    displayText: `Week of ${formatMonthDay(monday)} – ${formatMonthDay(sunday)}, ${sunday.getFullYear()}`,
    shortText: `${formatMonthDay(monday)} – ${formatMonthDay(sunday)}, ${sunday.getFullYear()}`,
    offsetLabel: offset === 0 ? 'This Week' : offset === 1 ? '1 week ago' : `${offset} weeks ago`
  };
};

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const EMPTY_REPORT = {
  overview: { totalVisits: 0, distinctStudents: 0, totalIncidents: 0, topComplaint: 'None', topMedicine: 'None', previousVisits: 0, previousIncidents: 0, visitsChangePercent: null },
  complaintsBreakdown: [],
  medicineDispensed: [],
  trend: { unit: 'day', points: [] }
};

const WeeklyReports = () => {
  const { showAlert } = useAlert();
  const [granularity, setGranularity] = useState('weekly');
  const [offset, setOffset] = useState(0);
  const [reportData, setReportData] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [exporting, setExporting] = useState(false);

  // Nurse details
  const nurseInfo = {
    name: "MARILOU H. BALARAO, RN, LPT",
    title: "School Nurse",
    address: "Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan"
  };

  const period = useMemo(() => getPeriod(granularity, offset), [granularity, offset]);
  const unitInfo = GRANULARITIES.find((g) => g.value === granularity);

  const changeGranularity = (value) => {
    setGranularity(value);
    setOffset(0);
  };

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const queryParams = new URLSearchParams({
        startDate: period.startDate,
        endDate: period.endDate
      }).toString();

      const response = await fetch(`http://localhost:3001/api/weekly-reports?${queryParams}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setReportData({
        overview: { ...EMPTY_REPORT.overview, ...(data.overview || {}) },
        complaintsBreakdown: data.complaintsBreakdown || [],
        medicineDispensed: data.medicineDispensed || [],
        trend: data.trend || EMPTY_REPORT.trend
      });
    } catch (error) {
      console.error('Failed to fetch report data:', error);
      setErrorMessage(error.message || 'Failed to fetch data from backend server.');
    } finally {
      setLoading(false);
    }
  }, [period.startDate, period.endDate]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const { overview } = reportData;
  const changeText = overview.visitsChangePercent === null
    ? `No visits in the previous ${unitInfo.unit}`
    : `${overview.visitsChangePercent > 0 ? '+' : ''}${overview.visitsChangePercent}% vs previous ${unitInfo.unit} (${overview.previousVisits})`;

  const trendTitle = reportData.trend.unit === 'hour' ? 'Visits & Incidents by Hour'
    : reportData.trend.unit === 'month' ? 'Visits & Incidents by Month'
      : 'Visits & Incidents by Day';

  // PDF Export Function: summary cards, the breakdown tables with bars and the trend table
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const maxComplaint = Math.max(1, ...reportData.complaintsBreakdown.map((c) => c.count));
      const maxMedicine = Math.max(1, ...reportData.medicineDispensed.map((m) => m.count));
      const maxTrend = Math.max(1, ...reportData.trend.points.map((p) => Math.max(p.visits, p.incidents)));

      const complaintRows = reportData.complaintsBreakdown.map((c, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(c.name)}</td>
          <td class="num">${c.count}</td>
          <td class="num">${c.percent}%</td>
          <td class="num">${c.students}</td>
          <td class="bar-cell"><div class="bar" style="width:${Math.round((c.count / maxComplaint) * 100)}%"></div></td>
        </tr>`).join('');

      const medicineRows = reportData.medicineDispensed.map((m, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(m.name)}</td>
          <td class="num">${m.count}</td>
          <td class="bar-cell"><div class="bar bar-yellow" style="width:${Math.round((m.count / maxMedicine) * 100)}%"></div></td>
        </tr>`).join('');

      const trendRows = reportData.trend.points.map((p) => `
        <tr>
          <td>${escapeHtml(p.label)}${p.weekday ? ` <span class="muted">${p.weekday}</span>` : ''}</td>
          <td class="num">${p.visits}</td>
          <td class="num">${p.incidents}</td>
          <td class="bar-cell"><div class="bar" style="width:${Math.round((p.visits / maxTrend) * 100)}%"></div><div class="bar bar-red" style="width:${Math.round((p.incidents / maxTrend) * 100)}%"></div></td>
        </tr>`).join('');

      const title = `${unitInfo.label} Clinic Report - ${period.displayText}`;

      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4 portrait; margin: 15mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 10px; font-size: 10.5pt; background: #fff; }
            .header-container { display: flex; align-items: center; border-bottom: 2px solid #005691; padding-bottom: 12px; margin-bottom: 18px; }
            .logo { width: 80px; height: auto; margin-right: 18px; object-fit: contain; }
            .header-text { flex: 1; }
            .header-title { font-size: 18pt; font-weight: bold; color: #005691; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; }
            .header-subtitle { font-size: 12pt; font-weight: 600; color: #334155; margin: 0 0 4px 0; }
            .header-address { font-size: 9pt; color: #64748b; margin: 0; }
            .report-meta { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; margin-bottom: 18px; font-size: 9.5pt; }
            .meta-item { margin: 0; } .meta-label { font-weight: bold; color: #475569; }
            .summary-cards { display: flex; gap: 10px; margin-bottom: 22px; }
            .summary-card { flex: 1; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center; }
            .summary-card-title { font-size: 7.5pt; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 5px; }
            .summary-card-value { font-size: 13pt; font-weight: bold; color: #005691; }
            .summary-card-note { font-size: 7.5pt; color: #64748b; margin-top: 3px; }
            h3 { font-size: 11pt; color: #005691; margin: 20px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; page-break-after: avoid; }
            table { width: 100%; border-collapse: collapse; font-size: 9.5pt; page-break-inside: auto; }
            tr { page-break-inside: avoid; }
            th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; }
            td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
            .num { text-align: right; width: 1%; white-space: nowrap; }
            .bar-cell { width: 34%; }
            .bar { height: 9px; background: #005691; border-radius: 3px; min-width: 1px; margin: 1px 0; }
            .bar-yellow { background: #f5b301; } .bar-red { background: #dc2626; }
            .muted { color: #94a3b8; font-size: 8pt; }
            .empty { color: #64748b; font-style: italic; padding: 8px 0; }
            .signature-section { margin-top: 50px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
            .signature-block { width: 250px; text-align: center; }
            .prepared-label { text-align: left; font-size: 10pt; font-weight: 500; color: #334155; margin-bottom: 8px; }
            .signature-line { border-top: 1px solid #000; margin: 4px 0 6px 0; }
            .nurse-name { font-size: 10pt; font-weight: bold; margin: 0; } .nurse-title { font-size: 8.5pt; color: #475569; margin-top: 2px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <img src="${stiLogo}" alt="STI Logo" class="logo" />
            <div class="header-text">
              <h1 class="header-title">STI COLLEGE BALIUAG</h1>
              <h2 class="header-subtitle">School Clinic ${unitInfo.label} Summary Report</h2>
              <p class="header-address">Address: ${escapeHtml(nurseInfo.address)}</p>
            </div>
          </div>

          <div class="report-meta">
            <p class="meta-item"><span class="meta-label">Report Period:</span> ${escapeHtml(period.displayText)}</p>
            <p class="meta-item"><span class="meta-label">Generated Date:</span> ${formatDate(new Date())}</p>
          </div>

          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-card-title">Total Visits</div>
              <div class="summary-card-value">${overview.totalVisits}</div>
              <div class="summary-card-note">${escapeHtml(changeText)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Students Seen</div>
              <div class="summary-card-value">${overview.distinctStudents}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Top Medical Condition</div>
              <div class="summary-card-value">${escapeHtml(overview.topComplaint)}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Total Incidents</div>
              <div class="summary-card-value">${overview.totalIncidents}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Top Medicine</div>
              <div class="summary-card-value">${escapeHtml(overview.topMedicine)}</div>
            </div>
          </div>

          <h3>Medical Condition Breakdown</h3>
          ${complaintRows ? `<table>
            <thead><tr><th>#</th><th>Medical Condition</th><th>Cases</th><th>Share</th><th>Students</th><th>Chart</th></tr></thead>
            <tbody>${complaintRows}</tbody>
          </table>` : '<div class="empty">No medical condition records for this period.</div>'}

          <h3>Medicine Dispensed</h3>
          ${medicineRows ? `<table>
            <thead><tr><th>#</th><th>Medicine</th><th>Times dispensed</th><th>Chart</th></tr></thead>
            <tbody>${medicineRows}</tbody>
          </table>` : '<div class="empty">No medicine dispensations for this period.</div>'}

          <h3>${escapeHtml(trendTitle)}</h3>
          ${trendRows ? `<table>
            <thead><tr><th>${reportData.trend.unit === 'hour' ? 'Hour' : reportData.trend.unit === 'month' ? 'Month' : 'Day'}</th><th>Visits</th><th>Incidents</th><th>Chart (blue = visits, red = incidents)</th></tr></thead>
            <tbody>${trendRows}</tbody>
          </table>` : '<div class="empty">No activity in this period.</div>'}

          <div class="signature-section">
            <div class="signature-block">
              <div class="prepared-label">Prepared by:</div>
              <div class="signature-line"></div>
              <p class="nurse-name">${escapeHtml(nurseInfo.name)}</p>
              <p class="nurse-title">${escapeHtml(nurseInfo.title)}</p>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
        </html>
      `;

      // Trigger Print/Save as PDF Window
      const printWindow = window.open('', '_blank', 'width=900,height=800');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printHTML);
        printWindow.document.close();
      } else {
        showAlert('Please allow pop-ups to export the PDF report.', 'warning');
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
      showAlert('Failed to generate PDF report.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="weekly-reports-container">
      {/* Header Section styled as Card matching Insurance Vault */}
      <header className="reports-header-card">
        <div className="header-title-group">
          <h1 className="reports-title">{unitInfo.label} Reports</h1>
          <p className="reports-subtitle">Daily, weekly or monthly illness summary and clinic statistics</p>
        </div>

        {/* Action Buttons */}
        <div className="header-actions">
          <button
            className="action-btn secondary-btn"
            onClick={fetchReportData}
            disabled={loading}
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'spin-icon' : ''} />
            <span className="btn-text">Refresh</span>
          </button>

          <button
            className="action-btn primary-btn"
            onClick={handleExportPDF}
            disabled={exporting || loading}
            title="Export PDF Report"
            aria-label="Export PDF Report"
          >
            <Download size={16} />
            <span className="btn-text">{exporting ? 'Generating...' : 'Export PDF'}</span>
          </button>
        </div>
      </header>

      {/* Error Alert */}
      {errorMessage && (
        <div className="error-banner">
          <AlertCircle size={18} className="error-icon" />
          <span className="error-text">{errorMessage}</span>
        </div>
      )}

      {/* Daily / Weekly / Monthly */}
      <div className="granularity-toggle" role="tablist" aria-label="Report period">
        {GRANULARITIES.map((g) => (
          <button
            key={g.value}
            type="button"
            role="tab"
            aria-selected={granularity === g.value}
            className={`granularity-btn ${granularity === g.value ? 'active' : ''}`}
            onClick={() => changeGranularity(g.value)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Period Selector Card */}
      <section className="week-selector-card">
        <button
          className="nav-arrow-btn"
          onClick={() => setOffset(prev => prev + 1)}
          title={`Previous ${unitInfo.unit}`}
          aria-label={`Previous ${unitInfo.unit}`}
        >
          <ChevronLeft size={20} />
        </button>

        <div className="week-info">
          <span className="week-date-range">{period.displayText}</span>
          <span className="week-offset-tag">{period.offsetLabel}</span>
        </div>

        <button
          className="nav-arrow-btn"
          onClick={() => setOffset(prev => Math.max(0, prev - 1))}
          disabled={offset === 0}
          title={`Next ${unitInfo.unit}`}
          aria-label={`Next ${unitInfo.unit}`}
        >
          <ChevronRight size={20} />
        </button>
      </section>

      {/* Stat Cards */}
      <section className="overview-cards-grid">
        <div className="stat-card visits">
          <div className="stat-card-header">
            <Users className="stat-icon visits" size={18} />
            <span className="stat-label">Total Visits</span>
          </div>
          <div className="stat-value visits">{loading ? '...' : overview.totalVisits}</div>
          {!loading && <div className="stat-note">{overview.distinctStudents} student{overview.distinctStudents === 1 ? '' : 's'} · {changeText}</div>}
        </div>

        <div className="stat-card complaint">
          <div className="stat-card-header">
            <Activity className="stat-icon complaint" size={18} />
            <span className="stat-label">Top Medical Condition</span>
          </div>
          <div className="stat-value complaint" title={overview.topComplaint}>
            {loading ? '...' : overview.topComplaint}
          </div>
        </div>

        <div className="stat-card incidents">
          <div className="stat-card-header">
            <FileText className="stat-icon incidents" size={18} />
            <span className="stat-label">Total Incidents</span>
          </div>
          <div className="stat-value incidents">{loading ? '...' : overview.totalIncidents}</div>
          {!loading && <div className="stat-note">{overview.previousIncidents} in the previous {unitInfo.unit}</div>}
        </div>

        <div className="stat-card medicine">
          <div className="stat-card-header">
            <Pill className="stat-icon medicine" size={18} />
            <span className="stat-label">Top Medicine</span>
          </div>
          <div className="stat-value medicine" title={overview.topMedicine}>
            {loading ? '...' : overview.topMedicine}
          </div>
        </div>
      </section>

      {/* Analytics Charts */}
      <section className="charts-grid">
        <div className="chart-card">
          <h2 className="chart-title">Medical Condition Breakdown</h2>
          <div className="chart-wrapper">
            {reportData.complaintsBreakdown.length === 0 ? (
              <div className="no-data-placeholder">No medical condition records for this {unitInfo.unit}</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={reportData.complaintsBreakdown} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" name="Cases" fill="#005691" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Medicine Dispensed</h2>
          <div className="chart-wrapper">
            {reportData.medicineDispensed.length === 0 ? (
              <div className="no-data-placeholder">No medicine dispensations for this {unitInfo.unit}</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={reportData.medicineDispensed} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} width={90} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" name="Times dispensed" fill="#FFC72C" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Trend over the period */}
      <section className="chart-card trend-card">
        <h2 className="chart-title">{trendTitle}</h2>
        <div className="chart-wrapper">
          {reportData.trend.points.every((p) => p.visits === 0 && p.incidents === 0) ? (
            <div className="no-data-placeholder">No visits or incidents in this {unitInfo.unit}</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={reportData.trend.points} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} interval={reportData.trend.points.length > 16 ? 'preserveStartEnd' : 0} angle={-30} textAnchor="end" height={55} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="top" height={28} iconType="rect" />
                <Bar dataKey="visits" name="Visits" fill="#005691" radius={[4, 4, 0, 0]} />
                <Bar dataKey="incidents" name="Incidents" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Condition table */}
      <section className="chart-card table-card">
        <h2 className="chart-title">Medical Conditions: Cases and Students</h2>
        {reportData.complaintsBreakdown.length === 0 ? (
          <div className="no-data-placeholder">No medical condition records for this {unitInfo.unit}</div>
        ) : (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead><tr><th>#</th><th>Medical Condition</th><th>Cases</th><th>Share</th><th>Students</th></tr></thead>
              <tbody>
                {reportData.complaintsBreakdown.map((c, i) => (
                  <tr key={c.name}><td>{i + 1}</td><td>{c.name}</td><td><strong>{c.count}</strong></td><td>{c.percent}%</td><td>{c.students}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default WeeklyReports;
