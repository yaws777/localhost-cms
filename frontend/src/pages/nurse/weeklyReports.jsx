import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Activity, 
  FileText, 
  Pill, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  AlertCircle 
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
    medicineDispensed: []
  });
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Calculates Monday to Sunday (offset 0 = Current Week, 1 = 1 Week Ago, etc.)
  const getWeekRange = useCallback((offset) => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: Sun, 1: Mon, ...
    
    // Calculate difference to current week's Monday
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

  // Fetching data using native fetch API directly to http://localhost:3001
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
      setReportData(data);
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
      <div className="reports-header">
        <div>
          <h1 className="reports-title">Weekly Reports</h1>
          <p className="reports-subtitle">Week-by-week illness summary and clinic statistics</p>
        </div>
        <button className="export-btn" onClick={() => window.print()}>
          <Download size={16} />
          Export Report
        </button>
      </div>

      {/* Error Message Display */}
      {errorMessage && (
        <div style={{
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '12px 16px', 
          backgroundColor: '#FEE2E2', 
          color: '#991B1B', 
          borderRadius: '8px', 
          marginBottom: '16px'
        }}>
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Week Selector Bar */}
      <div className="week-selector-card">
        <button 
          className="nav-arrow-btn" 
          onClick={() => setWeekOffset(prev => prev + 1)}
          title="Go back 1 week"
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
          title="Go forward 1 week"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Overview Cards */}
      <div className="overview-cards-grid">
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
            <span className="stat-label">Top Medicine Dispensed</span>
          </div>
          <div className="stat-value medicine" title={reportData.overview.topMedicine}>
            {loading ? '...' : reportData.overview.topMedicine}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Complaint Breakdown Graph */}
        <div className="chart-card">
          <h3 className="chart-title">Complaint Breakdown</h3>
          <div className="chart-wrapper">
            {reportData.complaintsBreakdown.length === 0 ? (
              <div className="no-data-placeholder">No complaint records for this week</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={reportData.complaintsBreakdown} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#4A5568' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#4A5568' }} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="#005691" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Medicine Dispensed Graph */}
        <div className="chart-card">
          <h3 className="chart-title">Medicine Dispensed</h3>
          <div className="chart-wrapper">
            {reportData.medicineDispensed.length === 0 ? (
              <div className="no-data-placeholder">No medicine dispensations for this week</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart 
                  layout="vertical" 
                  data={reportData.medicineDispensed} 
                  margin={{ top: 15, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#4A5568' }} allowDecimals={false} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12, fill: '#4A5568' }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="#FFC72C" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyReports;