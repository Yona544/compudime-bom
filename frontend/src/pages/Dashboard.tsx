import { useQuery } from '@tanstack/react-query';
import { ingredientsApi, recipesApi, bomApi } from '../lib/api';
import { Package, ChefHat, ClipboardList, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => ingredientsApi.list(),
  });

  const { data: recipes } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => recipesApi.list(),
  });

  const { data: boms } = useQuery({
    queryKey: ['boms'],
    queryFn: () => bomApi.list(),
  });

  const stats = [
    {
      label: 'Ingredients',
      value: ingredients?.data.total || 0,
      icon: Package,
      color: 'bg-blue-500',
      link: '/ingredients',
    },
    {
      label: 'Recipes',
      value: recipes?.data.total || 0,
      icon: ChefHat,
      color: 'bg-green-500',
      link: '/recipes',
    },
    {
      label: 'BOMs',
      value: boms?.data.total || 0,
      icon: ClipboardList,
      color: 'bg-purple-500',
      link: '/bom',
    },
  ];

  // Calculate average food cost
  const avgFoodCost = recipes?.data.items.length
    ? recipes.data.items.reduce((sum, r) => sum + parseFloat(r.food_cost_pct || '0'), 0) / recipes.data.items.length
    : 0;

  // Find high cost recipes (>35%)
  const highCostRecipes = recipes?.data.items.filter(r => parseFloat(r.food_cost_pct || '0') > 35) || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-500">Overview of your recipe costs</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.link}
            className="bg-white rounded-xl p-3 sm:p-4 lg:p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
              <div className={`${stat.color} p-2 sm:p-3 rounded-lg`}>
                <stat.icon className="text-white" size={20} />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-xs sm:text-sm text-gray-500">{stat.label}</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Average Food Cost */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="text-blue-600" size={20} />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Avg Food Cost</h2>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl sm:text-4xl font-bold text-gray-900">{avgFoodCost.toFixed(1)}%</span>
            <span className="text-gray-500 mb-1 text-sm hidden sm:inline">across all recipes</span>
          </div>
          <div className="mt-4 bg-gray-100 rounded-full h-3">
            <div
              className={`h-full rounded-full ${avgFoodCost > 35 ? 'bg-red-500' : avgFoodCost > 30 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(avgFoodCost, 100)}%` }}
            />
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">
            Target: 28-32%
          </p>
        </div>

        {/* High Cost Alert */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-orange-500" size={20} />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">High Cost Recipes</h2>
          </div>
          {highCostRecipes.length === 0 ? (
            <p className="text-gray-500 text-sm">All recipes within target! 🎉</p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {highCostRecipes.slice(0, 5).map((recipe) => (
                <Link
                  key={recipe.id}
                  to={`/recipes/${recipe.id}`}
                  className="flex items-center justify-between p-2 sm:p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                >
                  <span className="font-medium text-gray-900 text-sm sm:text-base truncate mr-2">{recipe.name}</span>
                  <span className="text-orange-600 font-semibold text-sm whitespace-nowrap">
                    {parseFloat(recipe.food_cost_pct).toFixed(1)}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Recipes */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recent Recipes</h2>
            <Link to="/recipes" className="text-blue-600 text-xs sm:text-sm hover:underline">View all</Link>
          </div>
          {recipes?.data.items.length === 0 ? (
            <p className="text-gray-500 text-sm">No recipes yet. <Link to="/recipes" className="text-blue-600 hover:underline">Create one</Link></p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {recipes?.data.items.slice(0, 5).map((recipe) => (
                <Link
                  key={recipe.id}
                  to={`/recipes/${recipe.id}`}
                  className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <span className="font-medium text-gray-900 text-sm sm:text-base block truncate">{recipe.name}</span>
                    <p className="text-xs sm:text-sm text-gray-500">
                      ${parseFloat(recipe.cost_per_portion).toFixed(2)}/{recipe.yield_unit}
                    </p>
                  </div>
                  <span className={`font-semibold text-sm whitespace-nowrap ${parseFloat(recipe.food_cost_pct) > 35 ? 'text-red-600' : 'text-green-600'}`}>
                    {parseFloat(recipe.food_cost_pct).toFixed(1)}%
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link
              to="/ingredients"
              className="p-3 sm:p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center"
            >
              <Package className="mx-auto mb-1 sm:mb-2 text-blue-600" size={20} />
              <span className="text-xs sm:text-sm font-medium text-gray-900">Add Ingredient</span>
            </Link>
            <Link
              to="/recipes"
              className="p-3 sm:p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors text-center"
            >
              <ChefHat className="mx-auto mb-1 sm:mb-2 text-green-600" size={20} />
              <span className="text-xs sm:text-sm font-medium text-gray-900">New Recipe</span>
            </Link>
            <Link
              to="/bom"
              className="p-3 sm:p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-center"
            >
              <ClipboardList className="mx-auto mb-1 sm:mb-2 text-purple-600" size={20} />
              <span className="text-xs sm:text-sm font-medium text-gray-900">Generate BOM</span>
            </Link>
            <a
              href="https://bom-api.fly.dev/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-center"
            >
              <DollarSign className="mx-auto mb-1 sm:mb-2 text-gray-600" size={20} />
              <span className="text-xs sm:text-sm font-medium text-gray-900">API Docs</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
