// Pure calculations over the in-memory data. All amounts are integer centavos.
import { monthOf, shiftMonth } from './util.js';

export function accountBalances(accounts, txs) {
  const bal = {};
  for (const a of accounts) bal[a.id] = a.openingBalance || 0;
  const add = (id, n) => { if (id in bal) bal[id] += n; };
  for (const t of txs) {
    if (t.type === 'income') add(t.accountId, t.amount);
    else if (t.type === 'expense') add(t.accountId, -t.amount);
    else if (t.type === 'transfer') { add(t.accountId, -t.amount); add(t.toAccountId, t.amount); }
  }
  return bal;
}

export function monthTotals(txs, key) {
  let income = 0, expense = 0;
  for (const t of txs) {
    if (monthOf(t.date) !== key) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense };
}

export function expenseByCategory(txs, key) {
  const out = {};
  for (const t of txs) {
    if (t.type !== 'expense' || monthOf(t.date) !== key) continue;
    out[t.categoryId] = (out[t.categoryId] || 0) + t.amount;
  }
  return out;
}

export function monthlySeries(txs, endKey, count) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) keys.push(shiftMonth(endKey, -i));
  const map = Object.fromEntries(keys.map((k) => [k, { key: k, income: 0, expense: 0 }]));
  for (const t of txs) {
    const row = map[monthOf(t.date)];
    if (!row) continue;
    if (t.type === 'income') row.income += t.amount;
    else if (t.type === 'expense') row.expense += t.amount;
  }
  return keys.map((k) => map[k]);
}

export function budgetStatus(spent, limit) {
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
  return { pct, left: limit - spent, over: spent > limit };
}

export function sortTxs(list) {
  return [...list].sort((a, b) =>
    a.date === b.date ? (b.createdMs || 0) - (a.createdMs || 0) : a.date < b.date ? 1 : -1);
}
