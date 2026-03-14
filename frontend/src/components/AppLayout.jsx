import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context';
import api from '../api';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/operations', label: 'Operations' },
  { to: '/products', label: 'Products' },
  { to: '/ledger', label: 'Move History' },
  { to: '/settings', label: 'Settings' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState(user);
  const [profileError, setProfileError] = useState('');
  const profileMenuRef = useRef(null);

  const profileInitial = useMemo(() => {
    const sourceName = profile?.full_name || profile?.fullName || profile?.email || 'U';
    return String(sourceName).trim().charAt(0).toUpperCase() || 'U';
  }, [profile?.email, profile?.fullName, profile?.full_name]);

  const profileMonogram = useMemo(() => {
    const sourceName = String(profile?.full_name || profile?.fullName || '').trim();
    if (!sourceName) {
      return profileInitial;
    }

    const parts = sourceName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
    }

    return sourceName.slice(0, 2).toUpperCase();
  }, [profile?.fullName, profile?.full_name, profileInitial]);

  async function loadProfile() {
    setProfileError('');
    try {
      const response = await api.get('/auth/me');
      setProfile((prev) => ({ ...prev, ...response.data }));
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to load profile details.');
    }
  }

  useEffect(() => {
    setProfile(user);
  }, [user]);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    loadProfile();

    function handleOutsideClick(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileOpen]);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand-wrap">
          <p className="eyebrow">CoreInventory</p>
          <h1 className="brand">Warehouse Control</h1>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <div className="profile-menu-wrap" ref={profileMenuRef}>
            <button
              type="button"
              className="profile-trigger"
              aria-haspopup="menu"
              aria-expanded={isProfileOpen}
              aria-label="Open profile menu"
              title="My Profile"
              onClick={() => setIsProfileOpen((prev) => !prev)}
            >
              <span className="profile-avatar" aria-hidden="true">
                <span className="profile-avatar-text">{profileMonogram}</span>
              </span>
            </button>

            {isProfileOpen && (
              <section className="profile-menu" role="menu" aria-label="Profile menu">
                <p className="profile-heading">My Profile</p>
                <div className="profile-details">
                  <p>
                    <span>Name</span>
                    <strong title={profile?.full_name || profile?.fullName || '-'}>{profile?.full_name || profile?.fullName || '-'}</strong>
                  </p>
                  <p>
                    <span>Login Id</span>
                    <strong title={profile?.login_id || profile?.loginId || '-'}>{profile?.login_id || profile?.loginId || '-'}</strong>
                  </p>
                  <p>
                    <span>Email</span>
                    <strong title={profile?.email || '-'}>{profile?.email || '-'}</strong>
                  </p>
                  <p>
                    <span>Role</span>
                    <strong title={profile?.role || '-'}>{profile?.role || '-'}</strong>
                  </p>
                  <p>
                    <span>Created</span>
                    <strong title={profile?.created_at ? new Date(profile.created_at).toLocaleString() : '-'}>
                      {profile?.created_at ? new Date(profile.created_at).toLocaleString() : '-'}
                    </strong>
                  </p>
                </div>

                <button type="button" className="ghost profile-logout" onClick={onLogout}>
                  Logout
                </button>

                {profileError && <p className="error-message">{profileError}</p>}
              </section>
            )}
          </div>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
