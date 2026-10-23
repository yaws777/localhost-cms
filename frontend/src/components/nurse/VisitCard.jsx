// VisitCard.jsx
// One doctor visit (a batch of students, or a single booking) in the Visits list.
import React from 'react';
import { Stethoscope, Clock, Users, QrCode, Play, Edit, Trash2 } from 'lucide-react';
import { formatTime } from '../../utils/datetime';
import { visitLabel } from '../../utils/visitPurpose';

const TYPE_CLASS = {
    'Dental': 'type-dental-dv',
    'Vision': 'type-vision-dv',
    'Follow-up': 'type-followup-dv',
    'Referral': 'type-referral-dv'
};

// tab: 'upcoming' | 'ongoing' | 'past' decides which actions a visit offers
const VisitCard = ({ group, tab, onParticipants, onScan, onStart, onEdit, onDelete }) => {
    const total = group.appointments.length;
    const present = group.appointments.filter(a => (a.attendance_status || '').toLowerCase() === 'present').length;

    return (
        <div className="visit-card-dv">
            <div className="visit-body-dv">
                <div className="visit-tags-dv">
                    <span className="visit-specialty-dv"><Stethoscope size={14} /> {group.specialization}</span>
                    <span className={`visit-type-dv ${TYPE_CLASS[group.visitType] || ''}`}>{visitLabel(group.visitType, group.purposeOther)}</span>
                </div>

                <h3 className="visit-title-dv">{group.title}</h3>

                <ul className="visit-facts-dv">
                    <li><Clock size={16} /> {group.apptStart ? formatTime(group.apptStart) : ''} - {group.apptEnd ? formatTime(group.apptEnd) : ''}</li>
                    <li><Users size={16} /> <span><strong>{present} / {total}</strong> present</span></li>
                    <li className="visit-doctor-dv">{group.doctorName}{group.batchId ? ` - Batch #${group.batchId}` : ''}</li>
                </ul>
            </div>

            <div className="visit-actions-dv">
                <button type="button" className="sti-btn-dv sti-btn-primary-dv visit-main-dv" onClick={() => onParticipants(group)}>
                    <Users size={16} /> Participants
                </button>
                {tab === 'ongoing' && (
                    <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => onScan(group)} title="Scan QR attendance for this visit">
                        <QrCode size={16} /> Scan QR
                    </button>
                )}
                {tab === 'ongoing' && group.batchId && (
                    <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => onStart(group)} title="Notify the students that this batch is starting">
                        <Play size={16} /> Start
                    </button>
                )}
                {tab === 'upcoming' && group.batchId && (
                    <>
                        <button type="button" className="sti-btn-dv sti-btn-secondary-dv" onClick={() => onEdit(group)} title="Edit batch date and start/end time">
                            <Edit size={16} /> Edit
                        </button>
                        <button type="button" className="sti-btn-dv visit-delete-dv" onClick={() => onDelete(group)} title="Delete this batch schedule permanently">
                            <Trash2 size={16} /> Delete
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default VisitCard;
