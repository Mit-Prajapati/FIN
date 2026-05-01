/* ============================================================
   FinTrack — Personal Finance Manager
   Modular Vanilla JavaScript Application
   ============================================================ */

// ===== CONSTANTS =====
const CATEGORIES = {
  income: [
    { id: 'salary', label: 'Salary', icon: '💼' },
    { id: 'freelance', label: 'Freelance', icon: '💻' },
    { id: 'investment', label: 'Investment', icon: '📈' },
    { id: 'gift', label: 'Gift', icon: '🎁' },
    { id: 'refund', label: 'Refund', icon: '🔄' },
    { id: 'other-income', label: 'Other Income', icon: '💰' }
  ],
  expense: [
    { id: 'food', label: 'Food & Dining', icon: '🍽️' },
    { id: 'travel', label: 'Travel', icon: '✈️' },
    { id: 'shopping', label: 'Shopping', icon: '🛍️' },
    { id: 'bills', label: 'Bills & Utilities', icon: '📄' },
    { id: 'entertainment', label: 'Entertainment', icon: '🎬' },
    { id: 'health', label: 'Health', icon: '🏥' },
    { id: 'education', label: 'Education', icon: '📚' },
    { id: 'rent', label: 'Rent', icon: '🏠' },
    { id: 'groceries', label: 'Groceries', icon: '🛒' },
    { id: 'transport', label: 'Transport', icon: '🚌' },
    { id: 'subscriptions', label: 'Subscriptions', icon: '📱' },
    { id: 'other-expense', label: 'Other', icon: '📎' }
  ]
};

// Chart colors — a curated, muted palette
const CHART_COLORS = [
  '#5B8DEF', '#F2994A', '#6FCF97', '#BB6BD9',
  '#EB5757', '#56CCF2', '#F2C94C', '#828282',
  '#2D9CDB', '#27AE60', '#E2B93B', '#9B51E0'
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const STORAGE_KEYS = {
  user: 'fintrack_user',
  transactions: 'fintrack_transactions',
  budget: 'fintrack_budget',
  theme: 'fintrack_theme'
};

// ===== STATE =====
let state = {
  user: null,
  transactions: [],
  budget: 0,
  currentPage: 'dashboard',
  editingId: null,
  deleteId: null,
  txnType: 'expense', // for the modal form
  analyticsMonth: new Date().getMonth(),
  analyticsYear: new Date().getFullYear(),
  theme: 'light'
};

// ===== STORAGE — LocalStorage persistence =====

/** Save a specific key to localStorage */
function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Storage save failed:', e);
  }
}

/** Load a specific key from localStorage */
function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Storage load failed:', e);
    return null;
  }
}

/** Persist current state */
function persistState() {
  saveToStorage(STORAGE_KEYS.user, state.user);
  saveToStorage(STORAGE_KEYS.transactions, state.transactions);
  saveToStorage(STORAGE_KEYS.budget, state.budget);
  saveToStorage(STORAGE_KEYS.theme, state.theme);
}

/** Load state from storage */
function loadState() {
  state.user = loadFromStorage(STORAGE_KEYS.user);
  state.transactions = loadFromStorage(STORAGE_KEYS.transactions) || [];
  state.budget = loadFromStorage(STORAGE_KEYS.budget) || 0;
  state.theme = loadFromStorage(STORAGE_KEYS.theme) || 'light';
}

// ===== UTILITY FUNCTIONS =====

/** Format number as Indian currency */
function formatCurrency(amount) {
  const num = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  return sign + '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/** Format date for display: "23 Apr 2026" */
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Generate unique ID */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/** Get category object by ID */
function getCategoryById(id) {
  const all = [...CATEGORIES.income, ...CATEGORIES.expense];
  return all.find(c => c.id === id) || { id, label: id, icon: '📎' };
}

/** Get today's date as YYYY-MM-DD */
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** Get transactions for a specific month/year */
function getMonthlyTransactions(month, year) {
  return state.transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

/** Calculate total income from a list of transactions */
function totalIncome(txns) {
  return txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
}

/** Calculate total expenses from a list of transactions */
function totalExpenses(txns) {
  return txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
}

// ===== THEME =====

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  // Toggle sun/moon icons
  const suns = document.querySelectorAll('.icon-sun');
  const moons = document.querySelectorAll('.icon-moon');

  if (theme === 'dark') {
    suns.forEach(el => el.classList.add('hidden'));
    moons.forEach(el => el.classList.remove('hidden'));
  } else {
    suns.forEach(el => el.classList.remove('hidden'));
    moons.forEach(el => el.classList.add('hidden'));
  }

  saveToStorage(STORAGE_KEYS.theme, theme);
}

function toggleTheme() {
  applyTheme(state.theme === 'light' ? 'dark' : 'light');
  // Redraw charts if on analytics page
  if (state.currentPage === 'analytics') {
    renderAnalytics();
  }
}

// ===== NAVIGATION =====

function navigateTo(page) {
  state.currentPage = page;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById(page + '-page');
  if (target) target.classList.remove('hidden');

  // Update sidebar active state
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Page title
  const titles = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    analytics: 'Analytics',
    budget: 'Budget'
  };
  document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

  // Render the page
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'analytics': renderAnalytics(); break;
    case 'budget': renderBudget(); break;
  }
}

// ===== LOGIN =====

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-greeting').textContent = 'Hi, ' + (state.user?.name || 'User');
  navigateTo('dashboard');
}

function handleLogin(e) {
  e.preventDefault();
  const nameInput = document.getElementById('login-name');
  const pinInput = document.getElementById('login-pin');
  const errorEl = document.getElementById('login-error');

  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();

  if (!name) {
    errorEl.textContent = 'Please enter your name';
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    errorEl.textContent = 'PIN must be exactly 4 digits';
    return;
  }

  // Check if returning user
  const existingUser = loadFromStorage(STORAGE_KEYS.user);

  if (existingUser && name === existingUser.name) {
    // Exact match for existing user — verify PIN
    if (existingUser.pin !== pin) {
      errorEl.textContent = 'Incorrect PIN for ' + name + '. Please try again.';
      return;
    }
    state.user = existingUser;
  } else {
    // New user OR different name
    if (existingUser && existingUser.name !== name) {
      const confirmSwitch = confirm(`Switching to "${name}" will start a new session. Your previous data (for ${existingUser.name}) will be cleared. Proceed?`);
      if (!confirmSwitch) return;

      // Clear old data for new user
      state.transactions = [];
      state.budget = 0;
      localStorage.removeItem(STORAGE_KEYS.transactions);
      localStorage.removeItem(STORAGE_KEYS.budget);
    }
    state.user = { name, pin };
  }

  errorEl.textContent = '';
  persistState();
  showApp();
}

function handleLogout() {
  state.user = null;
  saveToStorage(STORAGE_KEYS.user, null);
  showLogin();
  document.getElementById('login-form').reset();
}

// ===== RENDER: DASHBOARD =====

function renderDashboard() {
  const allTxns = state.transactions;
  const income = totalIncome(allTxns);
  const expenses = totalExpenses(allTxns);
  const balance = income - expenses;

  // Summary cards
  document.getElementById('dash-balance').textContent = formatCurrency(balance);
  document.getElementById('dash-income').textContent = formatCurrency(income);
  document.getElementById('dash-expenses').textContent = formatCurrency(expenses);

  // Balance subtitle
  const subEl = document.getElementById('dash-balance-sub');
  if (allTxns.length === 0) {
    subEl.textContent = 'No transactions yet';
  } else {
    const thisMonth = getMonthlyTransactions(new Date().getMonth(), new Date().getFullYear());
    const monthExpenses = totalExpenses(thisMonth);
    subEl.textContent = formatCurrency(monthExpenses) + ' spent this month';
  }

  // Budget section
  renderDashboardBudget();

  // Top spending category
  renderTopCategory();

  // Recent transactions
  renderRecentTransactions();
}

function renderDashboardBudget() {
  const content = document.getElementById('dash-budget-content');

  if (state.budget <= 0) {
    content.innerHTML = `<p class="text-secondary">No budget set. <a href="#" id="dash-set-budget-link">Set one now →</a></p>`;
    const link = document.getElementById('dash-set-budget-link');
    if (link) link.addEventListener('click', (e) => { e.preventDefault(); openBudgetModal(); });
    return;
  }

  const now = new Date();
  const monthTxns = getMonthlyTransactions(now.getMonth(), now.getFullYear());
  const spent = totalExpenses(monthTxns);
  const pct = Math.min((spent / state.budget) * 100, 100);
  const remaining = state.budget - spent;

  let fillClass = '';
  let warningHtml = '';
  if (spent > state.budget) {
    fillClass = 'danger';
    warningHtml = `<div class="budget-warning">⚠️ You've exceeded your monthly budget by ${formatCurrency(Math.abs(remaining))}</div>`;
  } else if (spent === state.budget) {
    fillClass = 'danger';
    warningHtml = `<div class="budget-warning">⚠️ You've reached your monthly budget limit!</div>`;
  } else if (pct >= 80) {
    fillClass = 'warning';
    warningHtml = `<div class="budget-warning soft-warning">⚡ You've used ${Math.round(pct)}% of your budget</div>`;
  }

  content.innerHTML = `
    <div class="budget-progress-section">
      <div class="budget-amount-row">
        <span class="budget-spent">${formatCurrency(spent)} spent</span>
        <span class="budget-limit">of ${formatCurrency(state.budget)}</span>
      </div>
      <div class="budget-progress-bar">
        <div class="budget-progress-fill ${fillClass}" style="width: ${pct}%"></div>
      </div>
      <div class="budget-remaining">${remaining >= 0 ? formatCurrency(remaining) + ' remaining' : 'Over by ' + formatCurrency(Math.abs(remaining))}</div>
    </div>
    ${warningHtml}
  `;
}

function renderTopCategory() {
  const content = document.getElementById('dash-top-category-content');
  const expenses = state.transactions.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    content.innerHTML = '<p class="text-secondary">No expenses recorded yet</p>';
    return;
  }

  // Tally expenses by category
  const categoryTotals = {};
  expenses.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);

  // Find top category
  let topCatId = null;
  let topAmount = 0;
  for (const [catId, amount] of Object.entries(categoryTotals)) {
    if (amount > topAmount) {
      topAmount = amount;
      topCatId = catId;
    }
  }

  const cat = getCategoryById(topCatId);
  const pct = totalExp > 0 ? Math.round((topAmount / totalExp) * 100) : 0;

  content.innerHTML = `
    <div class="top-category-display">
      <div class="top-cat-icon">${cat.icon}</div>
      <div class="top-cat-info">
        <div class="top-cat-name">${cat.label}</div>
        <div class="top-cat-amount">${formatCurrency(topAmount)} total</div>
      </div>
      <div class="top-cat-percent">${pct}%</div>
    </div>
  `;
}

function renderRecentTransactions() {
  const container = document.getElementById('dash-recent-transactions');
  const sorted = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const recent = sorted.slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No transactions yet</p>
        <p class="text-secondary">Add your first transaction to get started</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map(t => renderTxnItem(t, false)).join('');
}

// ===== RENDER: TRANSACTIONS =====

function renderTransactions() {
  const container = document.getElementById('transaction-list');

  // Get filter values
  const searchVal = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const catFilter = document.getElementById('filter-category').value;
  const typeFilter = document.getElementById('filter-type').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo = document.getElementById('filter-date-to').value;

  // Apply filters
  let filtered = [...state.transactions];

  if (searchVal) {
    filtered = filtered.filter(t =>
      t.description.toLowerCase().includes(searchVal) ||
      getCategoryById(t.category).label.toLowerCase().includes(searchVal)
    );
  }

  if (catFilter !== 'all') {
    filtered = filtered.filter(t => t.category === catFilter);
  }

  if (typeFilter !== 'all') {
    filtered = filtered.filter(t => t.type === typeFilter);
  }

  if (dateFrom) {
    filtered = filtered.filter(t => t.date >= dateFrom);
  }

  if (dateTo) {
    filtered = filtered.filter(t => t.date <= dateTo);
  }

  // Sort by date descending
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No transactions found</p>
        <p class="text-secondary">${state.transactions.length === 0 ? 'Add your first transaction to get started' : 'Try adjusting your filters'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(t => renderTxnItem(t, true)).join('');
}

/** Render a single transaction item */
function renderTxnItem(txn, showActions) {
  const cat = getCategoryById(txn.category);
  const sign = txn.type === 'income' ? '+' : '-';
  const amountClass = txn.type === 'income' ? 'income' : 'expense';

  const actionsHtml = showActions ? `
    <div class="txn-actions">
      <button class="txn-action-btn edit-btn" data-id="${txn.id}" title="Edit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="txn-action-btn delete-btn" data-id="${txn.id}" title="Delete">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
  ` : '';

  return `
    <div class="txn-item" data-id="${txn.id}">
      <div class="txn-category-icon ${txn.type}-type">${cat.icon}</div>
      <div class="txn-details">
        <div class="txn-description">${escapeHtml(txn.description)}</div>
        <div class="txn-meta">${cat.label} · ${formatDate(txn.date)}</div>
      </div>
      <div class="txn-amount ${amountClass}">${sign}${formatCurrency(txn.amount)}</div>
      ${actionsHtml}
    </div>
  `;
}

/** Escape HTML entities to prevent XSS */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== RENDER: ANALYTICS =====

function renderAnalytics() {
  const month = state.analyticsMonth;
  const year = state.analyticsYear;

  // Update month label
  document.getElementById('current-month-label').textContent =
    MONTH_NAMES[month] + ' ' + year;

  const monthTxns = getMonthlyTransactions(month, year);
  const income = totalIncome(monthTxns);
  const expenses = totalExpenses(monthTxns);
  const savings = income - expenses;

  document.getElementById('analytics-income').textContent = formatCurrency(income);
  document.getElementById('analytics-expenses').textContent = formatCurrency(expenses);

  const savingsEl = document.getElementById('analytics-savings');
  savingsEl.textContent = (savings >= 0 ? '+' : '-') + formatCurrency(Math.abs(savings));
  savingsEl.style.color = savings >= 0 ? 'var(--income)' : 'var(--expense)';

  // Draw charts
  requestAnimationFrame(() => {
    drawBarChart();
    drawDonutChart(month, year);
  });
}

// ===== RENDER: BUDGET =====

function renderBudget() {
  const content = document.getElementById('budget-content');
  const catSection = document.getElementById('category-budget-section');

  if (state.budget <= 0) {
    content.innerHTML = `
      <div class="empty-state">
        <p>No budget set</p>
        <p class="text-secondary">Set a monthly spending limit to stay on track</p>
      </div>
    `;
    catSection.style.display = 'none';
    document.getElementById('set-budget-btn').textContent = 'Set Budget';
    return;
  }

  document.getElementById('set-budget-btn').textContent = 'Edit Budget';

  const now = new Date();
  const monthTxns = getMonthlyTransactions(now.getMonth(), now.getFullYear());
  const spent = totalExpenses(monthTxns);
  const pct = Math.min((spent / state.budget) * 100, 100);
  const remaining = state.budget - spent;

  let fillClass = '';
  let warningHtml = '';
  if (spent > state.budget) {
    fillClass = 'danger';
    warningHtml = `<div class="budget-warning">⚠️ You've exceeded your monthly budget by ${formatCurrency(Math.abs(remaining))}</div>`;
  } else if (spent === state.budget) {
    fillClass = 'danger';
    warningHtml = `<div class="budget-warning">⚠️ You've reached your monthly budget limit!</div>`;
  } else if (pct >= 80) {
    fillClass = 'warning';
    warningHtml = `<div class="budget-warning soft-warning">⚡ You've used ${Math.round(pct)}% of your budget. Slow down!</div>`;
  }

  content.innerHTML = `
    <div class="budget-progress-section">
      <div class="budget-amount-row">
        <span class="budget-spent">${formatCurrency(spent)} spent</span>
        <span class="budget-limit">of ${formatCurrency(state.budget)}</span>
      </div>
      <div class="budget-progress-bar">
        <div class="budget-progress-fill ${fillClass}" style="width: ${pct}%"></div>
      </div>
      <div class="budget-remaining">${remaining >= 0 ? formatCurrency(remaining) + ' remaining' : 'Over by ' + formatCurrency(Math.abs(remaining))}</div>
    </div>
    ${warningHtml}
  `;

  // Category-wise spending
  const expenseTxns = monthTxns.filter(t => t.type === 'expense');
  if (expenseTxns.length > 0) {
    catSection.style.display = '';
    const catTotals = {};
    expenseTxns.forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });

    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const maxAmount = sorted[0]?.[1] || 1;

    const catListEl = document.getElementById('category-budget-list');
    catListEl.innerHTML = sorted.map(([catId, amount], i) => {
      const cat = getCategoryById(catId);
      const barPct = (amount / maxAmount) * 100;
      const color = CHART_COLORS[i % CHART_COLORS.length];
      return `
        <div class="category-bar-item">
          <span class="cat-bar-icon">${cat.icon}</span>
          <div class="cat-bar-details">
            <div class="cat-bar-header">
              <span class="cat-bar-name">${cat.label}</span>
              <span class="cat-bar-amount">${formatCurrency(amount)}</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width: ${barPct}%; background: ${color}"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    catSection.style.display = 'none';
  }
}

// ===== CHARTS — Canvas Drawing =====

/** Draw bar chart: Income vs Expenses for the last 6 months */
function drawBarChart() {
  const canvas = document.getElementById('bar-chart');
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 260 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '260px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = 260;

  // Get styles for theming
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-light').trim();
  const incomeColor = getComputedStyle(document.documentElement).getPropertyValue('--income').trim();
  const expenseColor = getComputedStyle(document.documentElement).getPropertyValue('--expense').trim();

  // Gather 6 months of data
  const months = [];
  let m = state.analyticsMonth;
  let y = state.analyticsYear;
  for (let i = 0; i < 6; i++) {
    months.unshift({ month: m, year: y });
    m--;
    if (m < 0) { m = 11; y--; }
  }

  const data = months.map(({ month, year }) => {
    const txns = getMonthlyTransactions(month, year);
    return {
      label: MONTH_NAMES[month].substr(0, 3),
      income: totalIncome(txns),
      expenses: totalExpenses(txns)
    };
  });

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);

  // Chart dimensions
  const padding = { top: 16, right: 20, bottom: 36, left: 12 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const groupWidth = chartW / data.length;
  const barWidth = Math.min(groupWidth * 0.28, 24);
  const gap = 4;

  ctx.clearRect(0, 0, width, height);

  // Draw horizontal grid lines
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const yPos = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, yPos);
    ctx.lineTo(width - padding.right, yPos);
    ctx.stroke();
  }

  // Draw bars
  data.forEach((d, i) => {
    const cx = padding.left + groupWidth * i + groupWidth / 2;

    // Income bar
    const incomeH = (d.income / maxVal) * chartH;
    const ix = cx - barWidth - gap / 2;
    const iy = padding.top + chartH - incomeH;
    ctx.fillStyle = incomeColor;
    roundedRect(ctx, ix, iy, barWidth, incomeH, 3);

    // Expense bar
    const expenseH = (d.expenses / maxVal) * chartH;
    const ex = cx + gap / 2;
    const ey = padding.top + chartH - expenseH;
    ctx.fillStyle = expenseColor;
    roundedRect(ctx, ex, ey, barWidth, expenseH, 3);

    // Label
    ctx.fillStyle = textColor;
    ctx.font = '500 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, cx, height - padding.bottom + 20);
  });

  // Legend
  ctx.font = '500 11px Inter, sans-serif';
  const legendY = 10;

  ctx.fillStyle = incomeColor;
  ctx.fillRect(width - 145, legendY, 10, 10);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText('Income', width - 130, legendY + 9);

  ctx.fillStyle = expenseColor;
  ctx.fillRect(width - 72, legendY, 10, 10);
  ctx.fillStyle = textColor;
  ctx.fillText('Expense', width - 57, legendY + 9);
}

/** Helper: draw a rectangle with rounded top corners */
function roundedRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/** Draw donut chart: Expense breakdown by category */
function drawDonutChart(month, year) {
  const canvas = document.getElementById('donut-chart');
  const legendEl = document.getElementById('donut-legend');
  if (!canvas || !legendEl) return;

  const monthTxns = getMonthlyTransactions(month, year);
  const expenses = monthTxns.filter(t => t.type === 'expense');

  if (expenses.length === 0) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = 180 * dpr;
    canvas.height = 180 * dpr;
    canvas.style.width = '180px';
    canvas.style.height = '180px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, 180, 180);

    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    ctx.fillStyle = textColor;
    ctx.font = '500 13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No expenses', 90, 90);

    legendEl.innerHTML = '';
    return;
  }

  // Tally by category
  const catTotals = {};
  expenses.forEach(t => {
    catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
  });

  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  // Draw donut
  const dpr = window.devicePixelRatio || 1;
  const size = 180;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size / 2) - 4;
  const innerR = outerR * 0.6;

  let startAngle = -Math.PI / 2; // Start from top

  sorted.forEach(([catId, amount], i) => {
    const sliceAngle = (amount / totalExp) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Center text
  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();

  ctx.fillStyle = textColor;
  ctx.font = '700 16px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatCurrency(totalExp), cx, cy - 2);

  const subColor = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
  ctx.fillStyle = subColor;
  ctx.font = '400 10px Inter, sans-serif';
  ctx.fillText('Total Expenses', cx, cy + 14);

  // Legend
  legendEl.innerHTML = sorted.map(([catId, amount], i) => {
    const cat = getCategoryById(catId);
    const pct = Math.round((amount / totalExp) * 100);
    return `
      <div class="legend-item">
        <span class="legend-dot" style="background: ${CHART_COLORS[i % CHART_COLORS.length]}"></span>
        <span class="legend-label">${cat.label}</span>
        <span class="legend-value">${pct}%</span>
      </div>
    `;
  }).join('');
}

// ===== TRANSACTION MODAL =====

function openTransactionModal(editId) {
  const modal = document.getElementById('transaction-modal');
  const title = document.getElementById('modal-title');
  const submitBtn = document.getElementById('txn-submit-btn');
  const errorEl = document.getElementById('txn-form-error');

  errorEl.textContent = '';
  state.editingId = editId || null;

  if (editId) {
    const txn = state.transactions.find(t => t.id === editId);
    if (!txn) return;

    title.textContent = 'Edit Transaction';
    submitBtn.textContent = 'Save Changes';

    state.txnType = txn.type;
    updateTypeToggle(txn.type);
    populateCategoryDropdown(txn.type, 'txn-category');
    document.getElementById('txn-amount').value = txn.amount;
    document.getElementById('txn-category').value = txn.category;
    document.getElementById('txn-date').value = txn.date;
    document.getElementById('txn-description').value = txn.description;
  } else {
    title.textContent = 'Add Transaction';
    submitBtn.textContent = 'Add Transaction';

    state.txnType = 'expense';
    updateTypeToggle('expense');
    populateCategoryDropdown('expense', 'txn-category');
    document.getElementById('transaction-form').reset();
    document.getElementById('txn-date').value = todayStr();
  }

  modal.classList.remove('hidden');
}

function closeTransactionModal() {
  document.getElementById('transaction-modal').classList.add('hidden');
  state.editingId = null;
}

function updateTypeToggle(type) {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function populateCategoryDropdown(type, selectId) {
  const select = document.getElementById(selectId);
  const categories = CATEGORIES[type] || [];
  const currentVal = select.value;

  select.innerHTML = '<option value="" disabled selected>Select a category</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.icon + ' ' + cat.label;
    select.appendChild(opt);
  });

  // Restore value if it exists in the new list
  if (categories.find(c => c.id === currentVal)) {
    select.value = currentVal;
  }
}

function handleTransactionSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById('txn-form-error');

  const amount = parseFloat(document.getElementById('txn-amount').value);
  const category = document.getElementById('txn-category').value;
  const date = document.getElementById('txn-date').value;
  const description = document.getElementById('txn-description').value.trim();

  // Validation
  if (!amount || amount <= 0) {
    errorEl.textContent = 'Please enter a valid amount';
    return;
  }
  if (!category) {
    errorEl.textContent = 'Please select a category';
    return;
  }
  if (!date) {
    errorEl.textContent = 'Please select a date';
    return;
  }
  if (!description) {
    errorEl.textContent = 'Please enter a description';
    return;
  }

  errorEl.textContent = '';

  const txnData = {
    type: state.txnType,
    amount,
    category,
    date,
    description
  };

  if (state.editingId) {
    // Update existing transaction
    const idx = state.transactions.findIndex(t => t.id === state.editingId);
    if (idx !== -1) {
      state.transactions[idx] = { ...state.transactions[idx], ...txnData };
    }
  } else {
    // Add new transaction
    state.transactions.push({ id: generateId(), ...txnData });
  }

  persistState();
  closeTransactionModal();

  // Re-render current page
  navigateTo(state.currentPage);
}

// ===== DELETE =====

function openDeleteModal(id) {
  state.deleteId = id;
  document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
  state.deleteId = null;
  document.getElementById('delete-modal').classList.add('hidden');
}

function confirmDelete() {
  if (state.deleteId) {
    state.transactions = state.transactions.filter(t => t.id !== state.deleteId);
    persistState();
  }
  closeDeleteModal();
  navigateTo(state.currentPage);
}

// ===== BUDGET MODAL =====

function openBudgetModal() {
  const modal = document.getElementById('budget-modal');
  document.getElementById('budget-amount').value = state.budget > 0 ? state.budget : '';
  modal.classList.remove('hidden');
}

function closeBudgetModal() {
  document.getElementById('budget-modal').classList.add('hidden');
}

function handleBudgetSubmit(e) {
  e.preventDefault();
  const inputVal = document.getElementById('budget-amount').value;
  const amount = parseFloat(inputVal);
  if (inputVal === '' || isNaN(amount) || amount < 0) return;

  state.budget = amount;
  persistState();
  closeBudgetModal();
  navigateTo(state.currentPage);
}

// ===== EXPORT CSV =====

function exportCSV() {
  if (state.transactions.length === 0) {
    alert('No transactions to export.');
    return;
  }

  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount'];
  const rows = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => {
      const cat = getCategoryById(t.category);
      return [
        t.date,
        t.type.charAt(0).toUpperCase() + t.type.slice(1),
        cat.label,
        '"' + t.description.replace(/"/g, '""') + '"',
        (t.type === 'expense' ? '-' : '') + t.amount.toFixed(2)
      ].join(',');
    });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'fintrack_transactions_' + todayStr() + '.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// ===== POPULATE FILTER CATEGORY DROPDOWN =====

function populateFilterCategories() {
  const select = document.getElementById('filter-category');
  select.innerHTML = '<option value="all">All Categories</option>';
  [...CATEGORIES.expense, ...CATEGORIES.income].forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    select.appendChild(opt);
  });
}

// ===== EVENT DELEGATION & SETUP =====

function setupEventListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Bottom nav
  document.querySelectorAll('.bottom-nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // "View All" / "View Details" buttons that navigate
  document.querySelectorAll('.btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Theme toggle
  document.getElementById('theme-toggle-sidebar').addEventListener('click', toggleTheme);

  // FABs — open add transaction modal
  document.getElementById('add-txn-fab').addEventListener('click', () => openTransactionModal());
  document.getElementById('add-txn-desktop-fab').addEventListener('click', () => openTransactionModal());

  // Transaction modal events
  document.getElementById('modal-close').addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-form').addEventListener('submit', handleTransactionSubmit);

  // Type toggle buttons in modal
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.txnType = btn.dataset.type;
      updateTypeToggle(btn.dataset.type);
      populateCategoryDropdown(btn.dataset.type, 'txn-category');
    });
  });

  // Delete modal
  document.getElementById('delete-cancel').addEventListener('click', closeDeleteModal);
  document.getElementById('delete-confirm').addEventListener('click', confirmDelete);

  // Budget
  document.getElementById('set-budget-btn').addEventListener('click', openBudgetModal);
  document.getElementById('budget-modal-close').addEventListener('click', closeBudgetModal);
  document.getElementById('budget-form').addEventListener('submit', handleBudgetSubmit);

  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);

  // Search & Filter (Transactions page)
  document.getElementById('search-input').addEventListener('input', debounce(renderTransactions, 250));
  document.getElementById('filter-category').addEventListener('change', renderTransactions);
  document.getElementById('filter-type').addEventListener('change', renderTransactions);
  document.getElementById('filter-date-from').addEventListener('change', renderTransactions);
  document.getElementById('filter-date-to').addEventListener('change', renderTransactions);

  // Analytics month navigation
  document.getElementById('prev-month').addEventListener('click', () => {
    state.analyticsMonth--;
    if (state.analyticsMonth < 0) {
      state.analyticsMonth = 11;
      state.analyticsYear--;
    }
    renderAnalytics();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    state.analyticsMonth++;
    if (state.analyticsMonth > 11) {
      state.analyticsMonth = 0;
      state.analyticsYear++;
    }
    renderAnalytics();
  });

  // Event delegation for edit/delete buttons in transaction list
  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      openTransactionModal(editBtn.dataset.id);
      return;
    }

    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      openDeleteModal(deleteBtn.dataset.id);
      return;
    }
  });

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
        state.editingId = null;
        state.deleteId = null;
      }
    });
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(overlay => {
        if (!overlay.classList.contains('hidden')) {
          overlay.classList.add('hidden');
        }
      });
      state.editingId = null;
      state.deleteId = null;
    }
  });

  // Redraw charts on window resize
  window.addEventListener('resize', debounce(() => {
    if (state.currentPage === 'analytics') {
      renderAnalytics();
    }
  }, 200));
}

/** Simple debounce utility */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ===== INITIALIZATION =====

function init() {
  loadState();
  applyTheme(state.theme);
  populateFilterCategories();

  if (state.user && state.user.pin) {
    // Show login for PIN verification
    showLogin();
    // Pre-fill name but keep it editable
    document.getElementById('login-name').value = state.user.name;
    document.getElementById('login-btn').textContent = 'Unlock / Sign In';
  } else {
    showLogin();
  }

  setupEventListeners();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
