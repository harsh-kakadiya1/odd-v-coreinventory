import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/operations', label: 'Operations' },
  { to: '/products', label: 'Products' },
  { to: '/ledger', label: 'Move History' },
  { to: '/settings', label: 'Settings' },
  { to: '/profile', label: 'My Profile' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
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

        <div className="sidebar-user">
          <p>{user?.full_name || user?.fullName}</p>
          <span>{user?.role}</span>
          <button type="button" className="ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
