// RecordFolders.jsx
// Shared folder navigation pieces used by Doctor Visits and Health Screening:
// breadcrumb, folder cards and a pager.
import React, { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronLeft, Footprints, MoreVertical } from 'lucide-react';
import '../../styles/common/RecordFolders.css';

export const FolderCrumbs = ({ trail }) => (
    <nav className="crumbs-rf" aria-label="Folder path">
        {trail.map((c, i) => {
            const last = i === trail.length - 1;
            return (
                <React.Fragment key={`${c.label}-${i}`}>
                    {i > 0 && <ChevronRight size={14} className="crumb-sep-rf" />}
                    {last || !c.onClick ? (
                        <span className="crumb-current-rf">{c.label}</span>
                    ) : (
                        <button type="button" className="crumb-link-rf" onClick={c.onClick}>{c.label}</button>
                    )}
                </React.Fragment>
            );
        })}
    </nav>
);

const STAT_LABELS = [
    ['upcoming', 'upcoming'],
    ['ongoing', 'ongoing'],
    ['past', 'past'],
    ['abnormal', 'abnormal']
];

// items: [{ key, title, subtitle, counts: {total, upcoming, ongoing, past, abnormal}, onClick, variant }]
export const FolderGrid = ({ items, noun = 'records', emptyText }) => {
    if (items.length === 0) {
        return <div className="empty-rf">{emptyText || 'No folders yet.'}</div>;
    }
    return (
        <div className="folder-grid-rf">
            {items.map((f) => (
                <button type="button" key={f.key} className={`folder-card-rf ${f.variant ? `folder-${f.variant}-rf` : ''}`} onClick={f.onClick}>
                    <div className="folder-icon-rf">
                        {f.variant === 'individual' ? <Footprints size={26} /> : <Folder size={26} className="icon-closed-rf" />}
                        <FolderOpen size={26} className="icon-open-rf" />
                    </div>
                    <div className="folder-body-rf">
                        <div className="folder-title-rf">{f.title}</div>
                        {f.subtitle && <div className="folder-sub-rf">{f.subtitle}</div>}
                        {f.counts && (
                            <>
                                <div className="folder-total-rf"><strong>{f.counts.total}</strong> {f.counts.total === 1 ? noun.replace(/s$/, '') : noun}</div>
                                <div className="folder-chips-rf">
                                    {STAT_LABELS.map(([key, label]) => (
                                        f.counts[key] > 0 && <span key={key} className={`chip-rf chip-${key}-rf`}>{f.counts[key]} {label}</span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
};

export const Pager = ({ page, pageCount, total, pageSize, onPage, noun = 'records' }) => {
    if (total === 0) return null;
    const first = (page - 1) * pageSize + 1;
    const last = Math.min(page * pageSize, total);
    return (
        <div className="pager-rf">
            <span className="pager-info-rf">Showing {first}-{last} of {total} {noun}</span>
            {pageCount > 1 && (
                <div className="pager-controls-rf">
                    <button type="button" className="pager-btn-rf" disabled={page <= 1} onClick={() => onPage(page - 1)}>
                        <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="pager-page-rf">Page {page} of {pageCount}</span>
                    <button type="button" className="pager-btn-rf" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
                        Next <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

// "BSIT > Year 4 > Section B" style labels
export const sectionLabel = (s) => `Year ${s.year_level || '-'} - Section ${s.section || '-'}`;

// Counts of the folder that is open ({ total, upcoming, ongoing, past, abnormal }), taken from the
// folder summary the server already sent. null when they do not describe the list on screen
// (a search crosses folders) so the tabs show no number rather than a wrong one.
export const scopeCounts = (folders, view, searching = false) => {
    if (searching || !folders) return null;
    const sum = (rows) => rows.reduce((acc, r) => {
        ['total', 'upcoming', 'ongoing', 'past', 'abnormal'].forEach(k => { acc[k] += Number(r[k]) || 0; });
        return acc;
    }, { total: 0, upcoming: 0, ongoing: 0, past: 0, abnormal: 0 });

    if (view.kind === 'individual') return folders.individual || null;
    if (view.kind === 'section') {
        const prog = (folders.programs || []).find(p => p.program_id === view.program_id);
        return (prog?.sections || []).find(s => String(s.year_level) === String(view.year_level) && String(s.section) === String(view.section)) || null;
    }
    if (view.kind === 'all') return sum([...(folders.programs || []), ...(folders.individual ? [folders.individual] : [])]);
    return null;
};

// Page header "More" button for the secondary actions: items = [{ icon, label, onClick }]
export const MoreMenu = ({ items, buttonClassName = '' }) => {
    const [open, setOpen] = useState(false);
    return (
        <div className="more-menu-rf">
            <button type="button" className={buttonClassName} aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <MoreVertical size={18} /> More
            </button>
            {open && (
                <>
                    <div className="menu-backdrop-rf" onClick={() => setOpen(false)} />
                    <div className="menu-list-rf">
                        {items.map(({ icon, label, onClick }) => (
                            <button key={label} type="button" onClick={() => { setOpen(false); onClick(); }}>
                                {icon} {label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// Small number next to a tab label
export const TabCount = ({ value }) => (
    value === null || value === undefined ? null : <span className="tab-count-rf">{value}</span>
);

const pad2 = (n) => String(n).padStart(2, '0');
const localDayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// 'YYYY-MM-DD' of a Date or a date string ('2026-10-22' or '2026-10-22T00:00:00.000Z')
export const dayKey = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? '' : localDayKey(d);
};

// Keeps the order the list came in and cuts it into one block per day: [{ key, items }]
export const groupByDay = (list, getKey) => {
    const groups = [];
    list.forEach((item) => {
        const key = getKey(item) || '';
        const last = groups[groups.length - 1];
        if (last && last.key === key) last.items.push(item);
        else groups.push({ key, items: [item] });
    });
    return groups;
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "Today", "Tomorrow", "Yesterday" or the weekday, then the date
export const dayHeading = (key, formatDate) => {
    if (!key) return 'No date';
    const [y, m, d] = key.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    const diff = Math.round((new Date(y, m - 1, d) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
    const rel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : WEEKDAY_NAMES[date.getDay()];
    return `${rel} - ${formatDate(key)}`;
};

// One day of cards: a heading with the number of records, then the cards
export const DaySection = ({ heading, count, noun = 'records', children }) => (
    <section className="day-section-rf">
        <h4 className="day-head-rf">
            <span>{heading}</span>
            <span className="day-count-rf">{count} {count === 1 ? noun.replace(/s$/, '') : noun}</span>
        </h4>
        {children}
    </section>
);

// Client-side paging helper for lists that are already in memory (e.g. participants of one batch)
export const paginate = (list, page, pageSize) => {
    const pageCount = Math.max(Math.ceil(list.length / pageSize), 1);
    const safePage = Math.min(Math.max(page, 1), pageCount);
    return { items: list.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, pageCount, total: list.length };
};
