import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const statusColumns = ['draft', 'waiting', 'ready', 'done', 'canceled'];

export default function LedgerPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [filters, setFilters] = useState({ documentType: '', status: '', locationId: '', search: '' });
  const [viewMode, setViewMode] = useState('list');
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    try {
      const [operationsRes, locationsRes] = await Promise.all([
        api.get('/operations', {
          params: {
            documentType: filters.documentType || undefined,
            status: filters.status || undefined,
            locationId: filters.locationId || undefined,
            search: filters.search || undefined,
          },
        }),
        api.get('/locations'),
      ]);
      setRows(operationsRes.data);
      setLocations(locationsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load move history.');
    }
  }

  useEffect(() => {
    loadData();
  }, [filters.documentType, filters.status, filters.locationId, filters.search]);

  const groupedRows = useMemo(() => {
    const groups = {
      draft: [],
      waiting: [],
      ready: [],
      done: [],
      canceled: [],
    };

    for (const row of rows) {
      const key = groups[row.status] ? row.status : 'draft';
      groups[key].push(row);
    }

    return groups;
  }, [rows]);

  return (
    <section>
      <div className="header-row">
        <div>
          <h2>Move History</h2>
          <p className="muted">Default list view with search and kanban status view for inventory moves.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => navigate('/operations')}>
            New
          </button>
          <button type="button" className="ghost" onClick={loadData}>
            Refresh
          </button>
        </div>
      </div>

      <div className="filters">
        <label>
          Search Reference / Contact
          <input
            value={filters.search}
            placeholder="Reference code or contact"
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          />
        </label>
        <label>
          Document Type
          <select
            value={filters.documentType}
            onChange={(e) => setFilters((p) => ({ ...p, documentType: e.target.value }))}
          >
            <option value="">All</option>
            <option value="receipt">Receipt</option>
            <option value="delivery">Delivery</option>
            <option value="internal">Internal</option>
            <option value="adjustment">Adjustment</option>
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
          Location
          <select value={filters.locationId} onChange={(e) => setFilters((p) => ({ ...p, locationId: e.target.value }))}>
            <option value="">All</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.warehouse_name} / {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="view-toggle">
        <button
          type="button"
          className={viewMode === 'list' ? 'active' : 'ghost'}
          onClick={() => setViewMode('list')}
        >
          List View
        </button>
        <button
          type="button"
          className={viewMode === 'kanban' ? 'active' : 'ghost'}
          onClick={() => setViewMode('kanban')}
        >
          Kanban View
        </button>
      </div>

      {viewMode === 'list' && (
        <section className="table-card">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Contact</th>
                <th>From</th>
                <th>To</th>
                <th>Quantity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7}>No move records found.</td>
                </tr>
              )}
              {rows.map((row) => {
                const isOut = row.operation_type === 'delivery';
                return (
                  <tr key={row.id}>
                    <td>{row.reference_code || `OP-${row.id}`}</td>
                    <td>{new Date(row.created_at).toLocaleDateString()}</td>
                    <td>{row.contact_name || '-'}</td>
                    <td>{row.from_location_name || '-'}</td>
                    <td>{row.to_location_name || '-'}</td>
                    <td className={isOut ? 'qty-out' : 'qty-in'}>{row.total_quantity}</td>
                    <td>
                      <span className={`status-pill status-${row.status}`}>{row.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {viewMode === 'kanban' && (
        <section className="kanban-grid">
          {statusColumns.map((status) => (
            <article className="kanban-column" key={status}>
              <header>
                <h3>{status}</h3>
                <span>{groupedRows[status].length}</span>
              </header>

              <div className="kanban-list">
                {groupedRows[status].length === 0 && <p className="muted">No records</p>}
                {groupedRows[status].map((row) => (
                  <div key={row.id} className="kanban-card">
                    <strong>{row.reference_code || `OP-${row.id}`}</strong>
                    <p>{row.contact_name || 'No contact'}</p>
                    <p>
                      {row.from_location_name || '-'} to {row.to_location_name || '-'}
                    </p>
                    <p className={row.operation_type === 'delivery' ? 'qty-out' : 'qty-in'}>
                      Qty: {row.total_quantity}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
