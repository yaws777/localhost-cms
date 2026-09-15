import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { User, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import '../../styles/parent/MyProfile.css';

const MyProfile = () => {
  // Retrieve parentId from parentLayout.jsx outlet context
  const context = useOutletContext();
  const parentId = context?.parentId;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Philippine Mobile Number Validation Regex
  const validatePHPhone = (number) => {
    const phRegex = /^(09|\+639)\d{9}$/;
    return phRegex.test(number);
  };

  useEffect(() => {
    if (!parentId) {
      setStatus({ type: 'error', message: 'Parent ID missing from context.' });
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/parents/${parentId}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setFirstName(data.data.first_name || '');
          setLastName(data.data.last_name || '');
          setPhone(data.data.primary_phone || '');
        } else {
          setStatus({ type: 'error', message: data.message || 'Failed to fetch profile info.' });
        }
      } catch (err) {
        setStatus({ type: 'error', message: 'Unable to connect to server.' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [parentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!firstName.trim() || !lastName.trim()) {
      setStatus({
        type: 'error',
        message: 'First name and last name cannot be empty.'
      });
      return;
    }

    if (!validatePHPhone(phone)) {
      setStatus({
        type: 'error',
        message: 'Invalid Philippine phone number format. Use 09XXXXXXXXX or +639XXXXXXXXX.'
      });
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`http://localhost:3001/api/parents/${parentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          primary_phone: phone,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus({ type: 'success', message: 'Profile updated successfully!' });
      } else {
        setStatus({ type: 'error', message: data.message || 'Failed to update profile.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Server connection error. Please try again later.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sti-contact-card loading-state">
        <Loader2 className="sti-spinner" size={32} />
        <p>Loading profile settings...</p>
      </div>
    );
  }

  return (
    <div className="sti-contact-container">
      <div className="sti-contact-card">
        <div className="sti-card-header">
          <div className="sti-icon-badge">
            <User size={24} />
          </div>
          <div>
            <h2>Profile Settings</h2>
            <p className="sti-subtitle">Update your personal details and contact number</p>
          </div>
        </div>

        {status.message && (
          <div className={`sti-alert sti-alert-${status.type}`}>
            {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{status.message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="sti-form">
          <div className="sti-form-row">
            <div className="sti-form-group">
              <label htmlFor="first_name">First Name</label>
              <input
                id="first_name"
                type="text"
                className="sti-input-field"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
                required
              />
            </div>

            <div className="sti-form-group">
              <label htmlFor="last_name">Last Name</label>
              <input
                id="last_name"
                type="text"
                className="sti-input-field"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
                required
              />
            </div>
          </div>

          <div className="sti-form-group">
            <label htmlFor="primary_phone">Primary Mobile Number</label>
            <div className="sti-input-wrapper">
              <span className="sti-input-prefix">PH</span>
              <input
                id="primary_phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09171234567 or +639171234567"
                required
              />
            </div>
            <small className="sti-help-text">
              Must be a valid 11-digit local format (0917...) or international (+639...).
            </small>
          </div>

          <button type="submit" className="sti-btn-primary" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="sti-spinner" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MyProfile;