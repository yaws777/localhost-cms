// FormDocument.jsx
// A filled-in clinic form (clinic visit, medicine dispensed, incident report, health screening) shown like the paper form:
// header card, titled sections of boxed fields, read only. The icon button exports the same layout as a PDF
// (school header, nurse signature "Marilou H. Balarao"). Both read one model from utils/formModels.js.
//   model: see utils/formModels.js | showPdf: icon button on the form | showHeader: header card with the key facts
//   compact: one column, for a narrow side panel
import React, { useId } from 'react';
import { FileDown, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
import Modal from './Modal';
import VitalMeta from './VitalMeta';
import { useAlert } from '../../context/AlertContext';
import { printFormDocument } from '../../utils/formDocument';
import '../../styles/common/FormDocument.css';

const rowsFor = (text) => Math.min(8, Math.max(2, String(text).split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 70)), 0)));

// the PDF icon button, also used on its own by pages that already have a footer
export const FormPdfButton = ({ model, className = '' }) => {
    const { showAlert } = useAlert();
    return (
        <button
            type="button"
            className={`fd-pdf ${className}`.trim()}
            onClick={() => printFormDocument(model, () => showAlert('Allow popups to preview the PDF.', 'warning'))}
            aria-label="Export PDF"
            title="Export PDF"
        >
            <FileDown size={18} aria-hidden="true" />
        </button>
    );
};

export const FormDocument = ({ model, showPdf = true, showHeader = true, compact = false }) => {
    const uid = useId();
    if (!model) return null;
    return (
        <form className={`fd-form${compact ? ' fd-compact' : ''}`} onSubmit={(e) => e.preventDefault()} aria-label={model.title}>
            {(showHeader || showPdf) && (
                <div className="fd-bar">
                    {showHeader && model.header && model.header.length > 0 ? (
                        <div className="fd-head">
                            {model.header.map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>)}
                        </div>
                    ) : <span className="fd-bar-fill" />}
                    {showPdf && <FormPdfButton model={model} />}
                </div>
            )}

            {model.flag && (
                <div className={`fd-flag fd-flag-${model.flagTone || 'warn'}`} role="status">
                    {model.flagTone === 'ok' ? <CheckCircle2 size={16} aria-hidden="true" /> : model.flagTone === 'bad' ? <Ban size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />} {model.flag}
                </div>
            )}

            {model.sections.filter((s) => s.fields.length > 0).map((s, si) => (
                <section key={s.title} className="fd-section" aria-labelledby={`${uid}-h${si}`}>
                    <h4 id={`${uid}-h${si}`}>{s.title}</h4>
                    <div className={`fd-grid fd-c${s.cols || 2}`}>
                        {s.fields.map((f, fi) => {
                            const id = `${uid}-s${si}-f${fi}`;
                            return (
                                <div key={`${f.label}-${fi}`} className={`fd-field${f.wide ? ' fd-wide' : ''}`}>
                                    <label htmlFor={id}>{f.label}</label>
                                    {f.area
                                        ? <textarea id={id} readOnly rows={rowsFor(f.value)} value={f.value} />
                                        : <input id={id} type="text" readOnly value={f.value} />}
                                    <VitalMeta status={f.status} range={f.range} />
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}

            {model.foot && <p className="fd-foot">{model.foot}</p>}
        </form>
    );
};

// The form in a dialog with the PDF icon in the footer (nurse pages that list records)
export const FormDocumentModal = ({ model, onClose }) => {
    if (!model) return null;
    return (
        <Modal
            isOpen
            onClose={onClose}
            title={model.title}
            size="lg"
            footer={<FormPdfButton model={model} />}
        >
            <FormDocument model={model} showPdf={false} />
        </Modal>
    );
};

export default FormDocument;
