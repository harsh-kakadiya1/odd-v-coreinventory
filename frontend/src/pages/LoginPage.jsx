import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth-context';

const initialLogin = {
  loginId: '',
  password: '',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', loginForm);
      login(response.data.token, response.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid Login Id or Password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel auth-panel-sm">
        <h2 className="auth-title">Login Page</h2>
        <div className="auth-logo-box" aria-label="app-logo" />

        <form onSubmit={handleLogin} className="form-grid">
          <label>
            Login Id
            <input
              type="text"
              required
              minLength={6}
              maxLength={12}
              value={loginForm.loginId}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, loginId: e.target.value }))}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              required
              value={loginForm.password}
              onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 'SIGN IN'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Forget Password ?</Link>
          <Link to="/signup">Sign Up</Link>
        </div>

        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}
