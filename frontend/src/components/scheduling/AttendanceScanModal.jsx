// AttendanceScanModal.jsx
// Scans the QR code of a student (the code holds the student ID) and marks the student's queue number as arrived,
// so the doctor can record the check-up. Works on the numbers of one session queue.
import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { QrCode } from 'lucide-react';
import Modal from '../common/Modal';

// entries: the queue entries of the session; onArrived(entry): marks the entry as arrived (resolves true when it worked)
const AttendanceScanModal = ({ isOpen, entries, onArrived, onClose }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const latest = useRef({ entries, onArrived });
    const [feedback, setFeedback] = useState({ message: 'Hold the QR code of the student in front of the camera.', type: 'info' });

    useEffect(() => { latest.current = { entries, onArrived }; }, [entries, onArrived]);

    useEffect(() => {
        if (!isOpen) return undefined;
        setFeedback({ message: 'Hold the QR code of the student in front of the camera.', type: 'info' });
        let stream = null;
        let frame = 0;
        let scanning = true;

        const handleCode = async (raw) => {
            const studentId = String(raw || '').trim();
            const { entries: list, onArrived: mark } = latest.current;
            const entry = list.find((e) => e.student_id === studentId && ['Waiting', 'Serving'].includes(e.state));
            if (!entry) { setFeedback({ message: `${studentId || 'This code'} has no number waiting in this session.`, type: 'error' }); return; }
            if (entry.arrived) { setFeedback({ message: `${entry.student_name} (${entry.label}) already has a time in.`, type: 'info' }); return; }
            const ok = await mark(entry);
            setFeedback(ok
                ? { message: `${entry.student_name} (${entry.label}) is marked as arrived.`, type: 'success' }
                : { message: `Could not mark ${entry.student_name} as arrived.`, type: 'error' });
        };

        const scanFrame = () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (scanning && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
                if (code && code.data) {
                    scanning = false;
                    handleCode(code.data);
                    setTimeout(() => { scanning = true; }, 2500);
                }
            }
            frame = requestAnimationFrame(scanFrame);
        };

        (async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                if (!videoRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute('playsinline', 'true');
                await videoRef.current.play();
                frame = requestAnimationFrame(scanFrame);
            } catch (err) {
                setFeedback({ message: 'Unable to use the camera. Allow camera access, or use the Time in button of the number instead.', type: 'error' });
            }
        })();

        return () => {
            scanning = false;
            if (frame) cancelAnimationFrame(frame);
            if (stream) stream.getTracks().forEach((t) => t.stop());
        };
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Scan QR code for attendance" icon={<QrCode size={20} />} size="md">
            <div className="scan-box-sc">
                <video ref={videoRef} muted aria-label="Camera" />
                <canvas ref={canvasRef} hidden />
            </div>
            <div className={`scan-feedback-sc ${feedback.type}`} role="status" aria-live="polite">{feedback.message}</div>
        </Modal>
    );
};

export default AttendanceScanModal;
