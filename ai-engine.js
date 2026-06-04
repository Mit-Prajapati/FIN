/* ============================================================
   FinTrack — AI Analysis Engine
   Smart Budget Prediction & Financial Insights
   ────────────────────────────────────────────────────────────
   Standalone module (IIFE) with ZERO dependencies on script.js.
   Category labels are resolved via a callback passed at runtime.
   ============================================================ */

const AIEngine = (function () {
  'use strict';

  // ───── Constants ─────
  var STORAGE_KEY = 'fintrack_ai_predictions';
  var MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /** Format number as Indian Rupee (internal) */
  function fmt(n) {
    return '\u20B9' + Math.abs(Math.round(n)).toLocaleString('en-IN');
  }

  // ═══════════════════════════════════════════════════════════
  //  DATA AGGREGATION
  // ═══════════════════════════════════════════════════════════

  /**
   * Build a month-by-month history array from raw transactions.
   * @param {Array} transactions - All user transactions
   * @param {number} [numMonths=12] - How many months to look back
   * @returns {Array<{month,year,label,fullLabel,income,expenses,savings,txnCount}>}
   */
  function getMonthlyHistory(transactions, numMonths) {
    numMonths = numMonths || 12;
    var now = new Date();
    var history = [];

    for (var i = numMonths - 1; i >= 0; i--) {
      var ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var mo  = ref.getMonth();
      var yr  = ref.getFullYear();

      var monthTxns = transactions.filter(function (t) {
        var d = new Date(t.date + 'T00:00:00');
        return d.getMonth() === mo && d.getFullYear() === yr;
      });

      var income = monthTxns
        .filter(function (t) { return t.type === 'income'; })
        .reduce(function (s, t) { return s + t.amount; }, 0);
      var expenses = monthTxns
        .filter(function (t) { return t.type === 'expense'; })
        .reduce(function (s, t) { return s + t.amount; }, 0);

      history.push({
        month:     mo,
        year:      yr,
        label:     MONTH_NAMES[mo].substr(0, 3) + ' ' + yr,
        fullLabel: MONTH_NAMES[mo] + ' ' + yr,
        income:    income,
        expenses:  expenses,
        savings:   income - expenses,
        txnCount:  monthTxns.length
      });
    }
    return history;
  }

  // ═══════════════════════════════════════════════════════════
  //  STATISTICAL HELPERS
  // ═══════════════════════════════════════════════════════════

  /** Average monthly expense (only months with data) */
  function avgExpense(history) {
    var w = history.filter(function (h) { return h.txnCount > 0; });
    return w.length === 0
      ? 0
      : w.reduce(function (s, h) { return s + h.expenses; }, 0) / w.length;
  }

  /** Average monthly income (only months with data) */
  function avgIncome(history) {
    var w = history.filter(function (h) { return h.txnCount > 0; });
    return w.length === 0
      ? 0
      : w.reduce(function (s, h) { return s + h.income; }, 0) / w.length;
  }

  /** Month with highest expenses */
  function highestMonth(history) {
    var w = history.filter(function (h) { return h.expenses > 0; });
    if (w.length === 0) return null;
    return w.reduce(function (mx, h) { return h.expenses > mx.expenses ? h : mx; }, w[0]);
  }

  /** Month with lowest expenses (among months that have expenses) */
  function lowestMonth(history) {
    var w = history.filter(function (h) { return h.expenses > 0; });
    if (w.length === 0) return null;
    return w.reduce(function (mn, h) { return h.expenses < mn.expenses ? h : mn; }, w[0]);
  }

  /** Month-over-month expense growth percentage */
  function expenseGrowth(history) {
    var w = history.filter(function (h) { return h.expenses > 0; });
    if (w.length < 2) return 0;
    var recent = w[w.length - 1].expenses;
    var prev   = w[w.length - 2].expenses;
    return prev === 0 ? 0 : ((recent - prev) / prev) * 100;
  }

  /** Budget utilization percentage */
  function budgetUtil(spent, budget) {
    return budget <= 0 ? 0 : (spent / budget) * 100;
  }

  // ═══════════════════════════════════════════════════════════
  //  CATEGORY TRENDS
  // ═══════════════════════════════════════════════════════════

  /**
   * Compute per-category spending trends over recent months.
   * @param {Array} transactions - All transactions
   * @param {number} [numMonths=3]
   * @returns {Object} { catId: { entries, totalSpent, growth, avgMonthly } }
   */
  function categoryTrends(transactions, numMonths) {
    numMonths = numMonths || 3;
    var now = new Date();
    var buckets = {};

    var expTxns = transactions.filter(function (t) { return t.type === 'expense'; });

    for (var i = numMonths - 1; i >= 0; i--) {
      var ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var mo  = ref.getMonth();
      var yr  = ref.getFullYear();

      expTxns.forEach(function (t) {
        var d = new Date(t.date + 'T00:00:00');
        if (d.getMonth() !== mo || d.getFullYear() !== yr) return;

        if (!buckets[t.category]) buckets[t.category] = {};
        var key = yr + '-' + String(mo).padStart(2, '0');
        buckets[t.category][key] = (buckets[t.category][key] || 0) + t.amount;
      });
    }

    var result = {};
    Object.keys(buckets).forEach(function (catId) {
      var entries = Object.keys(buckets[catId])
        .map(function (k) { return { key: k, total: buckets[catId][k] }; })
        .sort(function (a, b) { return a.key < b.key ? -1 : 1; });

      var totalSpent = entries.reduce(function (s, e) { return s + e.total; }, 0);
      var growth = 0;
      if (entries.length >= 2) {
        var last = entries[entries.length - 1].total;
        var prev = entries[entries.length - 2].total;
        if (prev > 0) growth = ((last - prev) / prev) * 100;
      }

      result[catId] = {
        entries:    entries,
        totalSpent: totalSpent,
        growth:     growth,
        avgMonthly: totalSpent / numMonths
      };
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════
  //  EXPENSE PREDICTION
  // ═══════════════════════════════════════════════════════════

  /**
   * Predict next month's expenses using 3-month rolling average + trend.
   *
   *   Predicted = avg(last 3 months) + trendAdjustment
   *   trendAdjustment = (month3 - month1) / 2
   *
   * Falls back to overall average if fewer than 3 months of data.
   */
  function predictExpense(history) {
    var w = history.filter(function (h) { return h.expenses > 0; });
    if (w.length === 0) return 0;
    if (w.length === 1) return w[0].expenses;

    var recent = w.slice(-3);
    var avg = recent.reduce(function (s, h) { return s + h.expenses; }, 0) / recent.length;

    var trend = 0;
    if (recent.length >= 2) {
      trend = (recent[recent.length - 1].expenses - recent[0].expenses) / (recent.length - 1);
    }
    return Math.max(0, Math.round(avg + trend));
  }

  /** Recommended budget = predicted expense + 15 % safety margin */
  function recommendBudget(predicted) {
    return Math.round(predicted * 1.15);
  }

  /** Savings forecast = average income − predicted expense */
  function forecastSavings(avgInc, predicted) {
    return Math.round(avgInc - predicted);
  }

  // ═══════════════════════════════════════════════════════════
  //  CONFIDENCE SCORE  (0–95 %)
  // ═══════════════════════════════════════════════════════════

  /**
   * Confidence combines:
   *   • Data volume   (up to 40 pts for ≥ 6 months)
   *   • Consistency   (up to 45 pts — lower variance → higher)
   *   • Recency       (up to 10 pts if data is within last month)
   * Capped at 95 %.
   */
  function confidence(history) {
    var w = history.filter(function (h) { return h.txnCount > 0; });
    if (w.length === 0) return 0;
    if (w.length === 1) return 30;

    var vol = Math.min(w.length / 6, 1) * 40;

    var exps = w.map(function (h) { return h.expenses; });
    var mean = exps.reduce(function (s, e) { return s + e; }, 0) / exps.length;
    var consist = 0;
    if (mean > 0) {
      var variance = exps.reduce(function (s, e) { return s + Math.pow(e - mean, 2); }, 0) / exps.length;
      var cv = Math.sqrt(variance) / mean;
      consist = Math.max(0, (1 - cv) * 45);
    }

    var last = w[w.length - 1];
    var now  = new Date();
    var gap  = (now.getFullYear() - last.year) * 12 + (now.getMonth() - last.month);
    var recency = gap <= 1 ? 10 : (gap <= 3 ? 5 : 0);

    return Math.min(95, Math.round(vol + consist + recency));
  }

  // ═══════════════════════════════════════════════════════════
  //  CURRENT MONTH HELPERS
  // ═══════════════════════════════════════════════════════════

  function currentMonthSpent(transactions) {
    var now = new Date();
    return transactions.filter(function (t) {
      var d = new Date(t.date + 'T00:00:00');
      return d.getMonth() === now.getMonth()
          && d.getFullYear() === now.getFullYear()
          && t.type === 'expense';
    }).reduce(function (s, t) { return s + t.amount; }, 0);
  }

  function currentMonthIncome(transactions) {
    var now = new Date();
    return transactions.filter(function (t) {
      var d = new Date(t.date + 'T00:00:00');
      return d.getMonth() === now.getMonth()
          && d.getFullYear() === now.getFullYear()
          && t.type === 'income';
    }).reduce(function (s, t) { return s + t.amount; }, 0);
  }

  // ═══════════════════════════════════════════════════════════
  //  AI INSIGHTS GENERATION
  // ═══════════════════════════════════════════════════════════

  /**
   * @param {Function} getCatLabel - callback(catId) → string
   */
  function generateInsights(history, catTr, budget, transactions, getCatLabel) {
    var ins = [];
    var w = history.filter(function (h) { return h.txnCount > 0; });

    if (w.length === 0) {
      ins.push({ type: 'info', icon: '\uD83D\uDCA1', message: 'Start adding transactions to receive AI-powered financial insights.' });
      return ins;
    }

    // 1. Spending stability / direction
    var gr = expenseGrowth(history);
    if (Math.abs(gr) < 10) {
      ins.push({ type: 'success', icon: '\u2705', message: 'Your spending is stable \u2014 great financial discipline!' });
    } else if (gr > 0) {
      ins.push({ type: 'warning', icon: '\u26A0\uFE0F', message: 'Your expenses increased by ' + Math.round(Math.abs(gr)) + '% compared to last month.' });
    } else {
      ins.push({ type: 'success', icon: '\u2705', message: 'Your expenses decreased by ' + Math.round(Math.abs(gr)) + '% \u2014 nice savings!' });
    }

    // 2. Fastest-growing expense category
    var catEntries = Object.keys(catTr).map(function (k) { return [k, catTr[k]]; });
    var fastGrow = catEntries
      .filter(function (e) { return e[1].growth > 15; })
      .sort(function (a, b) { return b[1].growth - a[1].growth; });

    if (fastGrow.length > 0) {
      ins.push({
        type: 'warning', icon: '\uD83D\uDCA1',
        message: getCatLabel(fastGrow[0][0]) + ' expenses are increasing rapidly (+' + Math.round(fastGrow[0][1].growth) + '%).'
      });
    }

    // 3. Top category > 30 % of income → suggest cutting back
    if (catEntries.length > 0) {
      var topCat = catEntries.sort(function (a, b) { return b[1].totalSpent - a[1].totalSpent; })[0];
      var aInc = avgIncome(history);
      if (aInc > 0 && (topCat[1].avgMonthly / aInc) > 0.3) {
        ins.push({
          type: 'tip', icon: '\uD83D\uDCA1',
          message: 'Consider reducing ' + getCatLabel(topCat[0]) + ' expenses \u2014 it\u2019s over 30% of your income.'
        });
      }
    }

    // 4. Potential savings next month
    var aInc2 = avgIncome(history);
    var pred  = predictExpense(history);
    if (aInc2 > pred && pred > 0) {
      ins.push({ type: 'tip', icon: '\uD83D\uDCA1', message: 'You can save approximately ' + fmt(aInc2 - pred) + ' next month.' });
    }

    // 5. Budget pacing (spending faster than time passing)
    if (budget > 0) {
      var now  = new Date();
      var spent = currentMonthSpent(transactions);
      var util  = budgetUtil(spent, budget);
      var dayProg = (now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100;
      if (util > dayProg + 20) {
        ins.push({ type: 'warning', icon: '\u26A0\uFE0F', message: 'You\u2019re spending faster than the month is progressing. Pace your spending.' });
      }
    }

    // 6. Highest / lowest spending months
    var hi = highestMonth(history);
    var lo = lowestMonth(history);
    if (hi && lo && (hi.month !== lo.month || hi.year !== lo.year)) {
      ins.push({
        type: 'info', icon: '\uD83D\uDCCA',
        message: 'Highest spending: ' + hi.fullLabel + ' (' + fmt(hi.expenses) + '). Lowest: ' + lo.fullLabel + ' (' + fmt(lo.expenses) + ').'
      });
    }

    return ins;
  }

  // ═══════════════════════════════════════════════════════════
  //  SMART ALERTS
  // ═══════════════════════════════════════════════════════════

  function generateAlerts(history, catTr, budget, transactions, getCatLabel) {
    var alerts = [];
    var spent = currentMonthSpent(transactions);

    // 1. Budget > 80 %
    if (budget > 0) {
      var util = budgetUtil(spent, budget);
      if (util >= 100) {
        alerts.push({ severity: 'critical', icon: '\uD83D\uDEA8', message: 'Budget exceeded! You\u2019ve spent ' + fmt(spent) + ' of ' + fmt(budget) + '.' });
      } else if (util >= 80) {
        alerts.push({ severity: 'warning', icon: '\uD83D\uDEA8', message: 'Budget is almost exhausted \u2014 ' + Math.round(util) + '% used.' });
      }
    }

    // 2. Expense spike > 20 %
    var gr = expenseGrowth(history);
    if (gr > 20) {
      alerts.push({ severity: 'warning', icon: '\uD83D\uDEA8', message: 'Expenses increased by ' + Math.round(gr) + '% compared to last month.' });
    }

    // 3. Negative savings (expenses > income this month)
    var inc = currentMonthIncome(transactions);
    if (spent > 0 && inc > 0 && spent > inc) {
      alerts.push({ severity: 'critical', icon: '\uD83D\uDEA8', message: 'Your expenses exceeded your income this month!' });
    }

    // 4. Individual category spikes > 30 %
    Object.keys(catTr).forEach(function (catId) {
      if (catTr[catId].growth > 30) {
        alerts.push({
          severity: 'warning', icon: '\uD83D\uDEA8',
          message: getCatLabel(catId) + ' spending increased by ' + Math.round(catTr[catId].growth) + '%.'
        });
      }
    });

    return alerts;
  }

  // ═══════════════════════════════════════════════════════════
  //  FULL ANALYSIS (single entry point)
  // ═══════════════════════════════════════════════════════════

  /**
   * Run the complete analysis pipeline and persist results.
   * @param {Array}    transactions - state.transactions
   * @param {number}   budget       - state.budget
   * @param {Function} getCatLabel  - callback(catId) → string
   * @returns {Object} analysis result
   */
  function runFullAnalysis(transactions, budget, getCatLabel) {
    var history = getMonthlyHistory(transactions, 12);
    var catTr   = categoryTrends(transactions, 3);

    var predicted   = predictExpense(history);
    var recBudget   = recommendBudget(predicted);
    var aInc        = avgIncome(history);
    var savForecast = forecastSavings(aInc, predicted);
    var conf        = confidence(history);

    var insights = generateInsights(history, catTr, budget, transactions, getCatLabel);
    var alerts   = generateAlerts(history, catTr, budget, transactions, getCatLabel);

    var result = {
      timestamp:          Date.now(),
      predictedExpense:   predicted,
      recommendedBudget:  recBudget,
      savingsForecast:    savForecast,
      confidence:         conf,
      avgMonthlyExpense:  Math.round(avgExpense(history)),
      avgMonthlyIncome:   Math.round(aInc),
      expenseGrowthRate:  Math.round(expenseGrowth(history) * 10) / 10,
      highestMonth:       highestMonth(history),
      lowestMonth:        lowestMonth(history),
      budgetUtilization:  budget > 0 ? Math.round(budgetUtil(currentMonthSpent(transactions), budget)) : 0,
      history:            history,
      categoryTrends:     catTr,
      insights:           insights,
      alerts:             alerts
    };

    save(result);
    return result;
  }

  // ═══════════════════════════════════════════════════════════
  //  LOCAL STORAGE PERSISTENCE
  // ═══════════════════════════════════════════════════════════

  function save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* quota exceeded */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════

  return {
    runFullAnalysis:  runFullAnalysis,
    loadPredictions:  load,
    getMonthlyHistory: getMonthlyHistory,
    predictExpense:   predictExpense,
    recommendBudget:  recommendBudget,
    confidence:       confidence,
    categoryTrends:   categoryTrends
  };
})();
