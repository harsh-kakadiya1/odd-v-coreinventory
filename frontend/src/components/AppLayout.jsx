import { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState(user);
  const menuRef = useRef(null);

  async function loadProfile() {
    try {
      const response = await api.get('/auth/me');
      setProfile(response.data);
    } catch {
      setProfile(user);
    }
  }

  useEffect(() => {
    setProfile(user);
  }, [user]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleProfileMenu = async () => {
    const nextOpen = !menuOpen;
    setMenuOpen(nextOpen);
    if (nextOpen) {
      await loadProfile();
    }
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
          <div className="profile-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="profile-trigger"
              onClick={toggleProfileMenu}
              aria-label="Open profile menu"
              aria-expanded={menuOpen}
            >
              <span>{(profile?.full_name || profile?.fullName || profile?.email || 'U').charAt(0).toUpperCase()}</span>
            </button>

            {menuOpen && (
              <div className="profile-menu panel">
                <h3>My Profile</h3>
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
                <button type="button" className="ghost" onClick={onLogout}>
                  Logout
                </button>
              </div>
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
