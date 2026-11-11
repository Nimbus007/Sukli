// Data layer: live Firestore listeners + every write the app makes.
// Layout:  users/{uid}  (profile)
//            /accounts /transactions /budgets /goals /recurring
// Money is always integer centavos in PHP. There is no currency field anywhere.
import {
  db, collection, doc, onSnapshot, query, orderBy, getDoc, setDoc, addDoc, updateDoc,
  deleteDoc, deleteField, writeBatch, serverTimestamp, getDocs,
} from './firebase.js';
import { DEFAULT_ACCOUNTS } from './categories.js';
import { nextOccurrence, todayStr, friendlyError, parseDate } from './util.js';
import { sortTxs } from './calc.js';

export const state = {
  user: null,
  profile: null,
  accounts: [],
  txs: [],
  budgets: {}, // categoryId -> limit (centavos)
  goals: [],
  recurring: [],
};

const COLLECTIONS = ['accounts', 'transactions', 'budgets', 'goals', 'recurring'];
const loaded = new Set();
let unsubs = [];
let listeners = new Set();
let recurringRan = false;
let errorHandler = () => {};

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const onSyncError = (fn) => { errorHandler = fn; };
export const isReady = () => loaded.size >= COLLECTIONS.length + 1;
const emit = () => listeners.forEach((fn) => fn());

const uid = () => state.user.uid;
const userDoc = () => doc(db, 'users', uid());
const col = (name) => collection(db, 'users', uid(), name);

const read = (snapDoc) => ({ id: snapDoc.id, ...snapDoc.data({ serverTimestamps: 'estimate' }) });
const ms = (ts) => (ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now());

export function startSync(user) {
  stopSync();
  state.user = user;
  recurringRan = false;

  const fail = (err) => { console.error(err); errorHandler(friendlyError(err)); };
  const watch = (name, q, apply) =>
    unsubs.push(onSnapshot(q, (snap) => { apply(snap); loaded.add(name); emit(); }, fail));

  watch('profile', userDoc(), (snap) => { state.profile = snap.exists() ? read(snap) : null; });
  watch('accounts', query(col('accounts'), orderBy('order')), (snap) => {
    state.accounts = snap.docs.map(read);
  });
  watch('transactions', query(col('transactions'), orderBy('date', 'desc')), (snap) => {
    state.txs = sortTxs(snap.docs.map((d) => {
      const t = read(d);
      return { ...t, createdMs: ms(t.createdAt) };
    }));
    maybeRunRecurring();
  });
  watch('budgets', col('budgets'), (snap) => {
    state.budgets = Object.fromEntries(snap.docs.map((d) => [d.id, d.data().limit]));
  });
  watch('goals', query(col('goals'), orderBy('createdAt')), (snap) => {
    state.goals = snap.docs.map(read);
  });
  watch('recurring', query(col('recurring'), orderBy('createdAt')), (snap) => {
    state.recurring = snap.docs.map(read);
    maybeRunRecurring();
  });

  ensureProfile(user).catch(fail);
}

export function stopSync() {
  unsubs.forEach((u) => u());
  unsubs = [];
  loaded.clear();
  Object.assign(state, {
    user: null, profile: null, accounts: [], txs: [], budgets: {}, goals: [], recurring: [],
  });
}

/** First sign-in: create the profile and starter accounts. Fixed ids make this safe to repeat. */
async function ensureProfile(user) {
  const snap = await getDoc(userDoc());
  if (snap.exists()) return;
  const batch = writeBatch(db);
  batch.set(userDoc(), { name: (user.displayName || '').slice(0, 80), createdAt: serverTimestamp() });
  DEFAULT_ACCOUNTS.forEach((a, i) => {
    batch.set(doc(col('accounts'), a.id), {
      name: a.name, type: a.type, openingBalance: 0, order: i, createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

// ---------- Profile ----------
export const saveName = (name) =>
  updateDoc(userDoc(), { name: name.trim().slice(0, 80), updatedAt: serverTimestamp() });

// ---------- Transactions ----------
export function saveTransaction(t, id) {
  const base = { type: t.type, amount: t.amount, date: t.date, accountId: t.accountId };
  if (id) {
    return updateDoc(doc(col('transactions'), id), {
      ...base,
      categoryId: t.type === 'transfer' ? deleteField() : t.categoryId,
      toAccountId: t.type === 'transfer' ? t.toAccountId : deleteField(),
      note: t.note ? t.note : deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
  const payload = { ...base, createdAt: serverTimestamp() };
  if (t.type === 'transfer') payload.toAccountId = t.toAccountId;
  else payload.categoryId = t.categoryId;
  if (t.note) payload.note = t.note;
  return addDoc(col('transactions'), payload);
}
export const deleteTransaction = (id) => deleteDoc(doc(col('transactions'), id));

// ---------- Accounts ----------
export function saveAccount(a, id) {
  if (id) {
    return updateDoc(doc(col('accounts'), id), {
      name: a.name, type: a.type, openingBalance: a.openingBalance, updatedAt: serverTimestamp(),
    });
  }
  const order = state.accounts.reduce((m, x) => Math.max(m, x.order ?? 0), -1) + 1;
  return addDoc(col('accounts'), {
    name: a.name, type: a.type, openingBalance: a.openingBalance, order, createdAt: serverTimestamp(),
  });
}

/** Returns a reason string if the account is still in use, otherwise deletes it. */
export async function deleteAccount(id) {
  const used = state.txs.some((t) => t.accountId === id || t.toAccountId === id)
    || state.recurring.some((r) => r.accountId === id);
  if (used) return 'This account has transactions or a recurring item. Edit or delete those first.';
  if (state.accounts.length <= 1) return 'Keep at least one account.';
  await deleteDoc(doc(col('accounts'), id));
  return null;
}

// ---------- Budgets (one monthly limit per expense category) ----------
export const saveBudget = (categoryId, limit) =>
  setDoc(doc(col('budgets'), categoryId), { categoryId, limit, updatedAt: serverTimestamp() });
export const deleteBudget = (categoryId) => deleteDoc(doc(col('budgets'), categoryId));

// ---------- Goals ----------
export function saveGoal(g, id) {
  if (id) {
    return updateDoc(doc(col('goals'), id), {
      name: g.name, target: g.target,
      deadline: g.deadline ? g.deadline : deleteField(),
      updatedAt: serverTimestamp(),
    });
  }
  const payload = {
    name: g.name, target: g.target, saved: g.saved || 0,
    log: g.saved ? [{ a: g.saved, d: todayStr() }] : [], createdAt: serverTimestamp(),
  };
  if (g.deadline) payload.deadline = g.deadline;
  return addDoc(col('goals'), payload);
}

/** amount is positive to add money, negative to withdraw. Goals track progress only; they do not move account money. */
export function goalMoney(goal, amount) {
  const saved = Math.max(0, goal.saved + amount);
  const log = [...(goal.log || []), { a: amount, d: todayStr() }].slice(-30);
  return updateDoc(doc(col('goals'), goal.id), { saved, log, updatedAt: serverTimestamp() });
}
export const deleteGoal = (id) => deleteDoc(doc(col('goals'), id));

// ---------- Recurring ----------
export function saveRecurring(r, id) {
  const anchorDay = parseDate(r.nextDate).getDate();
  const fields = {
    title: r.title, type: r.type, amount: r.amount, categoryId: r.categoryId,
    accountId: r.accountId, frequency: r.frequency, nextDate: r.nextDate, anchorDay,
  };
  if (id) return updateDoc(doc(col('recurring'), id), { ...fields, updatedAt: serverTimestamp() });
  return addDoc(col('recurring'), { ...fields, active: true, createdAt: serverTimestamp() });
}
export const setRecurringActive = (id, active) =>
  updateDoc(doc(col('recurring'), id), { active, updatedAt: serverTimestamp() });
export const deleteRecurring = (id) => deleteDoc(doc(col('recurring'), id));

/**
 * Creates the transactions that came due while the app was closed. Ids are `${recurringId}_${date}`
 * so running this twice (two tabs, two devices) can never create duplicates.
 */
function maybeRunRecurring() {
  if (recurringRan || !loaded.has('transactions') || !loaded.has('recurring')) return;
  recurringRan = true;
  processRecurring().catch((err) => { console.error(err); errorHandler(friendlyError(err)); });
}

async function processRecurring() {
  const today = todayStr();
  for (const r of state.recurring) {
    if (!r.active || r.nextDate > today) continue;
    const batch = writeBatch(db);
    let next = r.nextDate;
    let count = 0;
    while (next <= today && count < 60) {
      batch.set(doc(col('transactions'), `${r.id}_${next}`), {
        type: r.type, amount: r.amount, date: next, categoryId: r.categoryId,
        accountId: r.accountId, note: r.title, recurringId: r.id, createdAt: serverTimestamp(),
      });
      next = nextOccurrence(next, r.frequency, r.anchorDay);
      count += 1;
    }
    batch.update(doc(col('recurring'), r.id), { nextDate: next, updatedAt: serverTimestamp() });
    await batch.commit();
  }
}

// ---------- Export / wipe ----------
export function transactionsCsv() {
  const acct = (id) => state.accounts.find((a) => a.id === id)?.name || '';
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Date', 'Type', 'Category', 'Account', 'To account', 'Amount (PHP)', 'Note']];
  for (const t of [...state.txs].reverse()) {
    rows.push([
      t.date, t.type, t.categoryId || '', acct(t.accountId), acct(t.toAccountId),
      (t.amount / 100).toFixed(2), t.note || '',
    ]);
  }
  return '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Deletes every document the user owns, in batches of 400. The Firebase sign-in itself stays. */
export async function deleteAllData() {
  for (const name of COLLECTIONS) {
    const snap = await getDocs(col(name));
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(userDoc());
  recurringRan = false;
  await ensureProfile(state.user);
}
