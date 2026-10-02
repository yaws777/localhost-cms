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
  Eye,
  Printer,
  FileSpreadsheet,
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
    medicineDispensed: [],
    recentLogs: []
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Calculates Monday to Sunday
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

      const response = await fetch(`http://localhost:3001/api/weekly-reports?${queryParams}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setReportData({
        overview: data.overview || { totalVisits: 0, totalIncidents: 0, topComplaint: 'None', topMedicine: 'None' },
        complaintsBreakdown: data.complaintsBreakdown || [],
        medicineDispensed: data.medicineDispensed || [],
        recentLogs: data.recentLogs || []
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

  return (
    <div className="weekly-reports-container">
      {/* Header Section */}
      <header className="reports-header">
        <div className="header-title-group">
          <h1 className="reports-title">Weekly Reports</h1>
          <p className="reports-subtitle">Week-by-week illness summary and clinic statistics</p>
        </div>
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
            onClick={() => window.print()}
            title="Export PDF Report"
            aria-label="Export PDF Report"
          >
            <Download size={16} />
            <span className="btn-text">Export Report</span>
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

      {/* Week Selector Bar */}
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

      {/* Metric Cards Grid */}
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

      {/* Analytics Charts Grid */}
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
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
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
                <BarChart 
                  layout="vertical" 
                  data={reportData.medicineDispensed} 
                  margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    width={90}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="#FFC72C" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Detailed Table Section (Icons Only for Row Actions) */}
      <section className="table-card">
        <div className="table-header">
          <h2 className="table-title">Weekly Log Entries</h2>
          <span className="table-count-badge">
            {reportData.recentLogs.length} Records
          </span>
        </div>

        <div className="table-responsive-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Patient Name</th>
                <th>Complaint</th>
                <th>Medicine Given</th>
                <th>Attending Nurse</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reportData.recentLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-table-cell">
                    No individual logs recorded for this week timeframe.
                  </td>
                </tr>
              ) : (
                reportData.recentLogs.map((log, index) => (
                  <tr key={log.id || index}>
                    <td className="font-medium text-nowrap">{log.dateTime || 'N/A'}</td>
                    <td>{log.patientName || 'N/A'}</td>
                    <td><span className="badge badge-complaint">{log.complaint || 'N/A'}</span></td>
                    <td>{log.medicine || 'None'}</td>
                    <td>{log.nurse || 'Unassigned'}</td>
                    <td className="text-right">
                      <div className="row-actions">
                        <button 
                          className="icon-only-btn" 
                          title="View Case Details" 
                          aria-label="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className="icon-only-btn" 
                          title="Print Entry Summary" 
                          aria-label="Print Entry"
                        >
                          <Printer size={16} />
                        </button>
                        <button 
                          className="icon-only-btn" 
                          title="Export Log Entry" 
                          aria-label="Export Entry"
                        >
                          <FileSpreadsheet size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default WeeklyReports;