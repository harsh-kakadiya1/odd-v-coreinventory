import { useEffect, useMemo, useState } from 'react';
import api from '../api';

const defaultKpis = {
  total_products_in_stock: 0,
  low_stock_items: 0,
  out_of_stock_items: 0,
  pending_receipts: 0,
  pending_deliveries: 0,
  internal_transfers_scheduled: 0,
  recentOperations: [],
};

export default function DashboardPage() {
  const [kpis, setKpis] = useState(defaultKpis);
  const [filters, setFilters] = useState({
    documentType: '',
    status: '',
    warehouseId: '',
    locationId: '',
    categoryId: '',
  });
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    try {
      const response = await api.get('/dashboard/kpis', { params: filters });
      setKpis({ ...defaultKpis, ...response.data });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard.');
    }
  }

  async function loadLists() {
    try {
      const [catsRes, whRes, locRes] = await Promise.all([
        api.get('/categories'),
        api.get('/warehouses'),
        api.get('/locations'),
      ]);
      setCategories(catsRes.data || []);
      setWarehouses(whRes.data || []);
      setLocations(locRes.data || []);
    } catch (err) {
      // non-blocking: lists optional
    }
  }

  useEffect(() => {
    loadData();
  }, [filters.documentType, filters.status, filters.warehouseId, filters.locationId, filters.categoryId]);

  useEffect(() => {
    loadLists();
  }, []);

  const cards = useMemo(
    () => [
      { title: 'Total Products In Stock', value: Number(kpis.total_products_in_stock || 0) },
      { title: 'Low Stock Items', value: Number(kpis.low_stock_items || 0) },
      { title: 'Out of Stock Items', value: Number(kpis.out_of_stock_items || 0) },
      { title: 'Pending Receipts', value: Number(kpis.pending_receipts || 0) },
      { title: 'Pending Deliveries', value: Number(kpis.pending_deliveries || 0) },
      { title: 'Internal Transfers Scheduled', value: Number(kpis.internal_transfers_scheduled || 0) },
    ],
    [kpis]
  );

  return (
    <section className="dashboard-page">
      <div className="header-row">
        <div>
          <h2>Inventory Dashboard</h2>
          <p className="muted">Live stock overview with operation status snapshots.</p>
        </div>
        <button onClick={loadData} type="button">
          Refresh
        </button>
      </div>

      <div className="page-two-column">
        <div className="page-left-stack">
          <div className="filters dashboard-filters panel">
            <label>
              Document Type
              <select
                value={filters.documentType}
                onChange={(e) => setFilters((p) => ({ ...p, documentType: e.target.value }))}
              >
                <option value="">All</option>
                <option value="receipt">Receipts</option>
                <option value="delivery">Delivery</option>
                <option value="internal">Internal</option>
                <option value="adjustment">Adjustments</option>
              </select>
            </label>
            <label>
              Status
              <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="waiting">Waiting</option>
                <option value="ready">Ready</option>
                <option value="done">Done</option>
                <option value="canceled">Canceled</option>
              </select>
            </label>
            <label>
              Warehouse
              <select
                value={filters.warehouseId}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters((p) => ({ ...p, warehouseId: val, locationId: '' }));
                }}
              >
                <option value="">All</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Location
              <select
                value={filters.locationId}
                onChange={(e) => setFilters((p) => ({ ...p, locationId: e.target.value }))}
              >
                <option value="">All</option>
                {locations
                  .filter((l) => !filters.warehouseId || Number(l.warehouse_id) === Number(filters.warehouseId))
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.warehouse_name ? `${l.warehouse_name} / ${l.name}` : l.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="kpi-grid dashboard-kpi-grid">
            {cards.map((card) => (
              <article key={card.title} className="card kpi-card">
                <p className="kpi-title">{card.title}</p>
                <strong className="kpi-value">{card.value}</strong>
              </article>
            ))}
          </div>

          {kpis.low_stock_products && kpis.low_stock_products.length > 0 && (
            <section className="panel low-stock-panel">
              <h3>Low / Reorder Items</h3>
              <div className="low-stock-list">
                {kpis.low_stock_products.slice(0, 8).map((p) => (
                  <div key={p.id} className="low-stock-item">
                    <div>
                      <strong>{p.name}</strong>
                      <div className="table-sub">{p.sku} • On hand: {p.on_hand}</div>
                    </div>
                    <div className="low-stock-meta">
                      <span className="muted">Reorder @ {p.reorder_level}</span>
                    </div>
                  </div>
                ))}
                {kpis.low_stock_products.length > 8 && <div className="muted">And more…</div>}
              </div>
            </section>
          )}
        </div>

        <div className="page-right-stack">
          <section className="table-card dashboard-ops-card">
            <h3>Recent Operations</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.recentOperations.length === 0 && (
                    <tr>
                      <td colSpan={4}>No operations yet.</td>
                    </tr>
                  )}
                  {kpis.recentOperations.map((row) => (
                    <tr key={row.id}>
                      <td>{row.reference}</td>
                      <td>{row.operation_type}</td>
                      <td>
                        <span className={`status-pill status-${row.status}`}>{row.status}</span>
                      </td>
                      <td>{new Date(row.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
