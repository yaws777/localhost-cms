import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertCircle,
  GraduationCap,
  FileCheck,
  UserCheck,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import '../../styles/nurse/NurseDashboard.css';

const COLORS = ['#0250A3', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#6366F1'];
const STANDARD_UNITS = ['mg', 'g', 'mcg', 'mL', 'L'];

/* --- HELPER FUNCTIONS --- */
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

/* --- CUSTOM CHART TOOLTIPS --- */
const PredictiveTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const itemData = payload[0]?.payload;
    const dosageUnit = itemData?.dosageForm || 'Unit';

    return (
      <div className="custom-chart-tooltip predictive-tooltip-width">
        <h4 className="tooltip-header">{label}</h4>
        <ul className="tooltip-items-list-standard">
          {payload.map((entry, index) => {
            const isStock = entry.dataKey === 'currentStock';
            const displayUnit = isStock 
              ? `${dosageUnit}${entry.value === 1 ? '' : 's'}`
              : 'package(s)/bottle(s)';

            return (
              <li key={index} className="tooltip-item">
                <div className="tooltip-item-left">
                  <span className="tooltip-marker" style={{ backgroundColor: entry.color }} />
                  <span className="tooltip-item-name">{entry.name}</span>
                </div>
                <span className="tooltip-item-value" style={{ color: entry.color }}>
                  {entry.value} {displayUnit}
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
      <div className="custom-chart-tooltip trend-tooltip-widen">
        <h4 className="tooltip-header">{label}</h4>
        {activePayload.length === 0 ? (
          <div className="tooltip-no-records">No records found</div>
        ) : (
          <ul className="tooltip-items-grid">
            {activePayload.map((entry, index) => {
              const specificUnit = medicinesUnitsMap[entry.name] || unitLabel;
              const displayName = showBrandOnly ? getBrandNameOnly(entry.name) : entry.name;

              return (
                <li key={index} className="tooltip-item">
                  <div className="tooltip-item-left">
                    <span className="tooltip-marker" style={{ backgroundColor: entry.color }} />
                    <span className="tooltip-item-name">{displayName}</span>
                  </div>
                  <span className="tooltip-item-value" style={{ color: entry.color }}>
                    {entry.value} {specificUnit}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="tooltip-divider" />
        <div className="tooltip-footer">
          <span className="tooltip-total-label">Total</span>
          <span className="tooltip-total-value">{totalCases.toFixed(1)} {unitLabel}</span>
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
      
      setNurseDashboardData({
        requirementsOverview: {
          waitingForApprovalCount,
          incompleteCount,
          totalAttentionCount
        },
        upcomingRequirementDeadlines: dashData.upcomingRequirementDeadlines || [],
        pendingDocumentRequests: dashData.pendingDocumentRequests || { pending_excuse_slips: 0, pending_referral_slips: 0, total_pending_requests: 0 },
        medicineStockAlerts,
        upcomingHealthScreenings: dashData.upcomingHealthScreenings || [],
        upcomingDoctorVisits: dashData.upcomingDoctorVisits || []
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

  // Dismiss / Delete Alert
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

  // View Detailed Visit Records for Alert
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
  }, [fetchNurseDashboard, fetchHealthTrends, fetchMedicineDispensed, fetchPredictiveDemand, fetchFrequentAlerts]);

  const activeComplaintsInGraph = complaintsList.filter(complaint => 
    trendData.some(dataPoint => (Number(dataPoint[complaint]) || 0) > 0)
  );

  const activeMedicinesInGraph = medicinesList.filter(medicine => 
    dispensedData.some(dataPoint => (Number(dataPoint[medicine]) || 0) > 0)
  );

  const standardMedicinesInGraph = activeMedicinesInGraph.filter(medicine => {
    const unit = combinedUnitsMap[medicine];
    return STANDARD_UNITS.includes(unit);
  });

  const otherMedicinesInGraph = activeMedicinesInGraph.filter(medicine => {
    const unit = combinedUnitsMap[medicine];
    return !STANDARD_UNITS.includes(unit);
  });

  const activePredictiveData = predictiveData.filter(med => 
    (Number(med.predictedNeed) || 0) > 0 || (Number(med.currentStock) || 0) > 0
  );

  const predictiveChartMinWidth = Math.max(activePredictiveData.length * 140, 800);
  const yearOptions = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      alert.studentName?.toLowerCase().includes(modalSearch.toLowerCase()) ||
      alert.studentId?.toLowerCase().includes(modalSearch.toLowerCase()) ||
      alert.complaint?.toLowerCase().includes(modalSearch.toLowerCase());
    const matchesDate = !modalDate || (alert.date && alert.date.startsWith(modalDate));
    return matchesSearch && matchesDate;
  });

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

  return (
    <div className="dashboard-container">
      
      {/* TOP SUMMARY STAT CARDS */}
      <div className="dashboard-section-header">
        <h2 className="dashboard-title">Nurse Operational Overview</h2>
        <span className="last-updated-tag">Live System Data</span>
      </div>

      {isNurseDashboardLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Loading operational dashboard overview...</p>
        </div>
      ) : (
        <div className="overview-cards-grid">
          
          {/* Card 1: Requirements Overview */}
          <div className="overview-card stat-card-blue">
            <div className="stat-card-header">
              <div>
                <span className="stat-card-label">Requirements Overview</span>
                <h3 className="stat-card-number">{nurseDashboardData.requirementsOverview.totalAttentionCount || 0}</h3>
                <p className="stat-card-subtext">Students Needing Requirement Attention</p>
              </div>
              <div className="stat-icon-wrapper bg-blue-light">
                <FileCheck size={24} color="#0250A3" />
              </div>
            </div>
            <div className="stat-card-footer">
              <div className="stat-pill warning-pill">
                <Clock size={12} />
                <span><strong>{nurseDashboardData.requirementsOverview.waitingForApprovalCount || 0}</strong> Waiting for Approval</span>
              </div>
              <div className="stat-pill danger-pill">
                <AlertCircle size={12} />
                <span><strong>{nurseDashboardData.requirementsOverview.incompleteCount || 0}</strong> Incomplete Requirements</span>
              </div>
            </div>
          </div>

          {/* Card 2: Document Requests Pending Approval */}
          <div className="overview-card stat-card-orange">
            <div className="stat-card-header">
              <div>
                <span className="stat-card-label">Pending Document Requests</span>
                <h3 className="stat-card-number">{nurseDashboardData.pendingDocumentRequests.total_pending_requests || 0}</h3>
                <p className="stat-card-subtext">Awaiting Nurse Review</p>
              </div>
              <div className="stat-icon-wrapper bg-orange-light">
                <FileText size={24} color="#F59E0B" />
              </div>
            </div>
            <div className="stat-card-footer">
              <div className="stat-pill neutral-pill">
                <span>Excuse Slips: <strong>{nurseDashboardData.pendingDocumentRequests.pending_excuse_slips || 0}</strong></span>
              </div>
              <div className="stat-pill neutral-pill">
                <span>Referral Slips: <strong>{nurseDashboardData.pendingDocumentRequests.pending_referral_slips || 0}</strong></span>
              </div>
            </div>
          </div>

          {/* Card 3: Medicine Low & Critical Batch Stock */}
          <div className="overview-card stat-card-red">
            <div className="stat-card-header">
              <div>
                <span className="stat-card-label">Medicine Stock Alerts</span>
                <h3 className="stat-card-number">{nurseDashboardData.medicineStockAlerts.length}</h3>
                <p className="stat-card-subtext">Batches Requiring Action</p>
              </div>
              <div className="stat-icon-wrapper bg-red-light">
                <ShieldAlert size={24} color="#EF4444" />
              </div>
            </div>
            <div className="stat-card-footer">
              <div className="stat-pill danger-pill">
                <span>Critical: <strong>{nurseDashboardData.medicineStockAlerts.filter(m => m.stock_status === 'CRITICAL').length}</strong></span>
              </div>
              <div className="stat-pill warning-pill">
                <span>Low Stock: <strong>{nurseDashboardData.medicineStockAlerts.filter(m => m.stock_status === 'LOW').length}</strong></span>
              </div>
            </div>
          </div>

          {/* Card 4: Upcoming Screenings & Doctor Visits */}
          <div className="overview-card stat-card-green">
            <div className="stat-card-header">
              <div>
                <span className="stat-card-label">Upcoming Schedules</span>
                <h3 className="stat-card-number">
                  {(nurseDashboardData.upcomingHealthScreenings?.length || 0) + (nurseDashboardData.upcomingDoctorVisits?.length || 0)}
                </h3>
                <p className="stat-card-subtext">Screenings & Doctor Visits</p>
              </div>
              <div className="stat-icon-wrapper bg-green-light">
                <Calendar size={24} color="#10B981" />
              </div>
            </div>
            <div className="stat-card-footer">
              <div className="stat-pill success-pill">
                <span>Screenings: <strong>{nurseDashboardData.upcomingHealthScreenings?.length || 0}</strong></span>
              </div>
              <div className="stat-pill info-pill">
                <span>Doctor Visits: <strong>{nurseDashboardData.upcomingDoctorVisits?.length || 0}</strong></span>
              </div>
            </div>
          </div>

        </div>
      )}

      <div className="dashboard-divider-line" />

      {/* SECTION 1: HEALTH TREND OVERVIEW */}
      <div className="dashboard-header">
        <h2 className="dashboard-title">Health Trend Overview</h2>
        <div className="filter-group">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-input filter-select">
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
              className="filter-input date-picker" 
            />
          )}
          {filterType === 'yearly' && (
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="filter-input filter-select-year">
              {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="timeline-info">
        <p className="period-label">{periodLabel || "Loading timeline..."}</p>
        <p className="timeline-subtext">{timelineLabel}</p>
      </div>

      <div className="graph-container">
        {isLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Analyzing database records...</p>
          </div>
        ) : trendData.length === 0 ? (
          <div className="no-data-container"><h3 className="no-data-title">No Clinic Records Found</h3></div>
        ) : (
          <div className="chart-wrapper">
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
        <div className="averages-container">
          <h4 className="averages-title">{averagesLabel}</h4>
          <div className={`collapsible-container badge-collapsible ${isAveragesExpanded ? 'expanded' : ''}`}>
            <div className="averages-badges-wrapper">
              {complaintsList.map((complaint) => (
                <div key={complaint} className="average-badge-card">
                  <span className="badge-dot" style={{ backgroundColor: getComplaintColor(complaint) }} />
                  <span className="badge-name">{complaint}</span>
                  <span className="badge-value">{averages[complaint] !== undefined ? `${averages[complaint]} avg/mo` : '0 avg/mo'}</span>
                </div>
              ))}
            </div>
          </div>
          {complaintsList.length > 3 && (
            <button className="view-more-toggle-btn" onClick={() => setIsAveragesExpanded(!isAveragesExpanded)}>
              {isAveragesExpanded ? <>View Less <ChevronUp size={14} /></> : <>View More <ChevronDown size={14} /></>}
            </button>
          )}
        </div>
      )}

      {/* SECTION 2: MEDICINE DISPENSED OVERVIEW */}
      <div className="dashboard-divider-line" />

      <div className="dashboard-header">
        <h2 className="dashboard-title">Medicine Dispensed Overview</h2>
        <div className="filter-group">
          <select value={dispensedFilterType} onChange={(e) => setDispensedFilterType(e.target.value)} className="filter-input filter-select">
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
              className="filter-input date-picker" 
            />
          )}
          {dispensedFilterType === 'yearly' && (
            <select value={dispensedSelectedYear} onChange={(e) => setDispensedSelectedYear(e.target.value)} className="filter-input filter-select-year">
              {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="timeline-info">
        <p className="period-label">{dispensedPeriodLabel || "Loading dispensation timeline..."}</p>
        <p className="timeline-subtext">{dispensedTimelineLabel}</p>
      </div>

      {isDispensedLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Analyzing medicine dispensation logs...</p>
        </div>
      ) : dispensedData.length === 0 ? (
        <div className="no-data-container"><h3 className="no-data-title">No Dispensation Records Found</h3></div>
      ) : (
        <>
          {/* GRAPH 1: STANDARD DOSAGE UNITS */}
          <div className="graph-container">
            <h3 className="chart-subtitle">Standard Dosage Units (mg, g, mcg, mL, L)</h3>
            {standardMedicinesInGraph.length === 0 ? (
              <div className="no-data-container" style={{ padding: '20px' }}>
                <p className="no-data-title" style={{ fontSize: '14px' }}>No records found for standard dosage units.</p>
              </div>
            ) : (
              <div className="chart-wrapper">
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
          <div className="graph-container">
            <h3 className="chart-subtitle">Other Units of Measure</h3>
            {otherMedicinesInGraph.length === 0 ? (
              <div className="no-data-container" style={{ padding: '20px' }}>
                <p className="no-data-title" style={{ fontSize: '14px' }}>No records found for other units of measure.</p>
              </div>
            ) : (
              <div className="chart-wrapper">
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
        <div className="averages-container">
          <h4 className="averages-title">{dispensedAveragesLabel || "Average Medicine Dispensed per Month"}</h4>
          <div className={`collapsible-container badge-collapsible ${isDispensedAveragesExpanded ? 'expanded' : ''}`}>
            <div className="averages-badges-wrapper">
              {medicinesList.map((medicine) => {
                const unit = combinedUnitsMap[medicine] || 'dispensed';
                let avgValue = dispensedAverages?.[medicine];

                if (avgValue === undefined || avgValue === null) {
                  if (dispensedData.length > 0) {
                    const total = dispensedData.reduce((sum, item) => sum + (Number(item[medicine]) || 0), 0);
                    avgValue = total > 0 ? (total / dispensedData.length).toFixed(1) : 0;
                  } else {
                    avgValue = 0;
                  }
                }

                return (
                  <div key={medicine} className="average-badge-card">
                    <span className="badge-dot" style={{ backgroundColor: getMedicineColor(medicine) }} />
                    <span className="badge-name">{medicine}</span>
                    <span className="badge-value">
                      {`${avgValue} ${unit}/mo`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          {medicinesList.length > 3 && (
            <button className="view-more-toggle-btn" onClick={() => setIsDispensedAveragesExpanded(!isDispensedAveragesExpanded)}>
              {isDispensedAveragesExpanded ? <>View Less <ChevronUp size={14} /></> : <>View More <ChevronDown size={14} /></>}
            </button>
          )}
        </div>
      )}

      {/* SECTION 3: PREDICTIVE MEDICINE DEMAND */}
      <div className="dashboard-divider-line" />

      <div className="dashboard-header">
        <h2 className="dashboard-title">{predictiveTitle}</h2>
        <div className="filter-group">
          <label className="filter-label">Select Month: </label>
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
            className="filter-input date-picker" 
          />
        </div>
      </div>

      <div className="graph-container">
        {isPredictiveLoading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p className="loading-text">Calculating container package stock requirements...</p>
          </div>
        ) : activePredictiveData.length === 0 ? (
          <div className="no-data-container"><h3 className="no-data-title">No Predictive Demand Records Found</h3></div>
        ) : (
          <div className="chart-wrapper scrollable-chart">
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
        <div className="averages-container">
          <h4 className="averages-title">Predictive Calculation Breakdown (Dispense Avg / Container Strength)</h4>
          <div className={`collapsible-container card-collapsible ${isPredictiveExpanded ? 'expanded' : ''}`}>
            <div className="predictive-mapping-grid">
              {predictiveData.map((med, index) => (
                <div key={index} className="predictive-mapping-card">
                  <div className="predictive-card-title">{med.name}</div>
                  <div className="predictive-card-text">
                    <strong>Package Strength: </strong>{med.packageStrength} ({med.dosageForm})<br />
                    <strong>Stock at Date: </strong>{med.currentStock} {med.dosageForm}{med.currentStock === 1 ? '' : 's'}<br />
                    <strong>Monthly Avg Dispense: </strong>{med.avgMonthlyDispensedBase} {med.unitOfMeasure}<br />
                    <strong>Calculated Container Demand: </strong>{med.predictedNeed} package(s)/bottle(s)
                  </div>
                </div>
              ))}
            </div>
          </div>
          {predictiveData.length > 2 && (
            <button className="view-more-toggle-btn" onClick={() => setIsPredictiveExpanded(!isPredictiveExpanded)}>
              {isPredictiveExpanded ? <>View Less <ChevronUp size={14} /></> : <>View More <ChevronDown size={14} /></>}
            </button>
          )}
        </div>
      )}

      {/* SECTION 4: DETAILED PANELS GRID */}
      <div className="dashboard-divider-line" />

      <div className="dashboard-section-header">
        <h2 className="dashboard-title">Detailed Clinic Records & Deadlines</h2>
      </div>

      {!isNurseDashboardLoading && (
        <div className="dashboard-details-grid">
          
          {/* 1. Upcoming Requirement Deadlines Details */}
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-title-wrapper">
                <Clock size={18} className="panel-icon text-blue" />
                <h3 className="panel-title">Upcoming Requirement Deadlines</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge">{nurseDashboardData.upcomingRequirementDeadlines.length}</span>
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
            <div className="panel-content">
              {nurseDashboardData.upcomingRequirementDeadlines.length === 0 ? (
                <div className="panel-empty">No upcoming requirement deadlines recorded.</div>
              ) : (
                <div className="table-responsive">
                  <table className="overview-table">
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
                          <td className="font-semibold">{req.requirement_name}</td>
                          <td>
                            <span className={`badge-pill ${req.requirement_type === 'Program' ? 'badge-program' : 'badge-special'}`}>
                              {req.requirement_type}
                            </span>
                          </td>
                          <td className="text-muted">
                            {req.requirement_type === 'Program' 
                              ? `Program: ${req.program_name || req.program_code || 'All Programs'} (Yr ${req.year_level || 'All'})`
                              : `Student: ${req.student_name || 'Specific Student'}`
                            }
                          </td>
                          <td className="text-highlight">{formatDate(req.submission_deadline)}</td>
                          <td>
                            <span className={`status-tag ${req.allow_late_submission ? 'tag-allowed' : 'tag-strict'}`}>
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
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-title-wrapper">
                <Pill size={18} className="panel-icon text-red" />
                <h3 className="panel-title">Medicine Stock Level Alerts</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge count-badge-red">{nurseDashboardData.medicineStockAlerts.length}</span>
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
            <div className="panel-content">
              {nurseDashboardData.medicineStockAlerts.length === 0 ? (
                <div className="panel-empty panel-empty-success">
                  <CheckCircle2 size={18} color="#10B981" />
                  <span>All medicine batch stock levels are currently adequate.</span>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="overview-table">
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
                            <div className="font-semibold">{med.generic_name}</div>
                            {med.brand_name && <div className="text-xs text-muted">({med.brand_name})</div>}
                          </td>
                          <td>{med.dosage_form || 'N/A'}</td>
                          <td>
                            <strong className={med.stock_status === 'CRITICAL' ? 'text-red' : 'text-orange'}>
                              {med.current_stock}
                            </strong>
                          </td>
                          <td className="text-xs text-muted">
                            Low: {med.low_stock_level} | Crit: {med.critical_stock_level}
                          </td>
                          <td>
                            <span className={`status-badge ${med.stock_status === 'CRITICAL' ? 'badge-critical' : 'badge-low'}`}>
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
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-title-wrapper">
                <Activity size={18} className="panel-icon text-green" />
                <h3 className="panel-title">Upcoming Health Screenings</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge">{nurseDashboardData.upcomingHealthScreenings.length}</span>
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
            <div className="panel-content">
              {nurseDashboardData.upcomingHealthScreenings.length === 0 ? (
                <div className="panel-empty">No upcoming health screenings scheduled.</div>
              ) : (
                <div className="cards-list">
                  {nurseDashboardData.upcomingHealthScreenings.map((screen) => (
                    <div key={screen.screening_schedule_id} className="detail-card border-left-green">
                      <div className="card-top-row">
                        <h4 className="card-item-title">{screen.title}</h4>
                        <span className="badge-pill badge-green">{screen.screening_type || 'Screening'}</span>
                      </div>
                      <div className="card-meta-grid">
                        <div>
                          <Calendar size={13} className="inline-icon" />
                          <strong>Date:</strong> {formatDate(screen.scheduled_date)}
                        </div>
                        <div>
                          <Clock size={13} className="inline-icon" />
                          <strong>Time:</strong> {formatTime(screen.start_time)} - {formatTime(screen.end_time)}
                        </div>
                        <div>
                          <GraduationCap size={13} className="inline-icon" />
                          <strong>Target:</strong> Program: {screen.target_program_name || screen.target_program || 'All Programs'}, Yr {screen.target_year_level || 'All'} ({screen.target_section || 'All Sections'})
                        </div>
                      </div>
                      {screen.announcement && (
                        <div className="card-announcement">
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
          <div className="detail-panel">
            <div className="panel-header">
              <div className="panel-title-wrapper">
                <Stethoscope size={18} className="panel-icon text-purple" />
                <h3 className="panel-title">Upcoming Doctor Visits</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="count-badge">{nurseDashboardData.upcomingDoctorVisits.length}</span>
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
            <div className="panel-content">
              {nurseDashboardData.upcomingDoctorVisits.length === 0 ? (
                <div className="panel-empty">No upcoming doctor visits scheduled.</div>
              ) : (
                <div className="cards-list">
                  {nurseDashboardData.upcomingDoctorVisits.map((visit) => (
                    <div key={visit.appointment_id} className="detail-card border-left-purple">
                      <div className="card-top-row">
                        <h4 className="card-item-title">{visit.title || `Doctor Visit`}</h4>
                        <span className="badge-pill badge-purple">{visit.status || 'Scheduled'}</span>
                      </div>
                      <div className="card-meta-grid">
                        <div>
                          <Clock size={13} className="inline-icon" />
                          <strong>Schedule:</strong> {formatDateTime(visit.start_time)}
                        </div>
                        <div>
                          <UserCheck size={13} className="inline-icon" />
                          <strong>Doctor:</strong> {visit.doctor_name || visit.doctor || 'Assigned Doctor'}
                        </div>
                        {visit.assigned_by_nurse_name && (
                          <div>
                            <strong>Assigned By:</strong> Nurse {visit.assigned_by_nurse_name}
                          </div>
                        )}
                      </div>
                      {visit.announcement && (
                        <div className="card-announcement">
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
      <div className="dashboard-divider-line" />

      <div className="dashboard-header">
        <div className="title-with-badge">
          <h2 className="dashboard-title">Frequent Complaint Alerts</h2>
          {alerts.length > 0 && <span className="alert-count-badge">{alerts.length}</span>}
        </div>
        <button className="view-all-btn" onClick={() => setIsModalOpen(true)}>
          <Eye size={16} /> View All Alerts
        </button>
      </div>
      <p className="section-subtitle">Students with recurring clinic visits for similar health concerns</p>

      {isAlertsLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Checking frequent visit patterns...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty-alert-card">
          <div className="empty-icon"><CheckCircle2 size={28} /></div>
          <h3 className="empty-title">No Frequent Complaint Alerts</h3>
          <p className="empty-subtext">There are currently no students exceeding visit thresholds for recurring complaints.</p>
        </div>
      ) : (
        <div className="frequent-alerts-grid">
          {alerts.slice(0, 6).map((alert, index) => (
            <div key={index} className="alert-card">
              <div className="alert-card-header">
                <div>
                  <h3 className="alert-student-name">{alert.studentName}</h3>
                  {alert.gradeSection && <span style={{ fontSize: '12px', color: '#6B7280' }}>{alert.gradeSection}</span>}
                </div>
                <span className="visit-badge">{alert.visitCount} Visits</span>
              </div>
              <div className="complaint-chip" style={{ marginTop: '8px' }}>
                <strong>Complaint:</strong> {alert.complaint}
              </div>
              {alert.advice && (
                <div className="advice-box" style={{ marginTop: '10px' }}>
                  <div className="advice-header">
                    <Lightbulb size={15} /> <strong>Recommended Advice</strong>
                  </div>
                  <p className="advice-text">{alert.advice}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ALL ALERTS OVERVIEW MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Frequent Complaint Alerts Overview</h3>
                <p className="modal-subtitle">Detailed record of recurring student visits</p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <div className="modal-filter-bar">
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search student name, complaint..." 
                  value={modalSearch} 
                  onChange={(e) => setModalSearch(e.target.value)} 
                  className="filter-input modal-search-input" 
                />
              </div>
              <div className="date-input-wrapper">
                <Calendar size={16} className="date-icon" />
                <input 
                  type="date" 
                  value={modalDate} 
                  onChange={(e) => setModalDate(e.target.value)} 
                  className="filter-input date-picker" 
                />
              </div>
              {modalDate && (
                <button className="clear-date-btn" onClick={() => setModalDate('')}>
                  Clear Date
                </button>
              )}
            </div>

            <div className="modal-body-scroll">
              <div className="modal-alerts-table-wrapper">
                <table className="modal-alerts-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Complaint</th>
                      <th>Visits</th>
                      <th>Date Recorded</th>
                      <th>Advice / Recommendation</th>
                      <th className="action-col-header" style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="empty-table-cell">
                          No matching records found.
                        </td>
                      </tr>
                    ) : (
                      filteredAlerts.map((alert, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="table-student-name">{alert.studentName}</div>
                            {alert.gradeSection && <div className="text-xs text-muted">{alert.gradeSection}</div>}
                          </td>
                          <td><span className="complaint-tag">{alert.complaint}</span></td>
                          <td><span className="visit-badge-table">{alert.visitCount} visits</span></td>
                          <td>{alert.date || 'N/A'}</td>
                          <td><div className="table-advice-cell">{alert.advice || 'No specific advice provided'}</div></td>
                          <td className="action-col-cell">
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                className="row-action-icon-btn" 
                                title="View visit details" 
                                aria-label="View record details"
                                onClick={() => handleViewDetails(alert)}
                              >
                                <Eye size={16} />
                              </button>
                              <button 
                                className="row-action-icon-btn" 
                                title="Dismiss Alert" 
                                aria-label="Dismiss Alert"
                                onClick={() => handleDismissAlert(alert.studentId, alert.complaint)}
                                style={{ color: '#EF4444' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-close-secondary-btn" onClick={() => setIsModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED VISIT LIST MODAL */}
      {isDetailModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Frequent Visit Details</h3>
                <p className="modal-subtitle">
                  <strong>{selectedAlertHeader?.studentName}</strong> — <span style={{ color: '#0250A3', fontWeight: 600 }}>{selectedAlertHeader?.complaint}</span> ({detailVisits.length} Visits within 1 Month)
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsDetailModalOpen(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-scroll" style={{ padding: '20px' }}>
              {isDetailLoading ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <p className="loading-text">Loading visit records for this complaint...</p>
                </div>
              ) : detailVisits.length === 0 ? (
                <div className="panel-empty">No detailed visit records found for this period.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {detailVisits.map((visit, vIdx) => (
                    <div key={visit.visitId || vIdx} style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px', backgroundColor: '#FAFAFA' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #F3F4F6' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#1F2937' }}>Visit #{detailVisits.length - vIdx}</span>
                          <span className="badge-pill badge-program">{formatDate(visit.visitDate)}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Clock size={14} /> Time In: {formatTime(visit.timeIn)} | Time Out: {formatTime(visit.timeOut)}
                        </div>
                      </div>

                      {/* Vital Signs Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px', background: '#FFFFFF', padding: '10px', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
                        <div>
                          <strong style={{ fontSize: '11px', color: '#6B7280', display: 'block', textTransform: 'uppercase' }}>Blood Pressure</strong> 
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{visit.bloodPressure || 'N/A'}</span>
                        </div>
                        <div>
                          <strong style={{ fontSize: '11px', color: '#6B7280', display: 'block', textTransform: 'uppercase' }}>Temperature</strong> 
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{visit.temperature ? `${visit.temperature} °C` : 'N/A'}</span>
                        </div>
                        <div>
                          <strong style={{ fontSize: '11px', color: '#6B7280', display: 'block', textTransform: 'uppercase' }}>Pulse Rate</strong> 
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{visit.pulseRate || 'N/A'}</span>
                        </div>
                        <div>
                          <strong style={{ fontSize: '11px', color: '#6B7280', display: 'block', textTransform: 'uppercase' }}>Respiratory Rate</strong> 
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{visit.respiratoryRate || 'N/A'}</span>
                        </div>
                      </div>

                      {/* Nursing Intervention & Health Advice */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                        <div style={{ background: '#F0F9FF', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #0250A3' }}>
                          <strong style={{ color: '#0250A3', display: 'block', marginBottom: '4px' }}>Nursing Intervention:</strong>
                          <p style={{ margin: 0, color: '#374151' }}>{visit.nursingIntervention || 'None recorded'}</p>
                        </div>
                        <div style={{ background: '#FEFCE8', padding: '10px 12px', borderRadius: '6px', borderLeft: '3px solid #EAB308' }}>
                          <strong style={{ color: '#854D0E', display: 'block', marginBottom: '4px' }}>Health Advice:</strong>
                          <p style={{ margin: 0, color: '#374151' }}>{visit.healthAdvice || 'None recorded'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-close-secondary-btn" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NurseDashboard;