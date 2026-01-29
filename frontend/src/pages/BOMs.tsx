import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bomApi, recipesApi } from '../lib/api';
import { Plus, Trash2, X, Loader2, ClipboardList, Calendar, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';

export default function BOMs() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    recipes: [{ recipe_id: '', portions: '' }],
  });

  const { data: boms, isLoading } = useQuery({
    queryKey: ['boms'],
    queryFn: () => bomApi.list(),
  });

  const { data: recipes } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipesApi.list(),
  });

  const generateMutation = useMutation({
    mutationFn: bomApi.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      setShowModal(false);
      setFormData({
        name: '',
        date: new Date().toISOString().split('T')[0],
        recipes: [{ recipe_id: '', portions: '' }],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: bomApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validRecipes = formData.recipes
      .filter(r => r.recipe_id && r.portions)
      .map(r => ({
        recipe_id: Number(r.recipe_id),
        portions: Number(r.portions),
      }));
    
    if (validRecipes.length === 0) return;
    
    generateMutation.mutate({
      name: formData.name,
      date: formData.date,
      recipes: validRecipes,
    });
  };

  const addRecipeRow = () => {
    setFormData({
      ...formData,
      recipes: [...formData.recipes, { recipe_id: '', portions: '' }],
    });
  };

  const removeRecipeRow = (index: number) => {
    setFormData({
      ...formData,
      recipes: formData.recipes.filter((_, i) => i !== index),
    });
  };

  const updateRecipeRow = (index: number, field: 'recipe_id' | 'portions', value: string) => {
    const newRecipes = [...formData.recipes];
    newRecipes[index][field] = value;
    setFormData({ ...formData, recipes: newRecipes });
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill of Materials</h1>
          <p className="text-gray-500">Generate shopping lists from your recipes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Generate BOM
        </button>
      </div>

      {/* BOM List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      ) : !boms?.data.items.length ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <ClipboardList className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 mb-4">No BOMs generated yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="text-blue-600 hover:underline font-medium"
          >
            Generate your first BOM
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {boms.data.items.map((bom) => (
            <div key={bom.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(expandedId === bom.id ? null : bom.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-purple-100 p-3 rounded-lg">
                      <ClipboardList className="text-purple-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{bom.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {bom.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign size={14} />
                          ${parseFloat(bom.total_cost).toFixed(2)} total
                        </span>
                        <span>{bom.ingredients.length} items</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this BOM?')) {
                          deleteMutation.mutate(bom.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 p-2"
                    >
                      <Trash2 size={18} />
                    </button>
                    {expandedId === bom.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {expandedId === bom.id && (
                <div className="border-t border-gray-100">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ingredient</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                        <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bom.ingredients.map((ing, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{ing.ingredient_name}</td>
                          <td className="px-6 py-4 text-gray-600">{parseFloat(ing.total_qty).toFixed(2)} {ing.unit}</td>
                          <td className="px-6 py-4 text-gray-600">${parseFloat(ing.unit_cost).toFixed(4)}/{ing.unit}</td>
                          <td className="px-6 py-4 font-semibold text-gray-900">${parseFloat(ing.line_cost).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-semibold">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-right text-gray-700">Total:</td>
                        <td className="px-6 py-4 text-gray-900">${parseFloat(bom.total_cost).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generate Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold">Generate Bill of Materials</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BOM Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Monday Prep"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recipes & Portions *</label>
                <div className="space-y-2">
                  {formData.recipes.map((row, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        value={row.recipe_id}
                        onChange={(e) => updateRecipeRow(index, 'recipe_id', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select recipe...</option>
                        {recipes?.data.items.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({parseFloat(r.yield_qty)} {r.yield_unit})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Portions"
                        value={row.portions}
                        onChange={(e) => updateRecipeRow(index, 'portions', e.target.value)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      {formData.recipes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRecipeRow(index)}
                          className="text-gray-400 hover:text-red-600 p-2"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addRecipeRow}
                  className="mt-2 text-blue-600 hover:underline text-sm flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add another recipe
                </button>
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
                  disabled={generateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generateMutation.isPending && <Loader2 className="animate-spin" size={18} />}
                  Generate BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
