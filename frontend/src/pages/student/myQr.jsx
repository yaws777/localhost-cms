import React, { useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';

const MyQr = () => {
  // Extract values provided by Outlet context in StudentLayout.jsx
  const { studentId, firstName, lastName } = useOutletContext();
  const qrRef = useRef(null);

  const handleDownload = () => {
    if (!qrRef.current || !studentId) return;

    const canvas = qrRef.current.querySelector('canvas');
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `QR_${studentId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '30px auto', textAlign: 'center' }}>
      <h2>My Student QR Code</h2>

      {studentId ? (
        <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', padding: '20px', backgroundColor: 'var(--bg-card)' }}>
          <h3>{firstName} {lastName}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>ID: {studentId}</p>

          {/* QR Code rendering only the studentId value */}
          <div ref={qrRef} style={{ margin: '20px 0' }}>
            <QRCodeCanvas
              value={studentId}
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>

          <button
            onClick={handleDownload}
            style={{
              padding: '10px 20px',
              backgroundColor: 'var(--sti-blue-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '5px',
              fontSize: '0.9375rem',
              cursor: 'pointer'
            }}
          >
            Download QR Code
          </button>
        </div>
      ) : (
        <p>Loading student QR code...</p>
      )}
    </div>
  );
};

export default MyQr;