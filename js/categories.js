// Built-in categories. Colours follow the Philippine peso banknote palette where it makes sense.

export const EXPENSE_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#3E9B5F' },
  { id: 'eating', name: 'Eating out', icon: '🍜', color: '#E7792B' },
  { id: 'transport', name: 'Transport', icon: '🚌', color: '#2D6CC0' },
  { id: 'bills', name: 'Bills and utilities', icon: '💡', color: '#D9A514' },
  { id: 'load', name: 'Load and data', icon: '📱', color: '#7B4FB3' },
  { id: 'rent', name: 'Rent and housing', icon: '🏠', color: '#A0522D' },
  { id: 'health', name: 'Health', icon: '💊', color: '#D6453D' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#D94F8C' },
  { id: 'education', name: 'Education', icon: '🎓', color: '#1F8A99' },
  { id: 'family', name: 'Family and padala', icon: '🤝', color: '#8A6D3B' },
  { id: 'fun', name: 'Fun and hobbies', icon: '🎬', color: '#6C5CE7' },
  { id: 'other', name: 'Other', icon: '📦', color: '#6B7687' },
];

export const INCOME_CATEGORIES = [
  { id: 'salary', name: 'Salary', icon: '💼', color: '#1E7A4A' },
  { id: 'business', name: 'Business or sideline', icon: '🏪', color: '#2D6CC0' },
  { id: 'allowance', name: 'Allowance', icon: '🎒', color: '#7B4FB3' },
  { id: 'gift', name: 'Gift', icon: '🎁', color: '#D94F8C' },
  { id: 'other_income', name: 'Other income', icon: '💰', color: '#6B7687' },
];

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
const UNKNOWN = { id: 'unknown', name: 'Uncategorised', icon: '❔', color: '#6B7687' };

export const categoryById = (id) => ALL.find((c) => c.id === id) || UNKNOWN;
export const categoriesFor = (type) => (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);

export const ACCOUNT_TYPES = [
  { id: 'cash', name: 'Cash', icon: '💵' },
  { id: 'ewallet', name: 'E-wallet', icon: '📲' },
  { id: 'bank', name: 'Bank account', icon: '🏦' },
  { id: 'other', name: 'Other', icon: '👛' },
];
export const accountTypeById = (id) => ACCOUNT_TYPES.find((t) => t.id === id) || ACCOUNT_TYPES[3];

export const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: 'Cash', type: 'cash' },
  { id: 'gcash', name: 'GCash', type: 'ewallet' },
  { id: 'maya', name: 'Maya', type: 'ewallet' },
  { id: 'bank', name: 'Bank', type: 'bank' },
];

export const FREQUENCIES = [
  { id: 'weekly', name: 'Every week' },
  { id: 'biweekly', name: 'Every 2 weeks' },
  { id: 'monthly', name: 'Every month' },
];
