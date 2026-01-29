import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recipesApi } from '../lib/api';
import { Plus, Trash2, X, Loader2, Search, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Recipes() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    yield_qty: '',
    yield_unit: 'portion',
    selling_price: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: recipesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setShowModal(false);
      setFormData({ name: '', description: '', yield_qty: '', yield_unit: 'portion', selling_price: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: recipesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      yield_qty: parseFloat(formData.yield_qty),
      selling_price: formData.selling_price ? parseFloat(formData.selling_price) : undefined,
    } as any);
  };

  const filteredRecipes = data?.data.items.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const getFoodCostColor = (pct: number) => {
    if (pct > 35) return 'text-red-600 bg-red-50';
    if (pct > 30) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-gray-500">Manage your recipes and calculate costs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          New Recipe
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {/* Recipe Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <p className="text-gray-500 mb-4">No recipes found. Create your first recipe to get started.</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-600 hover:underline font-medium"
          >
            Create Recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecipes.map((recipe) => {
            const foodCostPct = parseFloat(recipe.food_cost_pct || '0');
            return (
              <div
                key={recipe.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link to={`/recipes/${recipe.id}`} className="block p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">{recipe.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getFoodCostColor(foodCostPct)}`}>
                      {foodCostPct.toFixed(1)}%
                    </span>
                  </div>
                  
                  {recipe.description && (
                    <p className="text-gray-500 text-sm mb-4 line-clamp-2">{recipe.description}</p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Cost/Portion</p>
                      <p className="font-semibold text-gray-900">
                        ${parseFloat(recipe.cost_per_portion).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Cost</p>
                      <p className="font-semibold text-gray-900">
                        ${parseFloat(recipe.total_cost).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Yield</p>
                      <p className="font-semibold text-gray-900">
                        {parseFloat(recipe.yield_qty)} {recipe.yield_unit}
                      </p>
                    </div>
                    {recipe.selling_price && (
                      <div>
                        <p className="text-gray-500">Selling Price</p>
                        <p className="font-semibold text-gray-900">
                          ${parseFloat(recipe.selling_price).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{recipe.items.length} ingredients</span>
                    <span className="text-blue-600 flex items-center gap-1">
                      View details <ChevronRight size={16} />
                    </span>
                  </div>
                </Link>
                
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                  <button
                    onClick={() => {
                      if (confirm('Delete this recipe?')) {
                        deleteMutation.mutate(recipe.id);
                      }
                    }}
                    className="text-gray-400 hover:text-red-600 p-1"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">New Recipe</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yield Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.yield_qty}
                    onChange={(e) => setFormData({ ...formData, yield_qty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yield Unit *</label>
                  <select
                    value={formData.yield_unit}
                    onChange={(e) => setFormData({ ...formData, yield_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="portion">portion</option>
                    <option value="serving">serving</option>
                    <option value="batch">batch</option>
                    <option value="each">each</option>
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="For food cost % calculation"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="animate-spin" size={18} />}
                  Create Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
