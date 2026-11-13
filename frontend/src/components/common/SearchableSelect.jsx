// SearchableSelect.jsx
// A select you can type into: options filter as you type (ARIA combobox + listbox, arrow keys, Enter, Esc).
import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import '../../styles/common/SearchableSelect.css';

export default function SearchableSelect({
    id,
    value,
    onChange,
    options,
    placeholder = '-- Select --',
    disabled = false,
    ariaLabel
}) {
    const autoId = useId();
    const inputId = id || `${autoId}-input`;
    const listId = `${autoId}-list`;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const listRef = useRef(null);

    const selected = options.find((o) => String(o.value) === String(value));
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
    }, [options, query]);

    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.children[active];
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    const openList = () => {
        if (disabled) return;
        setQuery('');
        const i = options.findIndex((o) => String(o.value) === String(value));
        setActive(i >= 0 ? i : 0);
        setOpen(true);
    };

    const choose = (opt) => {
        if (!opt) return;
        onChange(String(opt.value));
        setOpen(false);
        setQuery('');
    };

    const onKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) openList();
            else setActive((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (open) setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            if (open) {
                e.preventDefault();
                choose(filtered[active]);
            }
        } else if (e.key === 'Escape') {
            if (open) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setQuery('');
            }
        } else if (e.key === 'Tab') {
            setOpen(false);
            setQuery('');
        }
    };

    return (
        <div className="ss-wrap">
            <input
                id={inputId}
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
                aria-label={ariaLabel}
                className="ss-input"
                autoComplete="off"
                disabled={disabled}
                placeholder={selected ? selected.label : placeholder}
                value={open ? query : (selected ? selected.label : '')}
                onFocus={openList}
                onClick={() => { if (!open) openList(); }}
                onChange={(e) => { setQuery(e.target.value); setActive(0); if (!open) setOpen(true); }}
                onBlur={() => { setOpen(false); setQuery(''); }}
                onKeyDown={onKeyDown}
            />
            <ChevronDown size={16} className="ss-chevron" aria-hidden="true" />
            {open && (
                <ul id={listId} role="listbox" className="ss-list" ref={listRef}>
                    {filtered.length === 0 ? (
                        <li className="ss-empty" role="option" aria-disabled="true" aria-selected="false">No match</li>
                    ) : filtered.map((o, i) => (
                        <li
                            key={o.value}
                            id={`${listId}-${i}`}
                            role="option"
                            aria-selected={String(o.value) === String(value)}
                            className={`ss-option${i === active ? ' ss-active' : ''}${String(o.value) === String(value) ? ' ss-selected' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); choose(o); }}
                            onMouseEnter={() => setActive(i)}
                        >
                            {o.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
