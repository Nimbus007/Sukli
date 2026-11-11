// Views return HTML strings. Event handling lives in main.js (delegated via data-action).
import { state } from './data.js';
import {
  money, moneyWhole, moneyCompact, esc, todayStr, monthOf, shiftMonth, monthLabel, dateLabel, longDate,
  monthsBetween,
} from './util.js';
import {
  accountBalances, monthTotals, expenseByCategory, monthlySeries, budgetStatus,
} from './calc.js';
import {
  EXPENSE_CATEGORIES, categoryById, accountTypeById, FREQUENCIES,
} from './categories.js';
import { icons } from './ui.js';

export const nav = { month: monthOf(todayStr()), type: 'all', account: '', q: '' };
const currentMonth = () => monthOf(todayStr());
const acctName = (id) => state.accounts.find((a) => a.id === id)?.name || 'Deleted account';

const empty = (title, body, action = '') =>
  `<div class="empty"><h3>${esc(title)}</h3><p class="muted">${esc(body)}</p>${action}</div>`;

export const skeleton = () => '<div class="skeleton" aria-busy="true" aria-label="Loading"><i></i><i></i><i></i></div>';

function monthSwitcher() {
  const atCurrent = nav.month >= currentMonth();
  return `
    <div class="monthsw">
      <button class="icon-btn" data-action="month-prev" aria-label="Previous month">${icons.left}</button>
      <h2>${esc(monthLabel(nav.month))}</h2>
      <button class="icon-btn" data-action="month-next" aria-label="Next month"${atCurrent ? ' disabled' : ''}>${icons.right}</button>
    </div>`;
}

function bar(pct, color, over = false) {
  const w = Math.max(0, Math.min(100, pct));
  return `<div class="bar${over ? ' over' : ''}" style="--c:${color}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${w}"><i style="width:${w}%"></i></div>`;
}

// ---------- Transactions list pieces ----------
function txRow(t) {
  const isTransfer = t.type === 'transfer';
  const cat = isTransfer ? { name: 'Transfer', icon: '🔁', color: '#6B7687' } : categoryById(t.categoryId);
  const title = t.note || cat.name;
  const sub = isTransfer
    ? `${esc(acctName(t.accountId))} to ${esc(acctName(t.toAccountId))}`
    : (t.note ? `${esc(cat.name)}, ${esc(acctName(t.accountId))}` : esc(acctName(t.accountId)));
  const amt = t.type === 'income'
    ? `<b class="amt-in">+${money(t.amount)}</b>`
    : isTransfer ? `<b class="amt-tr">${money(t.amount)}</b>` : `<b>${money(t.amount)}</b>`;
  return `
    <li><button class="row" data-action="edit-tx" data-id="${esc(t.id)}">
      <span class="dot" style="--c:${cat.color}" aria-hidden="true">${cat.icon}</span>
      <span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub muted">${sub}</span></span>
      ${amt}
    </button></li>`;
}

function groupedRows(list) {
  let html = '';
  let last = '';
  for (const t of list) {
    if (t.date !== last) {
      if (last) html += '</ul>';
      html += `<h3 class="day">${esc(dateLabel(t.date))}</h3><ul class="rows">`;
      last = t.date;
    }
    html += txRow(t);
  }
  return last ? `${html}</ul>` : html;
}

// ---------- Home ----------
export function homeView() {
  const key = currentMonth();
  const bal = accountBalances(state.accounts, state.txs);
  const total = Object.values(bal).reduce((a, b) => a + b, 0);
  const { income, expense } = monthTotals(state.txs, key);
  const net = income - expense;
  const name = (state.profile?.name || state.user?.displayName || '').split(' ')[0];

  const notes = state.accounts.map((a) => {
    const type = accountTypeById(a.type);
    return `
      <button class="note note-${esc(a.type)}" data-action="account-edit" data-id="${esc(a.id)}" aria-label="${esc(a.name)}, ${money(bal[a.id])}. Edit account">
        <span class="note-top"><span class="note-name">${esc(a.name)}</span><span class="note-icon" aria-hidden="true">${type.icon}</span></span>
        <span class="note-amt">${money(bal[a.id])}</span>
      </button>`;
  }).join('');

  const spent = expenseByCategory(state.txs, key);
  const budgeted = Object.entries(state.budgets).map(([id, limit]) => ({
    cat: categoryById(id), limit, spent: spent[id] || 0, ...budgetStatus(spent[id] || 0, limit),
  })).sort((a, b) => b.pct - a.pct).slice(0, 4);

  const budgetHtml = budgeted.length
    ? budgeted.map((b) => `
        <li class="meter">
          <div class="meter-head"><span>${b.cat.icon} ${esc(b.cat.name)}</span>
            <span class="${b.over ? 'neg' : 'muted'}">${b.over ? `${moneyWhole(-b.left)} over` : `${moneyWhole(b.left)} left`}</span></div>
          ${bar(b.pct, b.cat.color, b.over)}
        </li>`).join('')
    : empty('No monthly limits yet', 'Set a limit for groceries, transport or load so you see it coming.',
      '<a class="btn soft" href="#/budgets">Set a budget</a>');

  const recent = state.txs.slice(0, 6);
  const goals = state.goals.slice(0, 2);

  return `
    <section class="hello">
      <h1>${name ? `Kumusta, ${esc(name)}` : 'Kumusta'}</h1>
      <p class="muted">${esc(monthLabel(key))}</p>
    </section>

    <section class="wallet" aria-label="Accounts">
      <div class="wallet-total">
        <span class="muted">Total balance</span>
        <strong>${money(total)}</strong>
      </div>
      <div class="notes">${notes || skeleton()}</div>
    </section>

    <section class="month-stats" aria-label="This month">
      <div><span class="muted">Money in</span><b class="amt-in">+${money(income)}</b></div>
      <div><span class="muted">Money out</span><b>${money(expense)}</b></div>
      <div><span class="muted">${net >= 0 ? 'Left over' : 'Overspent'}</span><b class="${net >= 0 ? 'amt-in' : 'neg'}">${money(Math.abs(net))}</b></div>
    </section>

    <div class="cols">
      <section>
        <div class="sec-head"><h2>Budgets this month</h2><a href="#/budgets">See all</a></div>
        <ul class="meters">${budgetHtml}</ul>
      </section>
      <section>
        <div class="sec-head"><h2>Recent activity</h2><a href="#/activity">See all</a></div>
        ${recent.length ? groupedRows(recent) : empty('Nothing logged yet', 'Add your first expense or income. It takes a few seconds.',
    '<button class="btn primary" data-action="add-tx">Add transaction</button>')}
      </section>
    </div>

    ${goals.length ? `
      <section>
        <div class="sec-head"><h2>Savings goals</h2><a href="#/goals">See all</a></div>
        <ul class="meters">${goals.map(goalMeter).join('')}</ul>
      </section>` : ''}`;
}

function goalMeter(g) {
  const pct = Math.round((g.saved / g.target) * 100);
  return `
    <li class="meter">
      <div class="meter-head"><span>${esc(g.name)}</span><span class="muted">${moneyWhole(g.saved)} of ${moneyWhole(g.target)}</span></div>
      ${bar(pct, 'var(--brand)')}
    </li>`;
}

// ---------- Activity ----------
export function activityView() {
  const types = [['all', 'All'], ['expense', 'Money out'], ['income', 'Money in'], ['transfer', 'Transfers']];
  return `
    ${monthSwitcher()}
    <div class="filters">
      <div class="chips" role="group" aria-label="Filter by type">
        ${types.map(([k, label]) => `<button class="chip" data-action="filter-type" data-type="${k}" aria-pressed="${nav.type === k}">${label}</button>`).join('')}
      </div>
      <div class="filter-inputs">
        <select id="txAccount" aria-label="Filter by account">
          <option value="">All accounts</option>
          ${state.accounts.map((a) => `<option value="${esc(a.id)}"${nav.account === a.id ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
        <input id="txSearch" type="search" placeholder="Search notes" value="${esc(nav.q)}" aria-label="Search notes">
      </div>
    </div>
    <div id="txList">${activityList()}</div>`;
}

export function activityList() {
  const q = nav.q.trim().toLowerCase();
  const list = state.txs.filter((t) =>
    monthOf(t.date) === nav.month
    && (nav.type === 'all' || t.type === nav.type)
    && (!nav.account || t.accountId === nav.account || t.toAccountId === nav.account)
    && (!q || (t.note || '').toLowerCase().includes(q) || categoryById(t.categoryId).name.toLowerCase().includes(q)));
  if (!list.length) {
    return empty('No transactions here', nav.q || nav.type !== 'all' || nav.account
      ? 'Try clearing the filters.' : `Nothing recorded for ${monthLabel(nav.month)}.`,
    '<button class="btn primary" data-action="add-tx">Add transaction</button>');
  }
  const inSum = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const outSum = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return `<p class="summary muted">${list.length} transaction${list.length === 1 ? '' : 's'}: <b class="amt-in">+${money(inSum)}</b> in, <b>${money(outSum)}</b> out</p>${groupedRows(list)}`;
}

// ---------- Budgets ----------
export function budgetsView() {
  const key = nav.month;
  const spent = expenseByCategory(state.txs, key);
  const withLimit = EXPENSE_CATEGORIES.filter((c) => state.budgets[c.id]);
  const without = EXPENSE_CATEGORIES.filter((c) => !state.budgets[c.id]);
  const totalLimit = withLimit.reduce((s, c) => s + state.budgets[c.id], 0);
  const totalSpent = withLimit.reduce((s, c) => s + (spent[c.id] || 0), 0);
  const unbudgeted = Object.entries(spent).filter(([id]) => !state.budgets[id]).reduce((s, [, v]) => s + v, 0);
  const st = budgetStatus(totalSpent, totalLimit);

  const rows = withLimit
    .map((c) => ({ c, limit: state.budgets[c.id], spent: spent[c.id] || 0 }))
    .map((r) => ({ ...r, ...budgetStatus(r.spent, r.limit) }))
    .sort((a, b) => b.pct - a.pct)
    .map((r) => `
      <li class="budget-row">
        <button class="plain" data-action="budget-edit" data-cat="${esc(r.c.id)}" aria-label="Edit ${esc(r.c.name)} limit">
          <div class="meter-head"><span>${r.c.icon} ${esc(r.c.name)}</span>
            <span class="${r.over ? 'neg' : ''}">${money(r.spent)} <span class="muted">of ${money(r.limit)}</span></span></div>
          ${bar(r.pct, r.c.color, r.over)}
          <div class="meter-foot ${r.over ? 'neg' : 'muted'}">${r.over ? `${money(-r.left)} over this month` : `${money(r.left)} left`}</div>
        </button>
      </li>`).join('');

  const others = without.map((c) => `
    <li class="row-simple">
      <span>${c.icon} ${esc(c.name)}</span>
      <span class="muted">${spent[c.id] ? money(spent[c.id]) : ''}</span>
      <button class="btn soft small" data-action="budget-edit" data-cat="${esc(c.id)}">Set limit</button>
    </li>`).join('');

  return `
    ${monthSwitcher()}
    ${withLimit.length ? `
      <section class="budget-total">
        <p class="muted">Budgeted spending</p>
        <p class="big">${money(totalSpent)} <span class="muted">of ${money(totalLimit)}</span></p>
        ${bar(st.pct, 'var(--brand)', st.over)}
        <p class="${st.over ? 'neg' : 'muted'}">${st.over ? `${money(-st.left)} over your limits` : `${money(st.left)} left across your limits`}${unbudgeted ? `. ${money(unbudgeted)} spent in categories without a limit.` : ''}</p>
      </section>
      <ul class="budget-list">${rows}</ul>` : empty('Plan your month', 'Give each category a monthly limit. Limits repeat every month, and the bars show how much of each is used.')}
    ${without.length ? `<div class="sec-head"><h2>${withLimit.length ? 'More categories' : 'Categories'}</h2></div><ul class="simple-list">${others}</ul>` : ''}`;
}

// ---------- Goals ----------
export function goalsView() {
  const items = state.goals.map((g) => {
    const pct = Math.round((g.saved / g.target) * 100);
    const done = g.saved >= g.target;
    let hint = '';
    if (done) hint = 'Goal reached';
    else if (g.deadline) {
      const months = Math.max(1, monthsBetween(monthOf(todayStr()), monthOf(g.deadline)));
      const late = g.deadline < todayStr();
      hint = late
        ? `Target date was ${longDate(g.deadline)}. ${money(g.target - g.saved)} to go.`
        : `Save about ${money(Math.ceil((g.target - g.saved) / months))} a month to reach it by ${longDate(g.deadline)}.`;
    } else hint = `${money(g.target - g.saved)} to go.`;
    return `
      <li class="goal">
        <div class="meter-head"><h3>${esc(g.name)}</h3><span class="${done ? 'amt-in' : 'muted'}">${pct}%</span></div>
        <p class="big">${money(g.saved)} <span class="muted">of ${money(g.target)}</span></p>
        ${bar(Math.min(100, pct), done ? 'var(--pos)' : 'var(--brand)')}
        <p class="muted hint">${esc(hint)}</p>
        <div class="goal-actions">
          <button class="btn soft small" data-action="goal-add" data-id="${esc(g.id)}">Add money</button>
          <button class="btn ghost small" data-action="goal-withdraw" data-id="${esc(g.id)}"${g.saved ? '' : ' disabled'}>Withdraw</button>
          <button class="btn ghost small" data-action="goal-edit" data-id="${esc(g.id)}">Edit</button>
        </div>
      </li>`;
  }).join('');
  return `
    <div class="sec-head"><h2>Your goals</h2><button class="btn primary small" data-action="goal-new">New goal</button></div>
    ${items ? `<ul class="goal-list">${items}</ul>` : empty('Save for something that matters', 'An emergency fund, a new phone, a Christmas budget. Add a goal and track every deposit.',
    '<button class="btn primary" data-action="goal-new">Create a goal</button>')}`;
}

// ---------- Reports ----------
function donut(parts, total) {
  const r = 52;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const segs = parts.map((p) => {
    const len = (p.value / total) * C;
    const s = `<circle r="${r}" cx="70" cy="70" fill="none" stroke="${p.color}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"><title>${esc(p.name)}: ${money(p.value)}</title></circle>`;
    offset += len;
    return s;
  }).join('');
  return `<svg viewBox="0 0 140 140" class="donut" role="img" aria-label="Spending by category">
    <g transform="rotate(-90 70 70)">${segs}</g>
    <text x="70" y="66" text-anchor="middle" class="d1">Spent</text>
    <text x="70" y="84" text-anchor="middle" class="d2">${moneyCompact(total)}</text></svg>`;
}

function barChart(series) {
  const W = 340, H = 170, base = H - 24, top = 10;
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  const gw = W / series.length;
  const bw = Math.min(22, gw * 0.3);
  const h = (v) => Math.max(v ? 2 : 0, (v / max) * (base - top));
  const cols = series.map((s, i) => {
    const x = i * gw + gw / 2;
    return `
      <rect x="${(x - bw - 1).toFixed(1)}" y="${(base - h(s.income)).toFixed(1)}" width="${bw.toFixed(1)}" height="${h(s.income).toFixed(1)}" rx="3" class="b-in"><title>${esc(monthLabel(s.key))} money in: ${money(s.income)}</title></rect>
      <rect x="${(x + 1).toFixed(1)}" y="${(base - h(s.expense)).toFixed(1)}" width="${bw.toFixed(1)}" height="${h(s.expense).toFixed(1)}" rx="3" class="b-out"><title>${esc(monthLabel(s.key))} money out: ${money(s.expense)}</title></rect>
      <text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle" class="b-label">${esc(monthLabel(s.key, true))}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="bars" role="img" aria-label="Money in and money out for the last six months">
    <line x1="0" x2="${W}" y1="${base}" y2="${base}" class="axis"/>${cols}</svg>`;
}

export function reportsView() {
  const key = nav.month;
  const { income, expense } = monthTotals(state.txs, key);
  const byCat = expenseByCategory(state.txs, key);
  const parts = Object.entries(byCat).map(([id, value]) => ({ ...categoryById(id), value })).sort((a, b) => b.value - a.value);
  const biggest = state.txs.filter((t) => t.type === 'expense' && monthOf(t.date) === key)
    .sort((a, b) => b.amount - a.amount).slice(0, 5);
  const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
  const series = monthlySeries(state.txs, key, 6);

  return `
    ${monthSwitcher()}
    <section class="month-stats">
      <div><span class="muted">Money in</span><b class="amt-in">+${money(income)}</b></div>
      <div><span class="muted">Money out</span><b>${money(expense)}</b></div>
      <div><span class="muted">Savings rate</span><b class="${rate !== null && rate < 0 ? 'neg' : ''}">${rate === null ? 'n/a' : `${rate}%`}</b></div>
    </section>

    <div class="cols">
      <section>
        <div class="sec-head"><h2>Where it went</h2></div>
        ${parts.length ? `
          <div class="donut-wrap">${donut(parts, expense)}
            <ul class="legend">${parts.map((p) => `
              <li><i style="background:${p.color}"></i><span>${p.icon} ${esc(p.name)}</span>
              <span class="muted">${Math.round((p.value / expense) * 100)}%</span><b>${money(p.value)}</b></li>`).join('')}</ul>
          </div>` : empty('No spending this month', 'Expenses you log will appear here by category.')}
      </section>
      <section>
        <div class="sec-head"><h2>Last six months</h2></div>
        ${barChart(series)}
        <p class="chart-key muted"><span><i class="k-in"></i>Money in</span><span><i class="k-out"></i>Money out</span></p>
        ${biggest.length ? `<div class="sec-head"><h2>Biggest expenses</h2></div>${groupedRows(biggest)}` : ''}
      </section>
    </div>`;
}

// ---------- Settings ----------
export function settingsView() {
  const bal = accountBalances(state.accounts, state.txs);
  const freq = (id) => FREQUENCIES.find((f) => f.id === id)?.name || id;
  const accounts = state.accounts.map((a) => `
    <li><button class="row" data-action="account-edit" data-id="${esc(a.id)}">
      <span class="dot" style="--c:var(--brand)" aria-hidden="true">${accountTypeById(a.type).icon}</span>
      <span class="row-main"><span class="row-title">${esc(a.name)}</span><span class="row-sub muted">${esc(accountTypeById(a.type).name)}</span></span>
      <b>${money(bal[a.id])}</b></button></li>`).join('');
  const recurring = state.recurring.map((r) => {
    const cat = categoryById(r.categoryId);
    return `
    <li class="rec">
      <button class="row" data-action="recurring-edit" data-id="${esc(r.id)}">
        <span class="dot" style="--c:${cat.color}" aria-hidden="true">${cat.icon}</span>
        <span class="row-main"><span class="row-title">${esc(r.title)}${r.active ? '' : ' (paused)'}</span>
          <span class="row-sub muted">${esc(freq(r.frequency))}, next ${esc(longDate(r.nextDate))}</span></span>
        <b class="${r.type === 'income' ? 'amt-in' : ''}">${r.type === 'income' ? '+' : ''}${money(r.amount)}</b>
      </button>
      <button class="btn ghost small" data-action="recurring-toggle" data-id="${esc(r.id)}">${r.active ? 'Pause' : 'Resume'}</button>
    </li>`;
  }).join('');

  return `
    <section class="settings-block">
      <div class="sec-head"><h2>Profile</h2></div>
      <div class="inline-form">
        <label class="field"><span>Your name</span><input id="nameInput" maxlength="80" value="${esc(state.profile?.name || state.user?.displayName || '')}" placeholder="What should Sukli call you?"></label>
        <button class="btn soft" data-action="save-name">Save name</button>
      </div>
      <p class="muted">Signed in as ${esc(state.user?.email || 'guest')}. Every amount in Sukli is in Philippine pesos (₱).</p>
    </section>

    <section class="settings-block">
      <div class="sec-head"><h2>Accounts</h2><button class="btn soft small" data-action="account-new">Add account</button></div>
      <ul class="rows">${accounts}</ul>
    </section>

    <section class="settings-block">
      <div class="sec-head"><h2>Recurring</h2><button class="btn soft small" data-action="recurring-new">Add recurring</button></div>
      ${recurring ? `<ul class="rows">${recurring}</ul>` : '<p class="muted">Rent, salary, subscriptions. Add them once and Sukli logs them on time.</p>'}
    </section>

    <section class="settings-block">
      <div class="sec-head"><h2>Your data</h2></div>
      <div class="btn-row">
        <button class="btn soft" data-action="export-csv">Download CSV</button>
        <button class="btn danger-ghost" data-action="wipe">Delete all my data</button>
      </div>
    </section>

    <section class="settings-block">
      <button class="btn ghost" data-action="signout">Sign out</button>
    </section>`;
}
