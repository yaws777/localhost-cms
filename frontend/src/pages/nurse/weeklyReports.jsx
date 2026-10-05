import React, { useState, useEffect, useCallback } from 'react';
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
  ResponsiveContainer 
} from 'recharts';
import '../../styles/nurse/WeeklyReports.css';

// Import logos and signature images
import stiLogo from '../../assets/sti-logof.png';

const WeeklyReports = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [reportData, setReportData] = useState({
    overview: {
      totalVisits: 0,
      totalIncidents: 0,
      topComplaint: 'None',
      topMedicine: 'None'
    },
    complaintsBreakdown: [],
    medicineDispensed: []
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [exporting, setExporting] = useState(false);

  // Nurse details
  const nurseInfo = {
    name: "MARILOU H. BALARAO, RN, LPT",
    title: "School Nurse",
    address: "Gil Carlos Street, Poblacion, Baliuag, 3006 Bulacan"
  };

  // Calculates Monday to Sunday range
  const getWeekRange = useCallback((offset) => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToCurrentMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToCurrentMonday - (offset * 7));

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const formatDisplay = (date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return {
      startDate: formatDate(monday),
      endDate: formatDate(sunday),
      displayText: `Week of ${formatDisplay(monday)} – ${formatDisplay(sunday)}, ${sunday.getFullYear()}`
    };
  }, []);

  const weekInfo = getWeekRange(weekOffset);

  const getOffsetLabel = (offset) => {
    if (offset === 0) return 'This Week';
    if (offset === 1) return '1 week ago';
    return `${offset} weeks ago`;
  };

  const fetchWeeklyData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const queryParams = new URLSearchParams({
        startDate: weekInfo.startDate,
        endDate: weekInfo.endDate
      }).toString();

      const response = await fetch(`https://localhost-cms.onrender.com/api/weekly-reports?${queryParams}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setReportData({
        overview: data.overview || { totalVisits: 0, totalIncidents: 0, topComplaint: 'None', topMedicine: 'None' },
        complaintsBreakdown: data.complaintsBreakdown || [],
        medicineDispensed: data.medicineDispensed || []
      });
    } catch (error) {
      console.error('Failed to fetch weekly report data:', error);
      setErrorMessage(error.message || 'Failed to fetch data from backend server.');
    } finally {
      setLoading(false);
    }
  }, [weekInfo.startDate, weekInfo.endDate]);

  useEffect(() => {
    fetchWeeklyData();
  }, [fetchWeeklyData]);

  // PDF Export Function
  const handleExportPDF = async () => {
    setExporting(true);
    try {
      // Printable HTML Layout
      const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Weekly Clinic Report - ${weekInfo.displayText}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 10px;
              font-size: 11pt;
              background-color: #ffffff;
            }
            .header-container {
              display: flex;
              align-items: center;
              border-bottom: 2px solid #005691;
              padding-bottom: 12px;
              margin-bottom: 20px;
            }
            .logo {
              width: 80px;
              height: auto;
              margin-right: 18px;
              object-fit: contain;
            }
            .header-text {
              flex: 1;
            }
            .header-title {
              font-size: 18pt;
              font-weight: bold;
              color: #005691;
              margin: 0 0 4px 0;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-subtitle {
              font-size: 12pt;
              font-weight: 600;
              color: #334155;
              margin: 0 0 4px 0;
            }
            .header-address {
              font-size: 9pt;
              color: #64748b;
              margin: 0;
            }
            .report-meta {
              display: flex;
              justify-content: space-between;
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 14px;
              margin-bottom: 20px;
              font-size: 9.5pt;
            }
            .meta-item {
              margin: 0;
            }
            .meta-label {
              font-weight: bold;
              color: #475569;
            }
            .summary-cards {
              display: flex;
              gap: 12px;
              margin-bottom: 30px;
            }
            .summary-card {
              flex: 1;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 12px;
              background-color: #ffffff;
              text-align: center;
            }
            .summary-card-title {
              font-size: 8pt;
              text-transform: uppercase;
              color: #64748b;
              font-weight: bold;
              margin-bottom: 6px;
            }
            .summary-card-value {
              font-size: 14pt;
              font-weight: bold;
              color: #005691;
            }
            .signature-section {
              margin-top: 60px;
              display: flex;
              justify-content: flex-end;
              page-break-inside: avoid;
            }
            .signature-block {
              width: 250px;
              text-align: center;
            }
            .prepared-label {
              text-align: left;
              font-size: 10pt;
              font-weight: 500;
              color: #334155;
              margin-bottom: 8px;
            }
            .signature-line {
              border-top: 1px solid #000000;
              margin: 4px 0 6px 0;
            }
            .nurse-name {
              font-size: 10pt;
              font-weight: bold;
              color: #0f172a;
              margin: 0;
            }
            .nurse-title {
              font-size: 8.5pt;
              color: #475569;
              margin-top: 2px;
            }
          </style>
        </head>
        <body>
          <!-- STI Logo Header & Address -->
          <div class="header-container">
            <img src="${stiLogo}" alt="STI Logo" class="logo" />
            <div class="header-text">
              <h1 class="header-title">STI COLLEGE BALIUAG</h1>
              <h2 class="header-subtitle">School Clinic Weekly Summary Report</h2>
              <p class="header-address">Address: ${nurseInfo.address}</p>
            </div>
          </div>

          <!-- Metadata -->
          <div class="report-meta">
            <p class="meta-item"><span class="meta-label">Report Period:</span> ${weekInfo.displayText}</p>
            <p class="meta-item"><span class="meta-label">Generated Date:</span> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <!-- Overview Summary -->
          <div class="summary-cards">
            <div class="summary-card">
              <div class="summary-card-title">Total Visits</div>
              <div class="summary-card-value">${reportData.overview.totalVisits}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Top Complaint</div>
              <div class="summary-card-value">${reportData.overview.topComplaint}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Total Incidents</div>
              <div class="summary-card-value">${reportData.overview.totalIncidents}</div>
            </div>
            <div class="summary-card">
              <div class="summary-card-title">Top Medicine</div>
              <div class="summary-card-value">${reportData.overview.topMedicine}</div>
            </div>
          </div>

          <!-- Nurse Signature (Marilou H. Balarao only) -->
          <div class="signature-section">
            <div class="signature-block">
              <div class="prepared-label">Prepared by:</div>
              <div class="signature-line"></div>
              <p class="nurse-name">${nurseInfo.name}</p>
              <p class="nurse-title">${nurseInfo.title}</p>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
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
        alert('Please allow pop-ups to export the PDF report.');
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to generate PDF report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="weekly-reports-container">
      {/* Header Section */}
      <header className="reports-header">
        <div className="header-title-group">
          <h1 className="reports-title">Weekly Reports</h1>
          <p className="reports-subtitle">Week-by-week illness summary and clinic statistics</p>
        </div>

        {/* Compact Header Buttons */}
        <div className="header-actions">
          <button 
            className="action-btn secondary-btn" 
            onClick={fetchWeeklyData} 
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

      {/* Week Selector Card */}
      <section className="week-selector-card">
        <button 
          className="nav-arrow-btn" 
          onClick={() => setWeekOffset(prev => prev + 1)}
          title="Previous Week"
          aria-label="Previous Week"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="week-info">
          <span className="week-date-range">{weekInfo.displayText}</span>
          <span className="week-offset-tag">{getOffsetLabel(weekOffset)}</span>
        </div>

        <button 
          className="nav-arrow-btn" 
          onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
          disabled={weekOffset === 0}
          title="Next Week"
          aria-label="Next Week"
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
          <div className="stat-value visits">{loading ? '...' : reportData.overview.totalVisits}</div>
        </div>

        <div className="stat-card complaint">
          <div className="stat-card-header">
            <Activity className="stat-icon complaint" size={18} />
            <span className="stat-label">Top Complaint</span>
          </div>
          <div className="stat-value complaint" title={reportData.overview.topComplaint}>
            {loading ? '...' : reportData.overview.topComplaint}
          </div>
        </div>

        <div className="stat-card incidents">
          <div className="stat-card-header">
            <FileText className="stat-icon incidents" size={18} />
            <span className="stat-label">Total Incidents</span>
          </div>
          <div className="stat-value incidents">{loading ? '...' : reportData.overview.totalIncidents}</div>
        </div>

        <div className="stat-card medicine">
          <div className="stat-card-header">
            <Pill className="stat-icon medicine" size={18} />
            <span className="stat-label">Top Medicine</span>
          </div>
          <div className="stat-value medicine" title={reportData.overview.topMedicine}>
            {loading ? '...' : reportData.overview.topMedicine}
          </div>
        </div>
      </section>

      {/* Analytics Charts */}
      <section className="charts-grid">
        <div className="chart-card">
          <h2 className="chart-title">Complaint Breakdown</h2>
          <div className="chart-wrapper">
            {reportData.complaintsBreakdown.length === 0 ? (
              <div className="no-data-placeholder">No complaint records for this week</div>
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
                  <Bar dataKey="count" fill="#005691" radius={[6, 6, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Medicine Dispensed</h2>
          <div className="chart-wrapper">
            {reportData.medicineDispensed.length === 0 ? (
              <div className="no-data-placeholder">No medicine dispensations for this week</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart layout="vertical" data={reportData.medicineDispensed} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} width={90} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" fill="#FFC72C" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default WeeklyReports;