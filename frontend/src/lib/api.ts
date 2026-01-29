import axios from 'axios';

const API_BASE = import.meta.env.PROD 
  ? 'https://bom-api.fly.dev' 
  : '';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add API key (session token) to requests
api.interceptors.request.use((config) => {
  const apiKey = localStorage.getItem('bom_api_key');
  if (apiKey) {
    config.headers['x-api-key'] = apiKey;
  }
  return config;
});

// Types
export interface Ingredient {
  id: number;
  name: string;
  description?: string;
  purchase_unit: string;
  purchase_qty: string;
  purchase_price: string;
  recipe_unit: string;
  conversion_factor: string;
  yield_percent: string;
  unit_cost: string;
  created_at: string;
}

export interface RecipeItem {
  id: number;
  ingredient_id?: number;
  sub_recipe_id?: number;
  ingredient_name?: string;
  sub_recipe_name?: string;
  quantity: string;
  unit: string;
  item_cost: string;
}

export interface Recipe {
  id: number;
  name: string;
  description?: string;
  yield_qty: string;
  yield_unit: string;
  selling_price?: string;
  target_cost_pct: string;
  items: RecipeItem[];
  total_cost: string;
  cost_per_portion: string;
  food_cost_pct: string;
  created_at: string;
}

export interface BOM {
  id: number;
  name: string;
  date: string;
  total_cost: string;
  ingredients: {
    ingredient_id: number;
    ingredient_name: string;
    total_qty: string;
    unit: string;
    unit_cost: string;
    line_cost: string;
  }[];
  created_at: string;
}

export interface LoginResponse {
  id: number;
  email: string;
  name?: string;
  is_admin: boolean;
  api_key: string;
}

export interface User {
  id: number;
  email: string;
  name?: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
}

// API Functions
export const authApi = {
  login: (email: string, password: string) => 
    api.post<LoginResponse>('/api/v1/users/login', { email, password }),
  me: () => api.get<User>('/api/v1/users/me'),
  createTenant: (email: string, name: string, password: string) =>
    api.post<User & { api_key: string }>('/api/v1/users', { email, name, password }),
  listTenants: () => api.get<User[]>('/api/v1/users'),
};

export const ingredientsApi = {
  list: () => api.get<{ items: Ingredient[]; total: number }>('/api/v1/ingredients'),
  get: (id: number) => api.get<Ingredient>(`/api/v1/ingredients/${id}`),
  create: (data: Partial<Ingredient>) => api.post<Ingredient>('/api/v1/ingredients', data),
  update: (id: number, data: Partial<Ingredient>) => api.patch<Ingredient>(`/api/v1/ingredients/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/ingredients/${id}`),
};

export const recipesApi = {
  list: () => api.get<{ items: Recipe[]; total: number }>('/api/v1/recipes'),
  get: (id: number) => api.get<Recipe>(`/api/v1/recipes/${id}`),
  create: (data: Partial<Recipe>) => api.post<Recipe>('/api/v1/recipes', data),
  update: (id: number, data: Partial<Recipe>) => api.patch<Recipe>(`/api/v1/recipes/${id}`, data),
  delete: (id: number) => api.delete(`/api/v1/recipes/${id}`),
  addItem: (recipeId: number, data: { ingredient_id?: number; sub_recipe_id?: number; quantity: number; unit: string }) =>
    api.post<RecipeItem>(`/api/v1/recipes/${recipeId}/items`, data),
  removeItem: (recipeId: number, itemId: number) => api.delete(`/api/v1/recipes/${recipeId}/items/${itemId}`),
};

export const bomApi = {
  list: () => api.get<{ items: BOM[]; total: number }>('/api/v1/bom'),
  get: (id: number) => api.get<BOM>(`/api/v1/bom/${id}`),
  generate: (data: { name: string; date: string; recipes: { recipe_id: number; portions: number }[] }) =>
    api.post<BOM>('/api/v1/bom/generate', data),
  delete: (id: number) => api.delete(`/api/v1/bom/${id}`),
};
