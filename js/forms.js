// Dialog forms. Writes are not awaited: Firestore applies them locally at once (offline-first)
// and syncs in the background. A rejected write shows an error toast.
import * as data from './data.js';
import { state } from './data.js';
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoriesFor, categoryById, ACCOUNT_TYPES, FREQUENCIES,
} from './categories.js';
import {
  esc, parsePesos, pesosToInput, todayStr, isDateStr, friendlyError, money,
} from './util.js';
import { openSheet, closeSheet, confirmSheet, toast, $ } from './ui.js';

const fire = (promise, okMessage) => {
  Promise.resolve(promise)
    .then(() => okMessage && toast(okMessage))
    .catch((err) => { console.error(err); toast(friendlyError(err), 'error'); });
};

const options = (items, selected, label = (i) => i.name) =>
  items.map((i) => `<option value="${esc(i.id)}"${i.id === selected ? ' selected' : ''}>${esc(label(i))}</option>`).join('');

const amountField = (name, label, value, hint = '') => `
  <label class="field">
    <span>${label}</span>
    <div class="amt"><b aria-hidden="true">₱</b>
      <input name="${name}" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(value)}" required>
    </div>
    ${hint ? `<small class="muted">${hint}</small>` : ''}
  </label>`;

const setError = (form, msg) => { form.querySelector('.form-error').textContent = msg; };
const needAccounts = () => {
  if (state.accounts.length) return true;
  toast('Your accounts are still loading. Try again in a moment.', 'error');
  return false;
};

// ---------- Transaction ----------
export function openTransactionForm(tx) {
  if (!needAccounts()) return;
  const editing = Boolean(tx);
  const t = tx || { type: 'expense', amount: 0, date: todayStr(), categoryId: '', accountId: state.accounts[0].id, note: '' };
  const d = openSheet(`
    <form class="sheet-body" novalidate>
      <h2>${editing ? 'Edit transaction' : 'Add transaction'}</h2>
      <div class="seg" role="radiogroup" aria-label="Transaction type">
        ${['expense', 'income', 'transfer'].map((k) => `
          <label><input type="radio" name="type" value="${k}"${t.type === k ? ' checked' : ''}><span>${k === 'expense' ? 'Money out' : k === 'income' ? 'Money in' : 'Transfer'}</span></label>`).join('')}
      </div>
      ${amountField('amount', 'Amount', t.amount ? pesosToInput(t.amount) : '')}
      <label class="field" data-for="category"><span>Category</span><select name="categoryId"></select></label>
      <label class="field"><span data-from-label>Account</span>
        <select name="accountId">${options(state.accounts, t.accountId)}</select></label>
      <label class="field" data-for="transfer"><span>To account</span>
        <select name="toAccountId">${options(state.accounts, t.toAccountId || state.accounts.find((a) => a.id !== t.accountId)?.id)}</select></label>
      <label class="field"><span>Date</span><input type="date" name="date" value="${esc(t.date)}" required></label>
      <label class="field"><span>Note (optional)</span>
        <input name="note" maxlength="200" placeholder="Jeep fare, lunch, rent" value="${esc(t.note || '')}"></label>
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn primary" type="submit">Save</button>
        ${editing ? '<button class="btn danger-ghost" type="button" data-delete>Delete</button>' : ''}
        <button class="btn ghost" type="button" data-cancel>Cancel</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  const typeNow = () => form.elements.type.value;

  const syncType = () => {
    const type = typeNow();
    const isTransfer = type === 'transfer';
    form.querySelector('[data-for="category"]').hidden = isTransfer;
    form.querySelector('[data-for="transfer"]').hidden = !isTransfer;
    form.querySelector('[data-from-label]').textContent = isTransfer ? 'From account' : (type === 'income' ? 'Deposit to' : 'Paid from');
    if (!isTransfer) {
      const keep = categoriesFor(type).some((c) => c.id === form.elements.categoryId.value)
        ? form.elements.categoryId.value : (type === t.type ? t.categoryId : '');
      form.elements.categoryId.innerHTML = options(categoriesFor(type), keep, (c) => `${c.icon}  ${c.name}`);
    }
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'type') syncType(); });
  syncType();

  form.querySelector('[data-cancel]').onclick = closeSheet;
  const del = form.querySelector('[data-delete]');
  if (del) del.onclick = async () => {
    const ok = await confirmSheet({
      title: 'Delete this transaction?', message: `${money(t.amount)} will be removed from your records.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (ok) fire(data.deleteTransaction(tx.id), 'Deleted');
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = typeNow();
    const amount = parsePesos(form.elements.amount.value);
    if (!amount) return setError(form, 'Enter an amount greater than zero, like 250 or 1,250.50.');
    const date = form.elements.date.value;
    if (!isDateStr(date)) return setError(form, 'Pick a valid date.');
    const next = { type, amount, date, accountId: form.elements.accountId.value, note: form.elements.note.value.trim() };
    if (type === 'transfer') {
      next.toAccountId = form.elements.toAccountId.value;
      if (next.toAccountId === next.accountId) return setError(form, 'Choose two different accounts for a transfer.');
    } else {
      next.categoryId = form.elements.categoryId.value;
      if (!next.categoryId) return setError(form, 'Pick a category.');
    }
    fire(data.saveTransaction(next, tx?.id), 'Saved');
    closeSheet();
  });
}

// ---------- Account ----------
export function openAccountForm(account) {
  const editing = Boolean(account);
  const a = account || { name: '', type: 'cash', openingBalance: 0 };
  const d = openSheet(`
    <form class="sheet-body" novalidate>
      <h2>${editing ? 'Edit account' : 'Add account'}</h2>
      <label class="field"><span>Name</span><input name="name" maxlength="30" placeholder="GoTyme, BDO savings" value="${esc(a.name)}" required></label>
      <label class="field"><span>Type</span><select name="type">${options(ACCOUNT_TYPES, a.type, (t) => `${t.icon}  ${t.name}`)}</select></label>
      <label class="field"><span>Starting balance</span>
        <div class="amt"><b aria-hidden="true">₱</b>
          <input name="openingBalance" inputmode="decimal" autocomplete="off" value="${esc(pesosToInput(a.openingBalance))}"></div>
        <small class="muted">What was in this account before you started tracking. Use a minus sign for a negative balance.</small>
      </label>
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn primary" type="submit">Save</button>
        ${editing ? '<button class="btn danger-ghost" type="button" data-delete>Delete</button>' : ''}
        <button class="btn ghost" type="button" data-cancel>Cancel</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.querySelector('[data-cancel]').onclick = closeSheet;
  const del = form.querySelector('[data-delete]');
  if (del) del.onclick = async () => {
    const ok = await confirmSheet({ title: `Delete ${a.name}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      const reason = await data.deleteAccount(account.id);
      if (reason) toast(reason, 'error'); else toast('Deleted');
    } catch (err) { toast(friendlyError(err), 'error'); }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) return setError(form, 'Give the account a name.');
    const raw = form.elements.openingBalance.value.trim() || '0';
    const openingBalance = parsePesos(raw, { allowNegative: true });
    if (openingBalance === null) return setError(form, 'Enter the starting balance as a number, like 5,000.');
    fire(data.saveAccount({ name, type: form.elements.type.value, openingBalance }, account?.id), 'Saved');
    closeSheet();
  });
}

// ---------- Budget ----------
export function openBudgetForm(categoryId) {
  const cat = categoryById(categoryId);
  const current = state.budgets[categoryId] || 0;
  const d = openSheet(`
    <form class="sheet-body" novalidate>
      <h2>${cat.icon} ${esc(cat.name)} budget</h2>
      ${amountField('limit', 'Monthly limit', current ? pesosToInput(current) : '', 'This limit repeats every month.')}
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn primary" type="submit">Save limit</button>
        ${current ? '<button class="btn danger-ghost" type="button" data-delete>Remove limit</button>' : ''}
        <button class="btn ghost" type="button" data-cancel>Cancel</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.querySelector('[data-cancel]').onclick = closeSheet;
  const del = form.querySelector('[data-delete]');
  if (del) del.onclick = () => { fire(data.deleteBudget(categoryId), 'Limit removed'); closeSheet(); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const limit = parsePesos(form.elements.limit.value);
    if (!limit) return setError(form, 'Enter a limit greater than zero, like 5,000.');
    fire(data.saveBudget(categoryId, limit), 'Limit saved');
    closeSheet();
  });
}

// ---------- Goal ----------
export function openGoalForm(goal) {
  const editing = Boolean(goal);
  const g = goal || { name: '', target: 0, deadline: '' };
  const d = openSheet(`
    <form class="sheet-body" novalidate>
      <h2>${editing ? 'Edit goal' : 'New savings goal'}</h2>
      <label class="field"><span>What are you saving for?</span>
        <input name="name" maxlength="60" placeholder="Emergency fund, new phone, Christmas" value="${esc(g.name)}" required></label>
      ${amountField('target', 'Target amount', g.target ? pesosToInput(g.target) : '')}
      ${editing ? '' : amountField('saved', 'Already saved (optional)', '').replace(' required', '')}
      <label class="field"><span>Target date (optional)</span><input type="date" name="deadline" value="${esc(g.deadline || '')}"></label>
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn primary" type="submit">Save goal</button>
        ${editing ? '<button class="btn danger-ghost" type="button" data-delete>Delete</button>' : ''}
        <button class="btn ghost" type="button" data-cancel>Cancel</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.querySelector('[data-cancel]').onclick = closeSheet;
  const del = form.querySelector('[data-delete]');
  if (del) del.onclick = async () => {
    const ok = await confirmSheet({ title: `Delete "${g.name}"?`, message: 'The goal and its history will be removed.', confirmLabel: 'Delete', danger: true });
    if (ok) fire(data.deleteGoal(goal.id), 'Deleted');
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    const target = parsePesos(form.elements.target.value);
    if (!name) return setError(form, 'Name your goal.');
    if (!target) return setError(form, 'Enter a target amount greater than zero.');
    const deadline = form.elements.deadline.value;
    if (deadline && !isDateStr(deadline)) return setError(form, 'Pick a valid target date.');
    let saved = 0;
    if (!editing && form.elements.saved.value.trim()) {
      saved = parsePesos(form.elements.saved.value);
      if (saved === null) return setError(form, 'Enter the amount already saved as a number.');
    }
    fire(data.saveGoal({ name, target, saved, deadline }, goal?.id), 'Goal saved');
    closeSheet();
  });
}

export function openGoalMoneyForm(goal, mode) {
  const adding = mode === 'add';
  const d = openSheet(`
    <form class="sheet-body" novalidate>
      <h2>${adding ? 'Add to' : 'Withdraw from'} ${esc(goal.name)}</h2>
      <p class="muted">Saved so far: ${money(goal.saved)}. Goals track your progress and do not move money between accounts.</p>
      ${amountField('amount', 'Amount', '')}
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn primary" type="submit">${adding ? 'Add money' : 'Withdraw'}</button>
        <button class="btn ghost" type="button" data-cancel>Cancel</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.querySelector('[data-cancel]').onclick = closeSheet;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parsePesos(form.elements.amount.value);
    if (!amount) return setError(form, 'Enter an amount greater than zero.');
    if (!adding && amount > goal.saved) return setError(form, `You can withdraw up to ${money(goal.saved)}.`);
    fire(data.goalMoney(goal, adding ? amount : -amount), adding ? 'Added' : 'Withdrawn');
    closeSheet();
  });
}

// ---------- Recurring ----------
export function openRecurringForm(item) {
  if (!needAccounts()) return;
  const editing = Boolean(item);
  const r = item || { title: '', type: 'expense', amount: 0, categoryId: '', accountId: state.accounts[0].id, frequency: 'monthly', nextDate: todayStr() };
  const d = openSheet(`
    <form class="sheet-body" novalidate>
      <h2>${editing ? 'Edit recurring item' : 'Add recurring item'}</h2>
      <p class="muted">Rent, salary, subscriptions. Sukli adds the transaction for you when the date arrives.</p>
      <div class="seg" role="radiogroup" aria-label="Type">
        ${['expense', 'income'].map((k) => `<label><input type="radio" name="type" value="${k}"${r.type === k ? ' checked' : ''}><span>${k === 'expense' ? 'Money out' : 'Money in'}</span></label>`).join('')}
      </div>
      <label class="field"><span>Name</span><input name="title" maxlength="80" placeholder="Rent, Netflix, salary" value="${esc(r.title)}" required></label>
      ${amountField('amount', 'Amount', r.amount ? pesosToInput(r.amount) : '')}
      <label class="field"><span>Category</span><select name="categoryId"></select></label>
      <label class="field"><span>Account</span><select name="accountId">${options(state.accounts, r.accountId)}</select></label>
      <label class="field"><span>Repeats</span><select name="frequency">${options(FREQUENCIES, r.frequency)}</select></label>
      <label class="field"><span>Next date</span><input type="date" name="nextDate" value="${esc(r.nextDate)}" required></label>
      <p class="form-error" role="alert"></p>
      <div class="sheet-actions">
        <button class="btn primary" type="submit">Save</button>
        ${editing ? '<button class="btn danger-ghost" type="button" data-delete>Delete</button>' : ''}
        <button class="btn ghost" type="button" data-cancel>Cancel</button>
      </div>
    </form>`);
  const form = d.querySelector('form');
  const syncCats = () => {
    const type = form.elements.type.value;
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const keep = list.some((c) => c.id === form.elements.categoryId.value) ? form.elements.categoryId.value : r.categoryId;
    form.elements.categoryId.innerHTML = options(list, list.some((c) => c.id === keep) ? keep : list[0].id, (c) => `${c.icon}  ${c.name}`);
  };
  form.addEventListener('change', (e) => { if (e.target.name === 'type') syncCats(); });
  syncCats();
  form.querySelector('[data-cancel]').onclick = closeSheet;
  const del = form.querySelector('[data-delete]');
  if (del) del.onclick = async () => {
    const ok = await confirmSheet({ title: `Delete "${r.title}"?`, message: 'Past transactions stay. No new ones will be added.', confirmLabel: 'Delete', danger: true });
    if (ok) fire(data.deleteRecurring(item.id), 'Deleted');
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = form.elements.title.value.trim();
    const amount = parsePesos(form.elements.amount.value);
    const nextDate = form.elements.nextDate.value;
    if (!title) return setError(form, 'Give it a name.');
    if (!amount) return setError(form, 'Enter an amount greater than zero.');
    if (!isDateStr(nextDate)) return setError(form, 'Pick a valid date.');
    fire(data.saveRecurring({
      title, amount, nextDate, type: form.elements.type.value, categoryId: form.elements.categoryId.value,
      accountId: form.elements.accountId.value, frequency: form.elements.frequency.value,
    }, item?.id), 'Saved');
    closeSheet();
  });
}
