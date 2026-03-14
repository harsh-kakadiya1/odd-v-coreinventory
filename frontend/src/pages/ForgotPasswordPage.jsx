import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const initialReset = {
  email: '',
  otp: '',
  newPassword: '',
  confirmPassword: '',
};

export default function ForgotPasswordPage() {
  const [resetForm, setResetForm] = useState(initialReset);
  const [otpPreview, setOtpPreview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGenerateOtp() {
    setError('');
    setMessage('');
    setOtpPreview('');

    try {
      const response = await api.post('/auth/request-reset', { email: resetForm.email });
      setOtpPreview(response.data.otp || '');
      setMessage(response.data.message || 'OTP generated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate OTP.');
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setError('Password and Re-Enter Password must match.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        email: resetForm.email,
        otp: resetForm.otp,
        newPassword: resetForm.newPassword,
      };

      const response = await api.post('/auth/reset-password', payload);
      setMessage(response.data.message || 'Password reset successful.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel auth-panel-sm">
        <h2 className="auth-title">Forget Password</h2>
        <div className="auth-logo-box" aria-label="app-logo" />

        <form onSubmit={handleResetPassword} className="form-grid">
          <label>
            Enter Email Id
            <input
              type="email"
              required
              value={resetForm.email}
              onChange={(e) => setResetForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>

          <button type="button" className="ghost" onClick={handleGenerateOtp}>
            Generate OTP
          </button>

          {otpPreview && <p className="otp-note">Development OTP: {otpPreview}</p>}

          <label>
            Enter OTP
            <input
              type="text"
              required
              minLength={6}
              maxLength={6}
              value={resetForm.otp}
              onChange={(e) => setResetForm((prev) => ({ ...prev, otp: e.target.value }))}
            />
          </label>

          <label>
            Enter Password
            <input
              type="password"
              required
              minLength={9}
              value={resetForm.newPassword}
              onChange={(e) => setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            />
          </label>

          <label>
            Re-Enter Password
            <input
              type="password"
              required
              minLength={9}
              value={resetForm.confirmPassword}
              onChange={(e) => setResetForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 'RESET PASSWORD'}
          </button>
        </form>

        <div className="auth-links auth-links-center">
          <Link to="/login">Back to Login</Link>
        </div>

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
