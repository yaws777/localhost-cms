// TabDot.jsx
// Small red dot on a tab or sidebar item: something new waits there. Not color alone: it carries a text name for screen readers.
import React from 'react';
import '../../styles/common/TabDot.css';

const TabDot = ({ show, label = 'New', className = '' }) => {
    if (!show) return null;
    return <span className={`tab-dot ${className}`.trim()} role="status" aria-label={label} title={label} />;
};

// Green pulsing dot: something is on going now. Carries a text name, never color alone.
export const LiveDot = ({ show, label = 'On going now' }) => {
    if (!show) return null;
    return <span className="live-dot" role="status" aria-label={label} title={label} />;
};

export default TabDot;
