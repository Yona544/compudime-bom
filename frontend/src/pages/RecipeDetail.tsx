import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { recipesApi, ingredientsApi } from '../lib/api';
import { ArrowLeft, Plus, Trash2, X, Loader2, DollarSign, Percent, Scale } from 'lucide-react';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({
    ingredient_id: '',
    quantity: '',
    unit: '',
  });

  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipesApi.get(Number(id)),
    enabled: !!id,
  });

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => ingredientsApi.list(),
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { ingredient_id: number; quantity: number; unit: string }) =>
      recipesApi.addItem(Number(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setShowAddItem(false);
      setItemForm({ ingredient_id: '', quantity: '', unit: '' });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: number) => recipesApi.removeItem(Number(id), itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => recipesApi.delete(Number(id)),
    onSuccess: () => {
      navigate('/recipes');
    },
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    addItemMutation.mutate({
      ingredient_id: Number(itemForm.ingredient_id),
      quantity: Number(itemForm.quantity),
      unit: itemForm.unit,
    });
  };

  // When ingredient is selected, auto-fill unit
  const handleIngredientSelect = (ingredientId: string) => {
    setItemForm({ ...itemForm, ingredient_id: ingredientId });
    const ing = ingredients?.data.items.find(i => i.id === Number(ingredientId));
    if (ing) {
      setItemForm(prev => ({ ...prev, ingredient_id: ingredientId, unit: ing.recipe_unit }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!recipe?.data) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Recipe not found</p>
        <Link to="/recipes" className="text-blue-600 hover:underline">Back to recipes</Link>
      </div>
    );
  }

  const r = recipe.data;
  const foodCostPct = parseFloat(r.food_cost_pct || '0');

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/recipes" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft size={20} />
          Back to Recipes
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{r.name}</h1>
            {r.description && <p className="text-gray-500 mt-1">{r.description}</p>}
          </div>
          <button
            onClick={() => {
              if (confirm('Delete this recipe?')) deleteMutation.mutate();
            }}
            className="text-gray-400 hover:text-red-600 p-2"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <DollarSign size={20} />
            <span className="text-sm">Total Cost</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${parseFloat(r.total_cost).toFixed(2)}</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <DollarSign size={20} />
            <span className="text-sm">Cost per {r.yield_unit}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${parseFloat(r.cost_per_portion).toFixed(2)}</p>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <Scale size={20} />
            <span className="text-sm">Yield</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{parseFloat(r.yield_qty)} {r.yield_unit}</p>
        </div>
        
        <div className={`rounded-xl p-6 shadow-sm border ${
          foodCostPct > 35 ? 'bg-red-50 border-red-200' : 
          foodCostPct > 30 ? 'bg-yellow-50 border-yellow-200' : 
          'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-center gap-3 text-gray-500 mb-2">
            <Percent size={20} />
            <span className="text-sm">Food Cost %</span>
          </div>
          <p className={`text-2xl font-bold ${
            foodCostPct > 35 ? 'text-red-600' : 
            foodCostPct > 30 ? 'text-yellow-600' : 
            'text-green-600'
          }`}>
            {foodCostPct.toFixed(1)}%
          </p>
          {r.selling_price && (
            <p className="text-sm text-gray-500 mt-1">Sells for ${parseFloat(r.selling_price).toFixed(2)}</p>
          )}
        </div>
      </div>

      {/* Ingredients Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus size={18} />
            Add Ingredient
          </button>
        </div>

        {r.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No ingredients yet. Add ingredients to calculate recipe cost.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ingredient</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Line Cost</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {r.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {item.ingredient_name || item.sub_recipe_name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {parseFloat(item.quantity).toFixed(2)} {item.unit}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    ${(parseFloat(item.item_cost) / parseFloat(item.quantity)).toFixed(4)}/{item.unit}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    ${parseFloat(item.item_cost).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => removeItemMutation.mutate(item.id)}
                      className="text-gray-400 hover:text-red-600 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={3} className="px-6 py-4 text-right text-gray-700">Total:</td>
                <td className="px-6 py-4 text-gray-900">${parseFloat(r.total_cost).toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Add Ingredient</h2>
              <button onClick={() => setShowAddItem(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient *</label>
                <select
                  value={itemForm.ingredient_id}
                  onChange={(e) => handleIngredientSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">Select ingredient...</option>
                  {ingredients?.data.items.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} (${parseFloat(ing.unit_cost).toFixed(4)}/{ing.recipe_unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <input
                    type="text"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addItemMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addItemMutation.isPending && <Loader2 className="animate-spin" size={18} />}
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
