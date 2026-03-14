import { useEffect, useState } from 'react';
import api from '../api';

const initialProduct = {
  name: '',
  sku: '',
  categoryId: '',
  unitOfMeasure: 'Unit',
  unitCost: 0,
  reorderLevel: 0,
  initialStock: 0,
  initialLocationId: '',
};

const initialAdjustment = {
  productId: '',
  locationId: '',
  delta: '',
  notes: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(initialProduct);
  const [adjustment, setAdjustment] = useState(initialAdjustment);
  const [categoryInput, setCategoryInput] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [openPanels, setOpenPanels] = useState({
    createProduct: false,
    createCategory: false,
    updateStock: false,
  });

  function togglePanel(panelKey) {
    setOpenPanels((prev) => ({ ...prev, [panelKey]: !prev[panelKey] }));
  }

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
    const timer = setTimeout(() => {
      loadData();
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

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
        unitCost: Number(form.unitCost || 0),
        initialStock: Number(form.initialStock || 0),
        initialLocationId: form.initialLocationId ? Number(form.initialLocationId) : undefined,
      });
      setForm(initialProduct);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create product.');
    }
  }

  async function adjustStock(event) {
    event.preventDefault();
    setError('');

    if (!adjustment.productId || !adjustment.locationId || !adjustment.delta) {
      setError('Please select product, location, and quantity delta.');
      return;
    }

    try {
      await api.post(`/products/${Number(adjustment.productId)}/adjust-stock`, {
        locationId: Number(adjustment.locationId),
        delta: Number(adjustment.delta),
        notes: adjustment.notes.trim() || null,
      });
      setAdjustment(initialAdjustment);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update stock.');
    }
  }

  return (
    <section>
      <div className="header-row">
        <div>
          <h2>Stock</h2>
          <p className="muted">Manage products, costs, available stock, and manual quantity updates.</p>
        </div>
        <button type="button" onClick={loadData}>
          Refresh
        </button>
      </div>

      <div className="page-two-column products-layout">
        <div className="page-left-stack">
          <form className="panel form-grid collapsible-panel" onSubmit={createProduct}>
            <div className="collapsible-head">
              <h3>Create Product</h3>
              <button
                type="button"
                className={`panel-toggle ${openPanels.createProduct ? 'open' : ''}`}
                onClick={() => togglePanel('createProduct')}
                aria-label={openPanels.createProduct ? 'Collapse Create Product' : 'Expand Create Product'}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {openPanels.createProduct && (
              <>
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
                  Per unit cost
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unitCost}
                    onChange={(e) => setForm((p) => ({ ...p, unitCost: e.target.value }))}
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
              </>
            )}
          </form>

          <section className="panel form-grid collapsible-panel">
            <div className="collapsible-head">
              <h3>Create Category</h3>
              <button
                type="button"
                className={`panel-toggle ${openPanels.createCategory ? 'open' : ''}`}
                onClick={() => togglePanel('createCategory')}
                aria-label={openPanels.createCategory ? 'Collapse Create Category' : 'Expand Create Category'}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {openPanels.createCategory && (
              <>
                <label>
                  Category name
                  <input value={categoryInput} onChange={(e) => setCategoryInput(e.target.value)} />
                </label>
                <button type="button" onClick={createCategory}>
                  Add Category
                </button>
              </>
            )}
          </section>

          <form className="panel form-grid collapsible-panel" onSubmit={adjustStock}>
            <div className="collapsible-head">
              <h3>Update Stock From Here</h3>
              <button
                type="button"
                className={`panel-toggle ${openPanels.updateStock ? 'open' : ''}`}
                onClick={() => togglePanel('updateStock')}
                aria-label={openPanels.updateStock ? 'Collapse Update Stock panel' : 'Expand Update Stock panel'}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {openPanels.updateStock && (
              <>
                <label>
                  Product
                  <select
                    value={adjustment.productId}
                    onChange={(e) => setAdjustment((p) => ({ ...p, productId: e.target.value }))}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <select
                    value={adjustment.locationId}
                    onChange={(e) => setAdjustment((p) => ({ ...p, locationId: e.target.value }))}
                    required
                  >
                    <option value="">Select location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.warehouse_name} / {loc.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity delta (+/-)
                  <input
                    type="number"
                    step="0.01"
                    value={adjustment.delta}
                    onChange={(e) => setAdjustment((p) => ({ ...p, delta: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Note
                  <input
                    value={adjustment.notes}
                    onChange={(e) => setAdjustment((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Manual cycle count"
                  />
                </label>
                <button type="submit">Apply Adjustment</button>
              </>
            )}
          </form>
        </div>

        <div className="page-right-stack">
          <section className="table-card">
            <h3>Stock Table</h3>
            <div className="stock-search">
              <label>
                Search SKU/Product
                <input value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Per Unit Cost</th>
                  <th>On Hand</th>
                  <th>Free to Use</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={5}>No products found.</td>
                  </tr>
                )}
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {product.name}
                      <div className="table-sub">{product.sku}</div>
                    </td>
                    <td>{Number(product.per_unit_cost || 0)} Rs</td>
                    <td>{Number(product.on_hand || product.total_stock || 0)}</td>
                    <td>{Number(product.free_to_use || product.total_stock || 0)}</td>
                    <td>{product.category_name || 'Uncategorized'}</td>
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
