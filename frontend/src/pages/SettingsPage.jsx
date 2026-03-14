import { useEffect, useState } from 'react';
import api from '../api';

export default function SettingsPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [warehouseName, setWarehouseName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationWarehouseId, setLocationWarehouseId] = useState('');
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    try {
      const [warehousesRes, locationsRes] = await Promise.all([api.get('/warehouses'), api.get('/locations')]);
      setWarehouses(warehousesRes.data);
      setLocations(locationsRes.data);
      if (!locationWarehouseId && warehousesRes.data.length) {
        setLocationWarehouseId(String(warehousesRes.data[0].id));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load settings.');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createWarehouse(event) {
    event.preventDefault();
    if (!warehouseName.trim()) return;

    setError('');
    try {
      await api.post('/warehouses', { name: warehouseName.trim() });
      setWarehouseName('');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create warehouse.');
    }
  }

  async function createLocation(event) {
    event.preventDefault();
    if (!locationName.trim() || !locationWarehouseId) return;

    setError('');
    try {
      await api.post('/locations', {
        name: locationName.trim(),
        warehouseId: Number(locationWarehouseId),
      });
      setLocationName('');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create location.');
    }
  }

  return (
    <section>
      <div className="header-row">
        <div>
          <h2>Settings</h2>
          <p className="muted">Configure warehouses and internal storage locations.</p>
        </div>
        <button type="button" onClick={loadData}>
          Refresh
        </button>
      </div>

      <div className="split-grid">
        <form className="panel form-grid" onSubmit={createWarehouse}>
          <h3>Warehouse</h3>
          <label>
            Warehouse Name
            <input value={warehouseName} onChange={(e) => setWarehouseName(e.target.value)} required />
          </label>
          <button type="submit">Create Warehouse</button>
        </form>

        <form className="panel form-grid" onSubmit={createLocation}>
          <h3>Location</h3>
          <label>
            Warehouse
            <select value={locationWarehouseId} onChange={(e) => setLocationWarehouseId(e.target.value)} required>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Location Name
            <input value={locationName} onChange={(e) => setLocationName(e.target.value)} required />
          </label>
          <button type="submit">Create Location</button>
        </form>
      </div>

      <div className="split-grid">
        <section className="table-card">
          <h3>Warehouses</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="table-card">
          <h3>Locations</h3>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Warehouse</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.warehouse_name}</td>
                  <td>{row.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
