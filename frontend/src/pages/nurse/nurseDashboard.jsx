import React, { useState, useEffect, useCallback } from 'react';
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
  const maxCurrentMonth = getCurrentMonthString();
  const defaultNextMonth = getNextMonthString();

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

  useEffect(() => {
    fetchHealthTrends();
    fetchMedicineDispensed();
    fetchPredictiveDemand();
    fetchFrequentAlerts();
  }, [fetchHealthTrends, fetchMedicineDispensed, fetchPredictiveDemand, fetchFrequentAlerts]);

  const activeComplaintsInGraph = complaintsList.filter(complaint => 
    trendData.some(dataPoint => (Number(dataPoint[complaint]) || 0) > 0)
  );

  const activeMedicinesInGraph = medicinesList.filter(medicine => 
    dispensedData.some(dataPoint => (Number(dataPoint[medicine]) || 0) > 0)
  );

  // Split active medicines by dosage unit of measure
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

  return (
    <div className="dashboard-container">
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
              {isAveragesExpanded ? 'View Less ▲' : 'View More ▼'}
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
          {/* GRAPH 1: STANDARD DOSAGE UNITS (mg, g, mcg, mL, L) */}
          <div className="graph-container">
            <h3 className="chart-subtitle" style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600, color: '#374151' }}>
              Standard Dosage Units (mg, g, mcg, mL, L)
            </h3>
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
          <div className="graph-container" style={{ marginTop: '24px' }}>
            <h3 className="chart-subtitle" style={{ marginBottom: '12px', fontSize: '15px', fontWeight: 600, color: '#374151' }}>
              Other Units of Measure
            </h3>
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
              {isDispensedAveragesExpanded ? 'View Less ▲' : 'View More ▼'}
            </button>
          )}
        </div>
      )}

      {/* SECTION 3: PREDICTIVE MEDICINE DEMAND */}
      <div className="dashboard-divider-line" />

      <div className="dashboard-header">
        <h2 className="dashboard-title">{predictiveTitle}</h2>
        <div className="filter-group">
          <label style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>Select Month: </label>
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
          <div className="chart-wrapper" style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
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
              {isPredictiveExpanded ? 'View Less ▲' : 'View More ▼'}
            </button>
          )}
        </div>
      )}

      {/* SECTION 4: FREQUENT COMPLAINT ALERTS */}
      <div className="dashboard-divider-line" />

      <div className="dashboard-header">
        <div className="title-with-badge">
          <h2 className="dashboard-title">Frequent Complaint Alerts</h2>
          {alerts.length > 0 && <span className="alert-count-badge">{alerts.length}</span>}
        </div>
        <button className="view-all-btn" onClick={() => setIsModalOpen(true)}>View All Alerts</button>
      </div>
      <p className="section-subtitle">Students with recurring clinic visits for similar health concerns</p>

      {isAlertsLoading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p className="loading-text">Checking frequent visit patterns...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty-alert-card">
          <div className="empty-icon">✓</div>
          <h3 className="empty-title">No Frequent Complaint Alerts</h3>
          <p className="empty-subtext">There are currently no students exceeding visit thresholds for recurring complaints.</p>
        </div>
      ) : (
        <div className="frequent-alerts-grid">
          {alerts.slice(0, 6).map((alert, index) => (
            <div key={index} className="alert-card">
              <div>
                <div className="alert-card-header">
                  <div>
                    <h3 className="alert-student-name">{alert.studentName}</h3>
                    <span className="alert-student-id">ID: {alert.studentId}</span>
                  </div>
                  <span className="visit-badge">{alert.visitCount} Visits</span>
                </div>
                <div className="complaint-chip">
                  <strong>Complaint:</strong> {alert.complaint}
                </div>
              </div>
              {alert.advice && (
                <div className="advice-box">
                  <div className="advice-header">
                    <span>💡</span> <strong>Recommended Advice</strong>
                  </div>
                  <p className="advice-text">{alert.advice}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL TABLE */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Frequent Complaint Alerts Overview</h3>
                <p className="modal-subtitle">Detailed record of recurring student visits</p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>

            <div className="modal-filter-bar">
              <input type="text" placeholder="Search by student name, ID, or complaint..." value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} className="filter-input modal-search-input" />
              <input type="date" value={modalDate} onChange={(e) => setModalDate(e.target.value)} className="filter-input date-picker" />
              {modalDate && <button className="clear-date-btn" onClick={() => setModalDate('')}>Clear Date</button>}
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>No matching records found.</td>
                      </tr>
                    ) : (
                      filteredAlerts.map((alert, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="table-student-name">{alert.studentName}</div>
                            <div className="table-student-id">{alert.studentId}</div>
                          </td>
                          <td><span className="complaint-tag">{alert.complaint}</span></td>
                          <td><span className="visit-badge-table">{alert.visitCount} visits</span></td>
                          <td>{alert.date || 'N/A'}</td>
                          <td><div className="table-advice-cell">{alert.advice || 'No specific advice provided'}</div></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-close-secondary-btn" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseDashboard;