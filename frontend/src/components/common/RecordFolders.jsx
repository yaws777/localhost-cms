// RecordFolders.jsx
// Shared folder navigation pieces used by Doctor Visits and Health Screening:
// breadcrumb, folder cards and a pager.
import React from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronLeft, Footprints } from 'lucide-react';
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

// Client-side paging helper for lists that are already in memory (e.g. participants of one batch)
export const paginate = (list, page, pageSize) => {
    const pageCount = Math.max(Math.ceil(list.length / pageSize), 1);
    const safePage = Math.min(Math.max(page, 1), pageCount);
    return { items: list.slice((safePage - 1) * pageSize, safePage * pageSize), page: safePage, pageCount, total: list.length };
};
