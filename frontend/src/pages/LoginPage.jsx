import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth-context';

const initialSignup = {
  fullName: '',
  email: '',
  password: '',
  role: 'inventory_manager',
};

const initialLogin = {
  email: '',
  password: '',
};

const initialReset = {
  email: '',
  otp: '',
  newPassword: '',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [resetForm, setResetForm] = useState(initialReset);
  const [otpPreview, setOtpPreview] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', loginForm);
      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/signup', signupForm);
      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  }

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
    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', resetForm);
      setMessage(response.data.message || 'Password reset successful.');
      setMode('login');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <p className="eyebrow">Inventory Management System</p>
        <h1>CoreInventory</h1>
        <p className="muted">
          A modular, real-time stock platform for receipts, deliveries, transfers, and adjustments.
        </p>

        <div className="auth-tabs">
          <button type="button" onClick={() => setMode('login')} className={mode === 'login' ? 'active' : ''}>
            Login
          </button>
          <button type="button" onClick={() => setMode('signup')} className={mode === 'signup' ? 'active' : ''}>
            Sign Up
          </button>
          <button type="button" onClick={() => setMode('reset')} className={mode === 'reset' ? 'active' : ''}>
            Reset Password
          </button>
        </div>

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="form-grid">
            <label>
              Email
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : 'Login'}
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="form-grid">
            <label>
              Full name
              <input
                type="text"
                required
                value={signupForm.fullName}
                onChange={(e) => setSignupForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                required
                value={signupForm.email}
                onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                minLength={6}
                value={signupForm.password}
                onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
              />
            </label>
            <label>
              Role
              <select
                value={signupForm.role}
                onChange={(e) => setSignupForm((p) => ({ ...p, role: e.target.value }))}
              >
                <option value="inventory_manager">Inventory Manager</option>
                <option value="warehouse_staff">Warehouse Staff</option>
              </select>
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : 'Create account'}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="form-grid">
            <label>
              Email
              <input
                type="email"
                required
                value={resetForm.email}
                onChange={(e) => setResetForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <button type="button" className="ghost" onClick={handleGenerateOtp}>
              Generate OTP
            </button>
            {otpPreview && (
              <p className="otp-note">Development OTP: {otpPreview}</p>
            )}
            <label>
              OTP code
              <input
                type="text"
                required
                minLength={6}
                maxLength={6}
                value={resetForm.otp}
                onChange={(e) => setResetForm((p) => ({ ...p, otp: e.target.value }))}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                required
                minLength={6}
                value={resetForm.newPassword}
                onChange={(e) => setResetForm((p) => ({ ...p, newPassword: e.target.value }))}
              />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : 'Reset Password'}
            </button>
          </form>
        )}

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
