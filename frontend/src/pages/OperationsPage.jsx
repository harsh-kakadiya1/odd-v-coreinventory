import { useEffect, useState } from 'react';
import api from '../api';

const operationTypes = ['receipt', 'delivery', 'internal', 'adjustment'];

const initialOperation = {
  operationType: 'receipt',
  status: 'draft',
  referenceCode: '',
  supplierName: '',
  customerName: '',
  fromLocationId: '',
  toLocationId: '',
  scheduledAt: '',
  lines: [{ productId: '', quantity: 1 }],
};

export default function OperationsPage() {
  const [operations, setOperations] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(initialOperation);
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    try {
      const [opsRes, productsRes, locationsRes] = await Promise.all([
        api.get('/operations'),
        api.get('/products'),
        api.get('/locations'),
      ]);
      setOperations(opsRes.data);
      setProducts(productsRes.data);
      setLocations(locationsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load operations.');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { productId: '', quantity: 1 }],
    }));
  };

  const updateLine = (index, field, value) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...prev, lines };
    });
  };

  const removeLine = (index) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  async function createOperation(event) {
    event.preventDefault();
    setError('');

    try {
      await api.post('/operations', {
        ...form,
        fromLocationId: form.fromLocationId ? Number(form.fromLocationId) : null,
        toLocationId: form.toLocationId ? Number(form.toLocationId) : null,
        lines: form.lines.map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
        })),
      });
      setForm(initialOperation);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create operation.');
    }
  }

  async function validateOperation(id) {
    setError('');
    try {
      await api.post(`/operations/${id}/validate`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to validate operation.');
    }
  }

  async function updateStatus(id, status) {
    setError('');
    try {
      await api.post(`/operations/${id}/status`, { status });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
    }
  }

  return (
    <section>
      <div className="header-row">
        <div>
          <h2>Operations</h2>
          <p className="muted">Receipts, deliveries, internal transfers, and stock adjustments.</p>
        </div>
        <button type="button" onClick={loadData}>
          Refresh
        </button>
      </div>

      <div className="page-two-column">
        <div className="page-left-stack">
          <form className="panel form-grid" onSubmit={createOperation}>
            <h3>Create Operation</h3>
            <label>
              Type
              <select
                value={form.operationType}
                onChange={(e) => setForm((p) => ({ ...p, operationType: e.target.value }))}
              >
                {operationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="waiting">Waiting</option>
                <option value="ready">Ready</option>
              </select>
            </label>
            <label>
              Reference Code
              <input
                value={form.referenceCode}
                onChange={(e) => setForm((p) => ({ ...p, referenceCode: e.target.value }))}
              />
            </label>
            <label>
              Supplier
              <input
                value={form.supplierName}
                onChange={(e) => setForm((p) => ({ ...p, supplierName: e.target.value }))}
              />
            </label>
            <label>
              Customer
              <input
                value={form.customerName}
                onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
              />
            </label>
            <label>
              From Location
              <select
                value={form.fromLocationId}
                onChange={(e) => setForm((p) => ({ ...p, fromLocationId: e.target.value }))}
              >
                <option value="">Select source</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.warehouse_name} / {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To Location
              <select
                value={form.toLocationId}
                onChange={(e) => setForm((p) => ({ ...p, toLocationId: e.target.value }))}
              >
                <option value="">Select destination</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.warehouse_name} / {loc.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Scheduled At
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((p) => ({ ...p, scheduledAt: e.target.value }))}
              />
            </label>

            <div className="line-box">
              <h4>Lines</h4>
              {form.lines.map((line, index) => (
                <div key={index} className="line-row">
                  <select
                    value={line.productId}
                    onChange={(e) => updateLine(index, 'productId', e.target.value)}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                    required
                  />
                  <button type="button" className="ghost" onClick={() => removeLine(index)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="ghost" onClick={addLine}>
                Add Line
              </button>
            </div>

            <button type="submit">Create Operation</button>
          </form>
        </div>

        <div className="page-right-stack">
          <section className="table-card">
            <h3>Operation Queue</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Qty</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {operations.length === 0 && (
                  <tr>
                    <td colSpan={7}>No operations found.</td>
                  </tr>
                )}
                {operations.map((row) => (
                  <tr key={row.id}>
                    <td>{row.reference_code || `OP-${row.id}`}</td>
                    <td>{row.operation_type}</td>
                    <td>{row.status}</td>
                    <td>{row.from_location_name || '-'}</td>
                    <td>{row.to_location_name || '-'}</td>
                    <td>{row.total_quantity}</td>
                    <td>
                      <div className="action-buttons">
                        {row.status !== 'done' && row.status !== 'canceled' && (
                          <button type="button" onClick={() => validateOperation(row.id)}>
                            Validate
                          </button>
                        )}
                        {row.status !== 'canceled' && (
                          <button type="button" className="ghost" onClick={() => updateStatus(row.id, 'canceled')}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
