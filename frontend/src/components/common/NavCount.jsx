// NavCount.jsx
// Number on a sidebar item: how many red dots wait in that page. Number + text name, not color alone.
import React from 'react';
import '../../styles/common/TabDot.css';

const NavCount = ({ count, className = '' }) => {
    if (!count || count < 1) return null;
    const text = count > 99 ? '99+' : String(count);
    const label = `${count} new`;
    return <span className={`nav-count-new ${className}`.trim()} role="status" aria-label={label} title={label}>{text}</span>;
};

export default NavCount;
