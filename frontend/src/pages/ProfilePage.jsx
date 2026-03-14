import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth-context';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(user);
  const [error, setError] = useState('');

  async function loadProfile() {
    setError('');
    try {
      const response = await api.get('/auth/me');
      setProfile(response.data);
      setUser(response.data);
      localStorage.setItem('coreinventory_user', JSON.stringify(response.data));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load profile.');
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <section>
      <div className="header-row">
        <div>
          <h2>My Profile</h2>
          <p className="muted">Account information and role details.</p>
        </div>
        <button type="button" onClick={loadProfile}>
          Refresh
        </button>
      </div>

      <div className="panel profile-panel">
        <p>
          <span>Name</span>
          <strong>{profile?.full_name || profile?.fullName || '-'}</strong>
        </p>
        <p>
          <span>Email</span>
          <strong>{profile?.email || '-'}</strong>
        </p>
        <p>
          <span>Role</span>
          <strong>{profile?.role || '-'}</strong>
        </p>
        <p>
          <span>Created</span>
          <strong>{profile?.created_at ? new Date(profile.created_at).toLocaleString() : '-'}</strong>
        </p>
      </div>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
