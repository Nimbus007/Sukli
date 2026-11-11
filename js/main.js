import {
  auth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail, updateProfile,
} from './firebase.js';
import * as data from './data.js';
import { state } from './data.js';
import * as views from './views.js';
import { nav } from './views.js';
import * as forms from './forms.js';
import { $, $$, icons, toast, confirmSheet } from './ui.js';
import { esc, friendlyError, shiftMonth, monthOf, todayStr } from './util.js';

const root = document.getElementById('app');

const ROUTES = [
  { id: 'home', title: 'Home', icon: icons.home, view: views.homeView },
  { id: 'activity', title: 'Activity', icon: icons.list, view: views.activityView },
  { id: 'budgets', title: 'Budgets', icon: icons.budget, view: views.budgetsView },
  { id: 'goals', title: 'Goals', icon: icons.goal, view: views.goalsView },
  { id: 'reports', title: 'Reports', icon: icons.chart, view: views.reportsView },
  { id: 'settings', title: 'Settings', icon: icons.settings, view: views.settingsView },
];
const MAIN_TABS = ROUTES.filter((r) => r.id !== 'settings');

let shellReady = false;
let authMode = 'signin';

const currentRoute = () => {
  const id = (location.hash.replace(/^#\/?/, '') || 'home').split('?')[0];
  return ROUTES.find((r) => r.id === id) || ROUTES[0];
};

// ---------- Auth screen ----------
function renderAuth(message = '') {
  shellReady = false;
  const signup = authMode === 'signup';
  root.innerHTML = `
    <main class="auth">
      <section class="auth-brand">
        <div class="logo" aria-hidden="true">₱</div>
        <h1>Sukli</h1>
        <p>Know where every peso goes. Track spending, set monthly limits and save for what matters, all in Philippine pesos.</p>
        <div class="auth-notes" aria-hidden="true"><i class="n1"></i><i class="n2"></i><i class="n3"></i></div>
      </section>
      <section class="auth-panel">
        <h2>${signup ? 'Create your account' : 'Welcome back'}</h2>
        <form data-form="auth" novalidate>
          ${signup ? '<label class="field"><span>Name</span><input name="name" autocomplete="name" maxlength="80"></label>' : ''}
          <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
          <label class="field"><span>Password</span><input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="6"></label>
          <p class="form-error" role="alert">${esc(message)}</p>
          <button class="btn primary wide" type="submit">${signup ? 'Create account' : 'Sign in'}</button>
        </form>
        <button class="btn ghost wide" data-action="google">Continue with Google</button>
        <p class="auth-links">
          <button class="link" data-action="toggle-auth">${signup ? 'I already have an account' : 'Create an account'}</button>
          ${signup ? '' : '<button class="link" data-action="reset-password">Forgot password?</button>'}
        </p>
      </section>
    </main>`;
}

async function handleAuthSubmit(form) {
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const err = form.querySelector('.form-error');
  const btn = form.querySelector('button[type=submit]');
  if (!email || !password) { err.textContent = 'Enter your email and password.'; return; }
  btn.disabled = true;
  err.textContent = '';
  try {
    if (authMode === 'signup') {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const name = form.elements.name?.value.trim();
      if (name) { await updateProfile(cred.user, { displayName: name }); scheduleRender(); }
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (e) {
    err.textContent = friendlyError(e);
    btn.disabled = false;
  }
}

async function googleSignIn() {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { const el = $('.auth .form-error'); if (el) el.textContent = friendlyError(e); }
}

async function resetPassword() {
  const email = $('.auth input[name=email]')?.value.trim();
  const el = $('.auth .form-error');
  if (!email) { el.textContent = 'Type your email above, then choose Forgot password.'; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    el.textContent = '';
    toast('Password reset email sent. Check your inbox.');
  } catch (e) { el.textContent = friendlyError(e); }
}

// ---------- Shell ----------
function renderShell() {
  shellReady = true;
  root.innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="brand"><span class="logo sm" aria-hidden="true">₱</span><span>Sukli</span></div>
        <nav aria-label="Main">
          ${ROUTES.map((r) => `<a href="#/${r.id}" data-route="${r.id}">${r.icon}<span>${r.title}</span></a>`).join('')}
        </nav>
      </aside>
      <div class="main">
        <header class="top">
          <div class="brand mobile-only"><span class="logo sm" aria-hidden="true">₱</span></div>
          <h1 id="pageTitle"></h1>
          <div class="top-actions">
            <button class="btn primary desktop-only" data-action="add-tx">${icons.plus}<span>Add transaction</span></button>
            <button class="icon-btn add-mobile mobile-only" data-action="add-tx" aria-label="Add transaction">${icons.plus}</button>
            <a class="icon-btn mobile-only" href="#/settings" aria-label="Settings">${icons.settings}</a>
          </div>
        </header>
        <main id="view" tabindex="-1"></main>
      </div>
      <nav class="tabs" aria-label="Main">
        ${MAIN_TABS.map((r) => `<a href="#/${r.id}" data-route="${r.id}">${r.icon}<span>${r.title}</span></a>`).join('')}
      </nav>
    </div>`;
}

function renderView({ scroll = false } = {}) {
  if (!shellReady) return;
  const route = currentRoute();
  $$('[data-route]').forEach((a) => {
    if (a.dataset.route === route.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('#pageTitle').textContent = route.title;
  document.title = `${route.title} | Sukli`;
  $('#view').innerHTML = data.isReady() ? route.view() : views.skeleton();
  if (scroll) window.scrollTo(0, 0);
}

let frame = 0;
function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    if (currentRoute().id === 'activity' && $('#txList') && data.isReady()) $('#txList').innerHTML = views.activityList();
    else renderView();
  });
}

// ---------- Events ----------
const findById = (list, id) => list.find((x) => x.id === id);
const fireWrite = (p, ok) => Promise.resolve(p).then(() => ok && toast(ok)).catch((e) => toast(friendlyError(e), 'error'));

const actions = {
  'add-tx': () => forms.openTransactionForm(),
  'edit-tx': (el) => { const t = findById(state.txs, el.dataset.id); if (t) forms.openTransactionForm(t); },
  'month-prev': () => { nav.month = shiftMonth(nav.month, -1); renderView(); },
  'month-next': () => { if (nav.month < monthOf(todayStr())) { nav.month = shiftMonth(nav.month, 1); renderView(); } },
  'filter-type': (el) => { nav.type = el.dataset.type; renderView(); },
  'budget-edit': (el) => forms.openBudgetForm(el.dataset.cat),
  'goal-new': () => forms.openGoalForm(),
  'goal-edit': (el) => { const g = findById(state.goals, el.dataset.id); if (g) forms.openGoalForm(g); },
  'goal-add': (el) => { const g = findById(state.goals, el.dataset.id); if (g) forms.openGoalMoneyForm(g, 'add'); },
  'goal-withdraw': (el) => { const g = findById(state.goals, el.dataset.id); if (g) forms.openGoalMoneyForm(g, 'withdraw'); },
  'account-new': () => forms.openAccountForm(),
  'account-edit': (el) => { const a = findById(state.accounts, el.dataset.id); if (a) forms.openAccountForm(a); },
  'recurring-new': () => forms.openRecurringForm(),
  'recurring-edit': (el) => { const r = findById(state.recurring, el.dataset.id); if (r) forms.openRecurringForm(r); },
  'recurring-toggle': (el) => { const r = findById(state.recurring, el.dataset.id); if (r) fireWrite(data.setRecurringActive(r.id, !r.active)); },
  'save-name': () => fireWrite(data.saveName($('#nameInput').value), 'Name saved'),
  'export-csv': () => {
    const blob = new Blob([data.transactionsCsv()], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `sukli-${todayStr()}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  wipe: async () => {
    const ok = await confirmSheet({
      title: 'Delete all your data?',
      message: 'Every transaction, budget, goal, account and recurring item will be permanently deleted. Download a CSV first if you want a copy.',
      confirmLabel: 'Delete everything', danger: true,
    });
    if (!ok) return;
    try { await data.deleteAllData(); toast('All data deleted'); } catch (e) { toast(friendlyError(e), 'error'); }
  },
  signout: () => signOut(auth),
  google: googleSignIn,
  'toggle-auth': () => { authMode = authMode === 'signin' ? 'signup' : 'signin'; renderAuth(); },
  'reset-password': resetPassword,
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form="auth"]');
  if (form) { e.preventDefault(); handleAuthSubmit(form); }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'txSearch') { nav.q = e.target.value; $('#txList').innerHTML = views.activityList(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'txAccount') { nav.account = e.target.value; $('#txList').innerHTML = views.activityList(); }
});

window.addEventListener('hashchange', () => renderView({ scroll: true }));
data.onChange(scheduleRender);
data.onSyncError((msg) => toast(msg, 'error'));

// ---------- Boot ----------
onAuthStateChanged(auth, (user) => {
  if (!user) {
    data.stopSync();
    authMode = 'signin';
    renderAuth();
    return;
  }
  data.startSync(user);
  renderShell();
  renderView({ scroll: true });
});
