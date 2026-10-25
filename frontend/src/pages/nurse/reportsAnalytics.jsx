import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  Pill,
  ShieldAlert,
  ClipboardList,
  Boxes,
  Users,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import '../../styles/nurse/ReportsAnalytics.css';
import { useAlert } from '../../context/AlertContext';
import { openReportWindow, writeSectionedReport } from '../../utils/printReport';
import { formatMonthDay, formatDate, formatCurrentDate } from '../../utils/datetime';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const GRANULARITIES = [
  { value: 'daily', label: 'Daily', unit: 'day' },
  { value: 'weekly', label: 'Weekly', unit: 'week' },
  { value: 'monthly', label: 'Monthly', unit: 'month' }
];

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'health', label: 'Health Trends', icon: Activity },
  { id: 'medicine', label: 'Medicine Dispensed', icon: Pill },
  { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
  { id: 'services', label: 'Requests & Services', icon: ClipboardList },
  { id: 'inventory', label: 'Inventory', icon: Boxes }
];

const COLORS = { visits: '#005691', incidents: '#dc2626', dispensed: '#16a34a', direct: '#005691', consultation: '#f5b301' };
const TOOLTIP_STYLE = { borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' };
const TICK = { fontSize: 11, fill: '#64748B' };

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
    const text = `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
    return {
      startDate: ymd(first),
      endDate: ymd(last),
      displayText: text,
      shortText: text,
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

const EMPTY_REPORT = {
  overview: {
    totalVisits: 0, distinctStudents: 0, totalIncidents: 0, totalDispensed: 0,
    previousVisits: 0, previousIncidents: 0, previousDispensed: 0,
    visitsChangePercent: null, incidentsChangePercent: null, dispensedChangePercent: null,
    topComplaint: 'None', topMedicine: 'None', topIncidentLocation: 'None'
  },
  trend: { unit: 'day', points: [] },
  health: { conditions: [], programs: [], frequentVisitors: [] },
  medicine: { items: [], split: { direct: 0, consultation: 0 } },
  incidents: { locations: [], recent: [] },
  services: { excuseSlips: [], referralSlips: [], appointments: [], appointmentTypes: [], requirements: [] },
  inventory: { summary: { total: 0, out: 0, critical: 0, low: 0, adequate: 0, expiring: 0, expired: 0 }, attention: [] }
};

const EMPTY_FORECAST = { periodLabel: '', items: [] };

const sum = (list) => list.reduce((total, item) => total + item.count, 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const percentText = (p) => (p === null ? '—' : `${p > 0 ? '+' : ''}${p}%`);

/* ---------- small building blocks ---------- */

// "▲ +12% vs previous week (8)"; badWhenUp colors a rise red (incidents, illness)
const Delta = ({ percent, previous, unit, badWhenUp = false }) => {
  if (percent === null) return <span className="ra-delta flat">No data in the previous {unit}</span>;
  const dir = percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat';
  const tone = dir === 'flat' ? 'flat' : (dir === 'up') === badWhenUp ? 'bad' : 'good';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  return (
    <span className={`ra-delta ${tone}`}>
      <Icon size={13} /> {percentText(percent)} vs previous {unit} ({previous})
    </span>
  );
};

const Panel = ({ title, note, children, className = '' }) => (
  <section className={`ra-panel ${className}`}>
    <div className="ra-panel-head">
      <h2 className="ra-panel-title">{title}</h2>
      {note && <span className="ra-panel-note">{note}</span>}
    </div>
    {children}
  </section>
);

const Empty = ({ children }) => <div className="ra-empty">{children}</div>;

const Kpi = ({ icon: Icon, label, value, tone, children }) => (
  <div className={`ra-kpi ${tone}`}>
    <div className="ra-kpi-label"><Icon size={16} /> {label}</div>
    <div className="ra-kpi-value">{value}</div>
    {children && <div className="ra-kpi-note">{children}</div>}
  </div>
);

const Highlight = ({ label, value }) => (
  <div className="ra-highlight">
    <span className="ra-highlight-label">{label}</span>
    <strong className="ra-highlight-value" title={value}>{value}</strong>
  </div>
);

// Horizontal bars for a ranked list: [{ label, value, note }]
const BarList = ({ items, color = COLORS.visits, emptyText }) => {
  if (items.length === 0) return <Empty>{emptyText}</Empty>;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="ra-barlist">
      {items.map((item) => (
        <li key={item.label}>
          <div className="ra-bar-row">
            <span className="ra-bar-label" title={item.label}>{item.label}</span>
            <span className="ra-bar-value">{item.value}{item.note ? <em> {item.note}</em> : null}</span>
          </div>
          <div className="ra-bar-track"><div className="ra-bar-fill" style={{ width: `${(item.value / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
};

const Table = ({ columns, children, empty, isEmpty }) => (
  isEmpty ? <Empty>{empty}</Empty> : (
    <div className="ra-table-wrap">
      <table className="ra-table">
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
);

const ChangeBadge = ({ row }) => {
  if (row.trend === 'new') return <span className="ra-badge new">New</span>;
  if (row.trend === 'same') return <span className="ra-badge flat">No change</span>;
  const up = row.trend === 'up';
  return <span className={`ra-badge ${up ? 'bad' : 'good'}`}>{up ? '▲ +' : '▼ '}{row.delta}</span>;
};

const StatusPill = ({ status }) => <span className={`ra-pill ${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>;

const ServiceGroup = ({ title, items, emptyText, color }) => (
  <Panel title={title} note={`${sum(items)} total`}>
    <BarList items={items.map((i) => ({ label: i.label, value: i.count }))} color={color} emptyText={emptyText} />
  </Panel>
);

/* ---------- page ---------- */

const ReportsAnalytics = () => {
  const { showAlert } = useAlert();
  const [granularity, setGranularity] = useState('weekly');
  const [offset, setOffset] = useState(0);
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview'));
  const [data, setData] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const latestRequest = useRef(0);
  const [forecast, setForecast] = useState(EMPTY_FORECAST);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');

  const period = useMemo(() => getPeriod(granularity, offset), [granularity, offset]);
  const unitInfo = GRANULARITIES.find((g) => g.value === granularity);
  const unit = unitInfo.unit;

  const changeGranularity = (value) => {
    setGranularity(value);
    setOffset(0);
  };

  const fetchData = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setErrorMessage('');
    try {
      const query = new URLSearchParams({ startDate: period.startDate, endDate: period.endDate }).toString();
      const response = await fetch(`http://localhost:3001/api/reports-analytics?${query}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }
      const result = await response.json();
      if (requestId !== latestRequest.current) return; // a newer period was requested meanwhile
      setData({
        overview: { ...EMPTY_REPORT.overview, ...(result.overview || {}) },
        trend: result.trend || EMPTY_REPORT.trend,
        health: { ...EMPTY_REPORT.health, ...(result.health || {}) },
        medicine: { ...EMPTY_REPORT.medicine, ...(result.medicine || {}) },
        incidents: { ...EMPTY_REPORT.incidents, ...(result.incidents || {}) },
        services: { ...EMPTY_REPORT.services, ...(result.services || {}) },
        inventory: { ...EMPTY_REPORT.inventory, ...(result.inventory || {}) }
      });
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      console.error('Failed to fetch reports and analytics:', error);
      setErrorMessage(error.message || 'Failed to fetch data from backend server.');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [period.startDate, period.endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Predictive medicine demand: a rolling forecast for the next 30 days, so it is not tied to the selected period
  const fetchForecast = useCallback(async () => {
    setForecastLoading(true);
    setForecastError('');
    try {
      const response = await fetch('http://localhost:3001/api/predictive-medicine');
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const result = await response.json();
      const items = (result.data || []).map((m) => {
        const containerStrength = Number(m.containerStrength) || 1;
        const usedLast30 = (m.history || []).reduce((total, n) => total + (Number(n) || 0), 0) / containerStrength;
        return {
          name: m.name,
          unit: m.unitOfMeasure,
          stock: m.currentStock,
          status: m.status,
          last30d: round2(usedLast30),
          forecast30d: round2(m.forecast30d),
          suggestedRestock: m.suggestedRestock
        };
      }).sort((a, b) => b.forecast30d - a.forecast30d || a.name.localeCompare(b.name));
      setForecast({ periodLabel: result.periodLabel || '', items });
    } catch (error) {
      console.error('Failed to fetch predictive medicine demand:', error);
      setForecastError('Could not load the predictive medicine demand.');
    } finally {
      setForecastLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const refreshAll = () => {
    fetchData();
    fetchForecast();
  };

  const { overview, trend, health, medicine, incidents, services, inventory } = data;
  const stockAlerts = inventory.summary.out + inventory.summary.critical + inventory.summary.low;
  const trendLabel = trend.unit === 'hour' ? 'hour' : trend.unit === 'month' ? 'month' : 'day';
  const trendEmpty = trend.points.every((p) => p.visits === 0 && p.incidents === 0 && p.dispensed === 0);
  const v = (value) => (loading ? '…' : value);

  /* ---------- PDF export: the sections of the tab being viewed, as tables ---------- */
  const handleExport = () => {
    const win = openReportWindow(() => showAlert('Please allow pop-ups to export the PDF report.', 'warning'));
    if (!win) return;

    const tabLabel = TABS.find((t) => t.id === tab).label;
    const kv = (list) => list.map((i) => [i.label, i.count]);
    const statusSection = (heading, list, emptyText) => ({ heading, columns: ['Status', 'Count'], rows: kv(list), emptyText });
    const periodDetails = [['Report period', period.displayText], ['Compared with', `the previous ${unit}`]];

    const summarySection = {
      heading: 'Summary',
      columns: ['Measure', `This ${unit}`, `Previous ${unit}`, 'Change'],
      rows: [
        ['Clinic visits', overview.totalVisits, overview.previousVisits, percentText(overview.visitsChangePercent)],
        ['Students seen', overview.distinctStudents, '—', '—'],
        ['Incident reports', overview.totalIncidents, overview.previousIncidents, percentText(overview.incidentsChangePercent)],
        ['Medicine dispensations', overview.totalDispensed, overview.previousDispensed, percentText(overview.dispensedChangePercent)]
      ]
    };
    const trendSection = {
      heading: `Visits, incidents and dispensing by ${trendLabel}`,
      columns: [trendLabel[0].toUpperCase() + trendLabel.slice(1), 'Visits', 'Incidents', 'Dispensed'],
      rows: trend.points.map((p) => [p.weekday ? `${p.label} (${p.weekday})` : p.label, p.visits, p.incidents, p.dispensed]),
      emptyText: 'No activity in this period.'
    };
    const conditionsSection = (list, heading) => ({
      heading,
      columns: ['#', 'Medical condition', 'Cases', 'Students', `Previous ${unit}`],
      rows: list.map((c, i) => [i + 1, c.name, c.count, c.students, c.previousCount]),
      emptyText: 'No medical condition records for this period.'
    });

    const reports = {
      overview: {
        details: [...periodDetails, ['Top medical condition', overview.topComplaint], ['Most dispensed medicine', overview.topMedicine], ['Incident hotspot', overview.topIncidentLocation], ['Stock alerts now', stockAlerts]],
        sections: [
          summarySection,
          trendSection,
          conditionsSection(health.conditions.slice(0, 5), 'Top medical conditions'),
          {
            heading: 'Top medicines dispensed',
            columns: ['#', 'Medicine', 'Dispensations'],
            rows: medicine.items.slice(0, 5).map((m, i) => [i + 1, m.name, m.count]),
            emptyText: 'No medicine dispensations for this period.'
          }
        ]
      },
      health: {
        details: periodDetails,
        sections: [
          conditionsSection(health.conditions, 'Medical conditions'),
          {
            heading: 'Visits by program',
            columns: ['Program', 'Visits', 'Students'],
            rows: health.programs.map((p) => [p.name, p.count, p.students]),
            emptyText: 'No visits in this period.'
          },
          {
            heading: 'Frequent visitors (more than one visit)',
            columns: ['Student', 'Visits'],
            rows: health.frequentVisitors.map((s) => [s.name, s.count]),
            emptyText: 'No student visited more than once in this period.'
          }
        ]
      },
      medicine: {
        details: [...periodDetails, ['Total dispensations', overview.totalDispensed], ['Direct dispensing', medicine.split.direct], ['During consultation', medicine.split.consultation]],
        sections: [
          {
            heading: 'Medicine dispensed',
            columns: ['#', 'Medicine', 'Total', 'Direct', 'During consultation'],
            rows: medicine.items.map((m, i) => [i + 1, m.name, m.count, m.direct, m.consultation]),
            emptyText: 'No medicine dispensations for this period.'
          },
          {
            heading: `Predictive medicine demand${forecast.periodLabel ? ` (${forecast.periodLabel})` : ' (next 30 days)'}`,
            columns: ['#', 'Medicine', 'Current stock', 'Status', 'Used last 30 days', 'Forecast next 30 days', 'Predicted Need'],
            rows: forecast.items.map((m, i) => [i + 1, m.name, `${m.stock} ${m.unit}`, m.status, m.last30d, m.forecast30d, m.suggestedRestock]),
            emptyText: forecastError || 'No predictive medicine demand available.'
          }
        ]
      },
      incidents: {
        details: [...periodDetails, ['Incident reports', overview.totalIncidents], ['Incident hotspot', overview.topIncidentLocation]],
        sections: [
          {
            heading: 'Incidents by location',
            columns: ['Location', 'Incidents', 'Share'],
            rows: incidents.locations.map((l) => [l.name, l.count, `${l.percent}%`]),
            emptyText: 'No incidents in this period.'
          },
          {
            heading: 'Incident reports (latest 10)',
            columns: ['Date and time', 'Student', 'Location', 'What happened', 'First aid', 'Present condition'],
            rows: incidents.recent.map((r) => [r.happenedAt, r.student, r.location, r.description, r.firstAid, r.situation]),
            emptyText: 'No incidents in this period.'
          }
        ]
      },
      services: {
        details: periodDetails,
        sections: [
          statusSection('Excuse slips', services.excuseSlips, 'No excuse slip requests in this period.'),
          statusSection('Referral slips', services.referralSlips, 'No referral slip requests in this period.'),
          statusSection('Doctor appointments by status', services.appointments, 'No doctor appointments in this period.'),
          { ...statusSection('Doctor appointments by type', services.appointmentTypes, 'No doctor appointments in this period.'), columns: ['Type', 'Count'] },
          statusSection('Medical requirement submissions (all students, not tied to the period)', services.requirements, 'No requirement submissions yet.')
        ]
      },
      inventory: {
        details: [['Stock as of', formatCurrentDate(new Date())], ['Medicines', inventory.summary.total], ['Adequate', inventory.summary.adequate], ['Low', inventory.summary.low], ['Critical', inventory.summary.critical], ['Out of stock', inventory.summary.out], ['Expiring soon', inventory.summary.expiring], ['Expired', inventory.summary.expired]],
        sections: [
          {
            heading: 'Medicines needing attention',
            columns: ['Medicine', 'Status', 'Current stock', 'Expiring soon', 'Expired', 'Nearest expiry', '30-day forecast', 'Predicted Need'],
            rows: inventory.attention.map((m) => [m.name, m.status, `${m.stock} ${m.unit}`, m.expiringStock, m.expiredStock, m.nearestExpiry ? formatDate(m.nearestExpiry) : '—', m.forecast30d, m.suggestedRestock]),
            emptyText: 'Every medicine is adequately stocked and in date.'
          }
        ]
      }
    };

    const { details, sections } = reports[tab];
    writeSectionedReport(win, {
      title: tab === 'inventory' ? `${tabLabel} Report` : `${unitInfo.label} ${tabLabel} Report`,
      details,
      sections
    });
  };

  const forecastPanel = (
    <Panel title="Predictive medicine demand" note={`Forecast for ${forecast.periodLabel || 'the next 30 days'} · live, not tied to the period`}>
      {forecastError ? <Empty>{forecastError}</Empty> : forecast.items.length === 0 ? <Empty>{forecastLoading ? 'Loading the forecast…' : 'No predictive medicine demand available'}</Empty> : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(10, forecast.items.length) * 40 + 50)}>
            <BarChart layout="vertical" data={forecast.items.slice(0, 10)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" tick={TICK} />
              <YAxis type="category" dataKey="name" tick={TICK} width={150} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend verticalAlign="top" height={28} iconType="rect" />
              <Bar dataKey="stock" name="Current stock" fill={COLORS.direct} barSize={12} />
              <Bar dataKey="forecast30d" name="Forecast next 30 days" fill={COLORS.consultation} barSize={12} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <Table columns={['#', 'Medicine', 'Current stock', 'Status', 'Used last 30 days', 'Forecast next 30 days', 'Predicted Need']} isEmpty={false}>
            {forecast.items.map((m, i) => (
              <tr key={m.name}>
                <td>{i + 1}</td>
                <td>{m.name}</td>
                <td className="nowrap">{m.stock} {m.unit}</td>
                <td><StatusPill status={m.status} /></td>
                <td>{m.last30d}</td>
                <td><strong>{m.forecast30d}</strong></td>
                <td><strong>{m.suggestedRestock}</strong></td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Panel>
  );

  /* ---------- tabs ---------- */
  const trendChart = (
    <Panel title={`Visits, incidents and dispensing by ${trendLabel}`}>
      {trendEmpty ? <Empty>No activity in this {unit}</Empty> : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend.points} margin={{ top: 10, right: 12, left: -20, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="label" tick={{ ...TICK, fontSize: 10 }} interval={trend.points.length > 16 ? 'preserveStartEnd' : 0} angle={-30} textAnchor="end" height={55} />
            <YAxis tick={TICK} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend verticalAlign="top" height={28} iconType="plainline" />
            <Line type="monotone" dataKey="visits" name="Visits" stroke={COLORS.visits} strokeWidth={2.5} dot={trend.points.length <= 16} />
            <Line type="monotone" dataKey="dispensed" name="Medicines dispensed" stroke={COLORS.dispensed} strokeWidth={2.5} dot={trend.points.length <= 16} />
            <Line type="monotone" dataKey="incidents" name="Incidents" stroke={COLORS.incidents} strokeWidth={2.5} dot={trend.points.length <= 16} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );

  const overviewTab = (
    <>
      <div className="ra-kpis">
        <Kpi icon={Users} label="Clinic visits" tone="blue" value={v(overview.totalVisits)}>
          {!loading && <><div>{overview.distinctStudents} student{overview.distinctStudents === 1 ? '' : 's'} seen</div><Delta percent={overview.visitsChangePercent} previous={overview.previousVisits} unit={unit} /></>}
        </Kpi>
        <Kpi icon={Pill} label="Medicines dispensed" tone="green" value={v(overview.totalDispensed)}>
          {!loading && <Delta percent={overview.dispensedChangePercent} previous={overview.previousDispensed} unit={unit} />}
        </Kpi>
        <Kpi icon={ShieldAlert} label="Incident reports" tone="red" value={v(overview.totalIncidents)}>
          {!loading && <Delta percent={overview.incidentsChangePercent} previous={overview.previousIncidents} unit={unit} badWhenUp />}
        </Kpi>
        <Kpi icon={Boxes} label="Stock alerts" tone="amber" value={v(stockAlerts)}>
          {!loading && <div>{inventory.summary.out} out · {inventory.summary.critical} critical · {inventory.summary.low} low</div>}
        </Kpi>
      </div>

      <div className="ra-highlights">
        <Highlight label="Top medical condition" value={loading ? '…' : overview.topComplaint} />
        <Highlight label="Most dispensed medicine" value={loading ? '…' : overview.topMedicine} />
        <Highlight label="Incident hotspot" value={loading ? '…' : overview.topIncidentLocation} />
      </div>

      {trendChart}

      <div className="ra-grid-2">
        <Panel title="Top medical conditions" note="Open Health Trends for the full list">
          <BarList items={health.conditions.slice(0, 5).map((c) => ({ label: c.name, value: c.count }))} emptyText={`No medical condition records for this ${unit}`} />
        </Panel>
        <Panel title="Top medicines dispensed" note="Open Medicine Dispensed for the full list">
          <BarList items={medicine.items.slice(0, 5).map((m) => ({ label: m.name, value: m.count }))} color={COLORS.dispensed} emptyText={`No medicine dispensations for this ${unit}`} />
        </Panel>
      </div>
    </>
  );

  const healthTab = (
    <>
      <Panel title="Medical conditions" note={`Each student counts once per condition per month · this ${unit} vs the previous ${unit}`}>
        <Table
          columns={['#', 'Medical condition', 'Cases', 'Students', `vs previous ${unit}`]}
          isEmpty={health.conditions.length === 0}
          empty={`No medical condition records for this ${unit}`}
        >
          {health.conditions.map((c, i) => (
            <tr key={c.name}>
              <td>{i + 1}</td>
              <td>{c.name}</td>
              <td><strong>{c.count}</strong></td>
              <td>{c.students}</td>
              <td><ChangeBadge row={c} /></td>
            </tr>
          ))}
        </Table>
      </Panel>

      <div className="ra-grid-2">
        <Panel title="Visits by program" note="Top 10 programs">
          <BarList items={health.programs.map((p) => ({ label: p.name, value: p.count, note: `${p.students} student${p.students === 1 ? '' : 's'}` }))} emptyText={`No visits in this ${unit}`} />
        </Panel>
        <Panel title="Frequent visitors" note={`More than one visit this ${unit}`}>
          <BarList items={health.frequentVisitors.map((s) => ({ label: s.name, value: s.count, note: 'visits' }))} color={COLORS.incidents} emptyText="No student visited more than once" />
        </Panel>
      </div>
    </>
  );

  const medicineTab = (
    <>
      <div className="ra-kpis three">
        <Kpi icon={Pill} label="Total dispensations" tone="green" value={v(overview.totalDispensed)}>
          {!loading && <Delta percent={overview.dispensedChangePercent} previous={overview.previousDispensed} unit={unit} />}
        </Kpi>
        <Kpi icon={Pill} label="Direct dispensing" tone="blue" value={v(medicine.split.direct)} />
        <Kpi icon={Pill} label="During consultation" tone="amber" value={v(medicine.split.consultation)} />
      </div>

      <Panel title="Most dispensed medicines" note="Top 10, direct vs during consultation">
        {medicine.items.length === 0 ? <Empty>No medicine dispensations for this {unit}</Empty> : (
          <ResponsiveContainer width="100%" height={Math.max(220, Math.min(10, medicine.items.length) * 34 + 50)}>
            <BarChart layout="vertical" data={medicine.items.slice(0, 10)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" tick={TICK} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={TICK} width={150} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend verticalAlign="top" height={28} iconType="rect" />
              <Bar dataKey="direct" name="Direct" stackId="d" fill={COLORS.direct} barSize={18} />
              <Bar dataKey="consultation" name="During consultation" stackId="d" fill={COLORS.consultation} barSize={18} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      <Panel title="All medicines dispensed">
        <Table columns={['#', 'Medicine', 'Total', 'Direct', 'Consultation']} isEmpty={medicine.items.length === 0} empty={`No medicine dispensations for this ${unit}`}>
          {medicine.items.map((m, i) => (
            <tr key={m.name}><td>{i + 1}</td><td>{m.name}</td><td><strong>{m.count}</strong></td><td>{m.direct}</td><td>{m.consultation}</td></tr>
          ))}
        </Table>
      </Panel>

      {forecastPanel}
    </>
  );

  const incidentsTab = (
    <>
      <div className="ra-kpis three">
        <Kpi icon={ShieldAlert} label="Incident reports" tone="red" value={v(overview.totalIncidents)}>
          {!loading && <Delta percent={overview.incidentsChangePercent} previous={overview.previousIncidents} unit={unit} badWhenUp />}
        </Kpi>
        <Kpi icon={ShieldAlert} label="Hotspot" tone="amber" value={v(overview.topIncidentLocation)} />
      </div>

      <div className="ra-grid-2">
        <Panel title="Incidents by location" note="Top 8">
          <BarList items={incidents.locations.map((l) => ({ label: l.name, value: l.count, note: `${l.percent}%` }))} color={COLORS.incidents} emptyText={`No incidents in this ${unit}`} />
        </Panel>
        <Panel title="Incidents over time">
          {trend.points.every((p) => p.incidents === 0) ? <Empty>No incidents in this {unit}</Empty> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trend.points} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ ...TICK, fontSize: 10 }} interval={trend.points.length > 16 ? 'preserveStartEnd' : 0} angle={-30} textAnchor="end" height={55} />
                <YAxis tick={TICK} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="incidents" name="Incidents" fill={COLORS.incidents} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      <Panel title="Incident reports" note="Latest 10 in this period">
        <Table columns={['Date and time', 'Student', 'Location', 'What happened', 'First aid', 'Present condition']} isEmpty={incidents.recent.length === 0} empty={`No incidents in this ${unit}`}>
          {incidents.recent.map((r) => (
            <tr key={r.id}>
              <td className="nowrap">{r.happenedAt}</td>
              <td>{r.student}</td>
              <td>{r.location}</td>
              <td className="wrap">{r.description}</td>
              <td className="wrap">{r.firstAid}</td>
              <td className="wrap">{r.situation}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </>
  );

  const servicesTab = (
    <>
      <div className="ra-grid-2">
        <ServiceGroup title="Excuse slips" items={services.excuseSlips} emptyText={`No excuse slip requests this ${unit}`} color={COLORS.visits} />
        <ServiceGroup title="Referral slips" items={services.referralSlips} emptyText={`No referral slip requests this ${unit}`} color={COLORS.consultation} />
        <ServiceGroup title="Doctor appointments by status" items={services.appointments} emptyText={`No doctor appointments this ${unit}`} color={COLORS.dispensed} />
        <ServiceGroup title="Doctor appointments by type" items={services.appointmentTypes} emptyText={`No doctor appointments this ${unit}`} color={COLORS.visits} />
      </div>
      <Panel title="Medical requirement submissions" note="All students, current standing (not tied to the period)">
        <BarList items={services.requirements.map((r) => ({ label: r.label, value: r.count }))} color={COLORS.direct} emptyText="No requirement submissions yet" />
      </Panel>
    </>
  );

  const inventoryTab = (
    <>
      <div className="ra-note">Live stock as of now. It does not change with the selected period.</div>
      <div className="ra-kpis seven">
        <Kpi icon={Boxes} label="Medicines" tone="blue" value={v(inventory.summary.total)} />
        <Kpi icon={Boxes} label="Adequate" tone="green" value={v(inventory.summary.adequate)} />
        <Kpi icon={Boxes} label="Low" tone="amber" value={v(inventory.summary.low)} />
        <Kpi icon={Boxes} label="Critical" tone="red" value={v(inventory.summary.critical)} />
        <Kpi icon={Boxes} label="Out of stock" tone="red" value={v(inventory.summary.out)} />
        <Kpi icon={Boxes} label="Expiring soon" tone="amber" value={v(inventory.summary.expiring)} />
        <Kpi icon={Boxes} label="Expired" tone="red" value={v(inventory.summary.expired)} />
      </div>

      <Panel title="Medicines needing attention" note="Out of stock, low, expiring or expired">
        <Table
          columns={['Medicine', 'Status', 'Current stock', 'Expiring soon', 'Expired', 'Nearest expiry', '30-day forecast', 'Predicted Need']}
          isEmpty={inventory.attention.length === 0}
          empty="Every medicine is adequately stocked and in date."
        >
          {inventory.attention.map((m) => (
            <tr key={m.name}>
              <td>{m.name}</td>
              <td><StatusPill status={m.status} /></td>
              <td className="nowrap">{m.stock} {m.unit}</td>
              <td>{m.expiringStock || '—'}</td>
              <td>{m.expiredStock || '—'}</td>
              <td className="nowrap">{m.nearestExpiry ? formatDate(m.nearestExpiry) : '—'}</td>
              <td>{m.forecast30d}</td>
              <td><strong>{m.suggestedRestock}</strong></td>
            </tr>
          ))}
        </Table>
        <div className="ra-panel-foot">
          <Link to="/MedicineInventory" className="ra-link">Open Medicine Inventory</Link>
        </div>
      </Panel>
    </>
  );

  const tabContent = { overview: overviewTab, health: healthTab, medicine: medicineTab, incidents: incidentsTab, services: servicesTab, inventory: inventoryTab }[tab];

  return (
    <div className="ra-container">
      <header className="ra-header">
        <div className="ra-header-text">
          <h1 className="ra-title">Reports &amp; Analytics</h1>
          <p className="ra-subtitle">Health trends, medicine dispensing, incidents, services and inventory in one place</p>
        </div>
        <div className="ra-header-actions">
          <button className="ra-btn secondary" onClick={refreshAll} disabled={loading || forecastLoading} title="Refresh data" aria-label="Refresh data">
            <RefreshCw size={16} className={loading || forecastLoading ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button className="ra-btn primary" onClick={handleExport} disabled={loading || forecastLoading} title={`Export the ${TABS.find((t) => t.id === tab).label} tab as a PDF report`} aria-label="Export PDF report">
            <Download size={16} />
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      {errorMessage && (
        <div className="ra-error" role="alert">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="ra-controls">
        <div className="ra-tabs" role="tablist" aria-label="Report sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ra-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              <Icon size={15} /> <span>{label}</span>
            </button>
          ))}
        </div>

        {tab !== 'inventory' && (
          <div className="ra-period">
            <div className="ra-segment" role="group" aria-label="Report period">
              {GRANULARITIES.map((g) => (
                <button key={g.value} type="button" aria-pressed={granularity === g.value} className={`ra-segment-btn ${granularity === g.value ? 'active' : ''}`} onClick={() => changeGranularity(g.value)}>
                  {g.label}
                </button>
              ))}
            </div>
            <div className="ra-stepper">
              <button className="ra-step-btn" onClick={() => setOffset((prev) => prev + 1)} title={`Previous ${unit}`} aria-label={`Previous ${unit}`}>
                <ChevronLeft size={18} />
              </button>
              <div className="ra-step-info">
                <span className="ra-step-range">{period.displayText}</span>
                <span className="ra-step-tag">{period.offsetLabel}</span>
              </div>
              <button className="ra-step-btn" onClick={() => setOffset((prev) => Math.max(0, prev - 1))} disabled={offset === 0} title={`Next ${unit}`} aria-label={`Next ${unit}`}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`ra-content ${loading ? 'loading' : ''}`} role="tabpanel" aria-busy={loading}>{tabContent}</div>
    </div>
  );
};

export default ReportsAnalytics;
