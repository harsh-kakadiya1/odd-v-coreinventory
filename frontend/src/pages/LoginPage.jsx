import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth-context';
import heroImage from '../assets/hero.png';

const initialSignup = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
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

const signupPasswordChecks = [
  {
    key: 'minLength',
    label: 'Use at least 9 characters',
    test: (password) => password.length >= 9,
  },
  {
    key: 'hasLower',
    label: 'Add at least one lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    key: 'hasUpper',
    label: 'Add at least one uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    key: 'hasNumber',
    label: 'Add at least one number',
    test: (password) => /\d/.test(password),
  },
  {
    key: 'hasSpecial',
    label: 'Add at least one special character',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

function getStrengthColor(strengthPercent) {
  const hue = Math.round((strengthPercent / 100) * 120);
  return `hsl(${hue} 80% 42%)`;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [mode, setMode] = useState('login');
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [resetForm, setResetForm] = useState(initialReset);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordCheckResults = signupPasswordChecks.map((rule) => ({
    ...rule,
    valid: rule.test(signupForm.password),
  }));
  const unmetPasswordChecks = passwordCheckResults.filter((rule) => !rule.valid);
  const isConfirmMatched =
    signupForm.confirmPassword.length > 0 && signupForm.password === signupForm.confirmPassword;
  const unmetConfirmRequirement =
    signupForm.confirmPassword.length > 0 && !isConfirmMatched
      ? ['Confirm password must match']
      : [];
  const unmetSignupRequirements = [
    ...unmetPasswordChecks.map((rule) => rule.label),
    ...unmetConfirmRequirement,
  ];
  const fulfilledChecks = passwordCheckResults.filter((rule) => rule.valid).length;
  const strengthPercent = Math.round((fulfilledChecks / passwordCheckResults.length) * 100);
  const strengthColor = getStrengthColor(strengthPercent);

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

    if (unmetSignupRequirements.length > 0 || !isConfirmMatched) {
      setError('Please complete the remaining signup requirements.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        fullName: signupForm.fullName,
        email: signupForm.email,
        password: signupForm.password,
        role: signupForm.role,
      };

      const response = await api.post('/auth/signup', payload);
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

    try {
      const response = await api.post('/auth/request-reset', { email: resetForm.email });
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
      <div className="auth-split">
        <section className="auth-visual" aria-hidden="true">
          <img src={heroImage} alt="" />
          <div className="auth-visual-copy">
            <h2>Inventory Management Platform</h2>
            <p>Track stock, warehouses, and move history from one reliable workspace.</p>
          </div>
        </section>

        <section className="auth-panel">
          <p className="eyebrow">CoreInventory</p>
          <h1>Hello</h1>
          <p className="muted">Sign in or create an account to get started.</p>

          <div className="auth-tabs">
            <button type="button" onClick={() => setMode('login')} className={mode === 'login' ? 'active' : ''}>
              Login
            </button>
            <button type="button" onClick={() => setMode('signup')} className={mode === 'signup' ? 'active' : ''}>
              Sign Up
            </button>
            <button type="button" onClick={() => setMode('reset')} className={mode === 'reset' ? 'active' : ''}>
              Reset
            </button>
          </div>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="form-grid">
              <label>
                Email Address
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
                Full Name
                <input
                  type="text"
                  required
                  value={signupForm.fullName}
                  onChange={(e) => setSignupForm((p) => ({ ...p, fullName: e.target.value }))}
                />
              </label>
              <label>
                Email Address
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
                  minLength={9}
                  value={signupForm.password}
                  onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                />
              </label>

              <div className="password-strength" aria-live="polite">
                <div className="password-strength-head">
                  <span>Password strength</span>
                  <strong style={{ color: strengthColor }}>{strengthPercent}%</strong>
                </div>
                <div className="password-strength-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={strengthPercent}>
                  <span className="password-strength-bar" style={{ width: `${strengthPercent}%`, backgroundColor: strengthColor }} />
                </div>
              </div>

              <label>
                Confirm Password
                <input
                  type="password"
                  required
                  minLength={9}
                  value={signupForm.confirmPassword}
                  onChange={(e) => setSignupForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </label>

              {(signupForm.password.length > 0 || signupForm.confirmPassword.length > 0) && unmetSignupRequirements.length > 0 && (
                <ul className="requirements-list" aria-live="polite">
                  {unmetSignupRequirements.map((requirement) => (
                    <li key={requirement}>{requirement}</li>
                  ))}
                </ul>
              )}

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
              <button type="submit" disabled={loading || unmetSignupRequirements.length > 0 || !isConfirmMatched}>
                {loading ? 'Please wait...' : 'Create Account'}
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="form-grid">
              <label>
                Email Address
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
              <label>
                OTP Code
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
                New Password
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
        </section>
      </div>
    </div>
  );
}
