import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth-context';

const initialSignup = {
  loginId: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'inventory_manager',
};

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$/;

export default function SignupPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordChecks = {
    minLength: signupForm.password.length >= 9,
    hasLower: /[a-z]/.test(signupForm.password),
    hasUpper: /[A-Z]/.test(signupForm.password),
    hasSpecial: /[^A-Za-z0-9]/.test(signupForm.password),
  };

  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);
  const isConfirmMatched = signupForm.confirmPassword.length > 0 && signupForm.password === signupForm.confirmPassword;

  async function handleSignup(event) {
    event.preventDefault();
    setError('');

    if (signupForm.password !== signupForm.confirmPassword) {
      setError('Password and Re-Enter Password must match.');
      return;
    }

    if (!passwordRule.test(signupForm.password)) {
      setError('Password must contain lowercase, uppercase, special character and be more than 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        loginId: signupForm.loginId,
        fullName: signupForm.loginId,
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

  return (
    <div className="auth-wrap">
      <div className="auth-split">
        <section className="auth-visual" aria-hidden="true">
          <img src={require('../assets/hero.png')} alt="Inventory illustration" />
          <div className="auth-visual-copy">
            <h2>Inventory Management</h2>
            <p>Create an account to manage warehouses, stock, and movements.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <h1 className="auth-title">Create an account</h1>
            <p className="muted">Sign up to access CoreInventory</p>

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

              <button type="submit" disabled={loading || !isPasswordStrong || !isConfirmMatched}>
                {loading ? 'Please wait...' : 'Sign Up'}
              </button>

              {(!isPasswordStrong || !isConfirmMatched) && (
                <p className="error-inline">Complete the password requirements to continue.</p>
              )}
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
