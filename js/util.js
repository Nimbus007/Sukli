// Pure helpers: money (PHP only, stored as integer centavos), dates, escaping.

const peso2 = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const peso0 = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const pesoCompact = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1,
});

export const MAX_CENTAVOS = 100000000000; // ₱1,000,000,000.00

export const money = (c) => peso2.format((c || 0) / 100);
export const moneyWhole = (c) => peso0.format(Math.round((c || 0) / 100));
export const moneyCompact = (c) =>
  Math.abs(c || 0) >= 10000000 ? pesoCompact.format((c || 0) / 100) : moneyWhole(c);
export const pesosToInput = (c) => ((c || 0) / 100).toFixed(2);

/** "1,250.50" or "₱1250" -> 125050. Returns null when invalid. Never uses floats for the math. */
export function parsePesos(input, { allowNegative = false } = {}) {
  if (typeof input !== 'string') return null;
  let s = input.replace(/php|₱|,|\s/gi, '');
  let sign = 1;
  if (allowNegative && s.startsWith('-')) { sign = -1; s = s.slice(1); }
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const c = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(c) || c > MAX_CENTAVOS) return null;
  return sign * c;
}

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayStr = () => toDateStr(new Date());
export const monthOf = (dateStr) => dateStr.slice(0, 7);
export const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && toDateStr(parseDate(s)) === s;

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(key, short = false) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return short
    ? d.toLocaleDateString('en-PH', { month: 'short' })
    : d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

export function dateLabel(s) {
  const today = todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (s === today) return 'Today';
  if (s === toDateStr(y)) return 'Yesterday';
  return parseDate(s).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function longDate(s) {
  return parseDate(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

const daysInMonth = (y, m1) => new Date(y, m1, 0).getDate();

/** Next date for a recurring item. Monthly items keep their anchor day (31st -> last day of short months). */
export function nextOccurrence(dateStr, freq, anchorDay) {
  const d = parseDate(dateStr);
  if (freq === 'weekly') { d.setDate(d.getDate() + 7); return toDateStr(d); }
  if (freq === 'biweekly') { d.setDate(d.getDate() + 14); return toDateStr(d); }
  const first = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const dim = daysInMonth(first.getFullYear(), first.getMonth() + 1);
  return toDateStr(new Date(first.getFullYear(), first.getMonth(), Math.min(anchorDay || d.getDate(), dim)));
}

export function monthsBetween(fromKey, toKey) {
  const [fy, fm] = fromKey.split('-').map(Number);
  const [ty, tm] = toKey.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function friendlyError(e) {
  const code = e?.code || '';
  const map = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
    'auth/weak-password': 'Use a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
    'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
    'auth/network-request-failed': 'No internet connection. Check your connection and try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in your Firebase project yet.',
    'auth/unauthorized-domain': 'This domain is not authorised for sign-in. Add it in Firebase Authentication settings.',
    'permission-denied': 'Firestore rejected this change. Make sure the security rules are deployed.',
    unavailable: 'You are offline. Changes will sync when you reconnect.',
  };
  return map[code] || e?.message || 'Something went wrong. Try again.';
}
