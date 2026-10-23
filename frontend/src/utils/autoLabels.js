// autoLabels.js
// Ties every `.dp-field > label` (doctor portal form fields) to the input that follows it, so labels are read by
// screen readers and clicking a label focuses its field. Runs for fields that appear later (dialogs) too.
import { useEffect } from 'react';

let counter = 0;

const linkLabels = () => {
    document.querySelectorAll('.dp-field > label:not([for])').forEach((label) => {
        const control = label.parentElement.querySelector('input:not([type="hidden"]), select, textarea');
        if (!control) return;
        if (!control.id) control.id = `dpf-${++counter}`;
        label.setAttribute('for', control.id);
    });
};

export const useDpAutoLabels = () => {
    useEffect(() => {
        linkLabels();
        const observer = new MutationObserver(linkLabels);
        observer.observe(document.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);
};
