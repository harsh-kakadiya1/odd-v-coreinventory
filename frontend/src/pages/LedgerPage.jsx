import { useEffect, useState } from 'react';
import api from '../api';

export default function LedgerPage() {
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ documentType: '', locationId: '', categoryId: '' });
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    try {
      const [ledgerRes, locationsRes, categoriesRes] = await Promise.all([
        api.get('/ledger', {
          params: {
            documentType: filters.documentType || undefined,
            locationId: filters.locationId || undefined,
            categoryId: filters.categoryId || undefined,
          },
        }),
        api.get('/locations'),
        api.get('/categories'),
      ]);
      setRows(ledgerRes.data);
      setLocations(locationsRes.data);
      setCategories(categoriesRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load move history.');
    }
  }

  useEffect(() => {
    loadData();
  }, [filters.documentType, filters.locationId, filters.categoryId]);

  return (
    <section>
      <div className="header-row">
        <div>
          <h2>Move History</h2>
          <p className="muted">All stock changes logged from receipts, deliveries, transfers, and adjustments.</p>
        </div>
        <button type="button" onClick={loadData}>
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
            <option value="receipt">Receipt</option>
            <option value="delivery">Delivery</option>
            <option value="internal">Internal</option>
            <option value="adjustment">Adjustment</option>
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
        <label>
          Product Category
          <select value={filters.categoryId} onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value }))}>
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="table-card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Product</th>
              <th>SKU</th>
              <th>From</th>
              <th>To</th>
              <th>Quantity</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>No ledger records found.</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>{row.move_type}</td>
                <td>{row.product_name}</td>
                <td>{row.sku}</td>
                <td>{row.from_location_name || '-'}</td>
                <td>{row.to_location_name || '-'}</td>
                <td>{row.quantity}</td>
                <td>{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
