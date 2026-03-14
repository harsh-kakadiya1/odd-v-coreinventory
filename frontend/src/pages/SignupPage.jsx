import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth-context';
import heroImage from '../assets/hero.png';

const initialSignup = {
  loginId: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'inventory_manager',
};

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

const passwordChecks = [
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
    key: 'hasSpecial',
    label: 'Add at least one special character',
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

function getStrengthColor(strengthPercent) {
  const hue = Math.round((strengthPercent / 100) * 120);
  return `hsl(${hue} 80% 42%)`;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkResults = passwordChecks.map((rule) => ({
    ...rule,
    valid: rule.test(signupForm.password),
  }));
  const unmetPasswordChecks = checkResults.filter((rule) => !rule.valid).map((rule) => rule.label);
  const fulfilledChecks = checkResults.filter((rule) => rule.valid).length;
  const strengthPercent = Math.round((fulfilledChecks / checkResults.length) * 100);
  const strengthColor = getStrengthColor(strengthPercent);

  const isPasswordStrong = unmetPasswordChecks.length === 0;
  const isConfirmMatched = signupForm.confirmPassword.length > 0 && signupForm.password === signupForm.confirmPassword;
  const unmetSignupRequirements = [
    ...unmetPasswordChecks,
    ...(signupForm.confirmPassword.length > 0 && !isConfirmMatched ? ['Confirm password must match'] : []),
  ];

  async function handleSignup(event) {
    event.preventDefault();
    setError('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setError('Password and Re-Enter Password must match.');
      return;
    }

    if (!passwordRule.test(signupForm.password)) {
      setError('Password must contain lowercase, uppercase, and special character and be more than 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        loginId: signupForm.loginId.trim(),
        fullName: signupForm.loginId.trim(),
        email: signupForm.email.trim(),
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

  return (
    <div className="auth-wrap">
      <div className="auth-split">
        <section className="auth-visual" aria-hidden="true">
            <img
              src="/login.jpg"
              alt=""
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = heroImage;
              }}
            />
          <div className="auth-visual-copy">
            <h2>Inventory Management</h2>
            <p>Create an account to manage warehouses, stock, and movements.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <h1 className="auth-title">Create an account</h1>
            <p className="muted auth-subtitle">Sign up to access CoreInventory</p>

            <form onSubmit={handleSignup} className="form-grid">
              <label>
                Login Id
                <input
                  type="text"
                  required
                  minLength={6}
                  maxLength={12}
                  value={signupForm.loginId}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, loginId: e.target.value }))}
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  required
                  value={signupForm.email}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={9}
                  value={signupForm.password}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, password: e.target.value }))}
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
                Re-Enter Password
                <input
                  type="password"
                  required
                  minLength={9}
                  value={signupForm.confirmPassword}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
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
                  required
                  value={signupForm.role}
                  onChange={(e) => setSignupForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="inventory_manager">Inventory Manager</option>
                  <option value="warehouse_staff">Warehouse Staff</option>
                </select>
              </label>

              <button type="submit" disabled={loading || unmetSignupRequirements.length > 0 || !isConfirmMatched}>
                {loading ? 'Please wait...' : 'Sign Up'}
              </button>

              {(!isPasswordStrong || !isConfirmMatched) && <p className="error-inline">Complete the password requirements to continue.</p>}
            </form>

            <div className="auth-links auth-links-center">
              <Link to="/login">Back to Login</Link>
            </div>

            {error && <p className="error-message">{error}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
