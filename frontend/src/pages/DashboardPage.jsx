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
  });
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

  useEffect(() => {
    loadData();
  }, [filters.documentType, filters.status]);

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
    <section>
      <div className="header-row">
        <div>
          <h2>Inventory Dashboard</h2>
          <p className="muted">Live stock overview with operation status snapshots.</p>
        </div>
        <button onClick={loadData} type="button">
          Refresh
        </button>
      </div>

      <div className="filters">
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
      </div>

      <div className="kpi-grid">
        {cards.map((card) => (
          <article key={card.title} className="card">
            <p>{card.title}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <section className="table-card">
        <h3>Recent Operations</h3>
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
                <td>{row.status}</td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
