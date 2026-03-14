import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../auth-context';
import heroImage from '../assets/hero.png';

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

          <div className="auth-tabs auth-tabs-two">
            <button type="button" className="active">
              Login
            </button>
            <button type="button" onClick={() => navigate('/signup')}>
              Sign Up
            </button>
          </div>

          <form onSubmit={handleLogin} className="form-grid">
            <label>
              Login Id
              <input
                type="text"
                required
                minLength={6}
                maxLength={12}
                value={loginForm.loginId}
                onChange={(e) => setLoginForm((p) => ({ ...p, loginId: e.target.value }))}
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
            <p className="muted">
              <Link to="/forgot-password">Forget Password ?</Link> | <Link to="/signup">Sign Up</Link>
            </p>
          </form>

          {error && <p className="error-message">{error}</p>}
        </section>
      </div>
    </div>
  );
}
