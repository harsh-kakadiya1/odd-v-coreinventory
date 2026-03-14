import { useEffect, useState } from 'react';
import api from '../api';

const initialProduct = {
  name: '',
  sku: '',
  categoryId: '',
  unitOfMeasure: 'Unit',
  reorderLevel: 0,
  initialStock: 0,
  initialLocationId: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(initialProduct);
  const [categoryInput, setCategoryInput] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  async function loadData() {
    setError('');
    try {
      const [productsRes, categoriesRes, locationsRes] = await Promise.all([
        api.get('/products', { params: { search } }),
        api.get('/categories'),
        api.get('/locations'),
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
      setLocations(locationsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products.');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createCategory() {
    if (!categoryInput.trim()) return;
    setError('');
    try {
      await api.post('/categories', { name: categoryInput.trim() });
      setCategoryInput('');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create category.');
    }
  }

  async function createProduct(event) {
    event.preventDefault();
    setError('');

    try {
      await api.post('/products', {
        ...form,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        reorderLevel: Number(form.reorderLevel || 0),
        initialStock: Number(form.initialStock || 0),
        initialLocationId: form.initialLocationId ? Number(form.initialLocationId) : undefined,
      });
      setForm(initialProduct);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create product.');
    }
  }

  return (
    <section>
      <div className="header-row">
        <div>
          <h2>Products</h2>
          <p className="muted">Manage SKUs, categories, units, reorder levels, and opening stock.</p>
        </div>
        <button type="button" onClick={loadData}>
          Refresh
        </button>
      </div>

      <div className="split-grid">
        <form className="panel form-grid" onSubmit={createProduct}>
          <h3>Create Product</h3>
          <label>
            Product name
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          </label>
          <label>
            SKU / Code
            <input value={form.sku} onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))} required />
          </label>
          <label>
            Category
            <select
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
            >
              <option value="">Uncategorized</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unit of measure
            <input
              value={form.unitOfMeasure}
              onChange={(e) => setForm((p) => ({ ...p, unitOfMeasure: e.target.value }))}
              required
            />
          </label>
          <label>
            Reorder level
            <input
              type="number"
              step="0.01"
              value={form.reorderLevel}
              onChange={(e) => setForm((p) => ({ ...p, reorderLevel: e.target.value }))}
            />
          </label>
          <label>
            Initial stock (optional)
            <input
              type="number"
              step="0.01"
              value={form.initialStock}
              onChange={(e) => setForm((p) => ({ ...p, initialStock: e.target.value }))}
            />
          </label>
          <label>
            Initial location (optional)
            <select
              value={form.initialLocationId}
              onChange={(e) => setForm((p) => ({ ...p, initialLocationId: e.target.value }))}
            >
              <option value="">Select location</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.warehouse_name} / {loc.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create Product</button>
        </form>

        <div className="panel form-grid">
          <h3>Create Category</h3>
          <label>
            Category name
            <input value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} />
          </label>
          <button type="button" onClick={createCategory}>
            Add Category
          </button>
          <label>
            Search SKU/Product
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button type="button" className="ghost" onClick={loadData}>
            Search
          </button>
        </div>
      </div>

      <section className="table-card">
        <h3>Product Catalog</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>UoM</th>
              <th>Reorder Level</th>
              <th>Total Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={6}>No products found.</td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.sku}</td>
                <td>{product.category_name || 'Uncategorized'}</td>
                <td>{product.unit_of_measure}</td>
                <td>{product.reorder_level}</td>
                <td>{product.total_stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
