import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ingredientsApi, type Ingredient } from '../lib/api';
import { Plus, Pencil, Trash2, X, Loader2, Search } from 'lucide-react';

export default function Ingredients() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    purchase_unit: '',
    purchase_qty: '',
    purchase_price: '',
    recipe_unit: '',
    conversion_factor: '',
    yield_percent: '100',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => ingredientsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: ingredientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Ingredient> }) => ingredientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ingredientsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });

  const openModal = (ingredient?: Ingredient) => {
    if (ingredient) {
      setEditingId(ingredient.id);
      setFormData({
        name: ingredient.name,
        description: ingredient.description || '',
        purchase_unit: ingredient.purchase_unit,
        purchase_qty: ingredient.purchase_qty,
        purchase_price: ingredient.purchase_price,
        recipe_unit: ingredient.recipe_unit,
        conversion_factor: ingredient.conversion_factor,
        yield_percent: ingredient.yield_percent,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        purchase_unit: '',
        purchase_qty: '',
        purchase_price: '',
        recipe_unit: '',
        conversion_factor: '',
        yield_percent: '100',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      purchase_qty: parseFloat(formData.purchase_qty),
      purchase_price: parseFloat(formData.purchase_price),
      conversion_factor: parseFloat(formData.conversion_factor),
      yield_percent: parseFloat(formData.yield_percent),
    } as any;
    
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredIngredients = data?.data.items.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ingredients</h1>
          <p className="text-sm sm:text-base text-gray-500">Manage ingredient costs</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
        >
          <Plus size={20} />
          Add Ingredient
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4 sm:mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search ingredients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Mobile Cards / Desktop Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : filteredIngredients.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500">No ingredients found.</p>
        </div>
      ) : (
        <>
          {/* Mobile view - cards */}
          <div className="sm:hidden space-y-3">
            {filteredIngredients.map((ingredient) => (
              <div key={ingredient.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900">{ingredient.name}</h3>
                    {ingredient.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{ingredient.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openModal(ingredient)}
                      className="text-gray-400 hover:text-blue-600 p-1.5"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this ingredient?')) {
                          deleteMutation.mutate(ingredient.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 p-1.5"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Purchase:</span>
                    <span className="ml-1 text-gray-900">${parseFloat(ingredient.purchase_price).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Unit cost:</span>
                    <span className="ml-1 font-semibold text-gray-900">${parseFloat(ingredient.unit_cost).toFixed(4)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Recipe unit:</span>
                    <span className="ml-1 text-gray-900">{ingredient.recipe_unit}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Yield:</span>
                    <span className="ml-1 text-gray-900">{parseFloat(ingredient.yield_percent).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view - table */}
          <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Purchase</th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Recipe Unit</th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Cost</th>
                    <th className="text-left px-4 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Yield</th>
                    <th className="text-right px-4 lg:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredIngredients.map((ingredient) => (
                    <tr key={ingredient.id} className="hover:bg-gray-50">
                      <td className="px-4 lg:px-6 py-4">
                        <div className="font-medium text-gray-900">{ingredient.name}</div>
                        {ingredient.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{ingredient.description}</div>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        ${parseFloat(ingredient.purchase_price).toFixed(2)} / {parseFloat(ingredient.purchase_qty)} {ingredient.purchase_unit}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-gray-600">
                        {ingredient.recipe_unit}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">
                          ${parseFloat(ingredient.unit_cost).toFixed(4)}
                        </span>
                        <span className="text-gray-500 text-sm"> /{ingredient.recipe_unit}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-gray-600">
                        {parseFloat(ingredient.yield_percent).toFixed(0)}%
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openModal(ingredient)}
                          className="text-gray-400 hover:text-blue-600 p-1"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this ingredient?')) {
                              deleteMutation.mutate(ingredient.id);
                            }
                          }}
                          className="text-gray-400 hover:text-red-600 p-1 ml-2"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white">
              <h2 className="text-lg sm:text-xl font-semibold">
                {editingId ? 'Edit Ingredient' : 'Add Ingredient'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qty *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchase_qty}
                    onChange={(e) => setFormData({ ...formData, purchase_qty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <input
                    type="text"
                    value={formData.purchase_unit}
                    onChange={(e) => setFormData({ ...formData, purchase_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="lb, case"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Unit *</label>
                  <input
                    type="text"
                    value={formData.recipe_unit}
                    onChange={(e) => setFormData({ ...formData, recipe_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="oz, cup"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conversion *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.conversion_factor}
                    onChange={(e) => setFormData({ ...formData, conversion_factor: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Units per purchase"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yield %</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={formData.yield_percent}
                  onChange={(e) => setFormData({ ...formData, yield_percent: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="animate-spin" size={18} />
                  )}
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
