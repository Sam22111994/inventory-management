// Restocking recommendation logic (pure functions, no Vue or API dependencies).
// All monetary values are in USD; the UI converts for display.

// Slider geometry. The slider model is a step INDEX (0..BUDGET_STEPS), not a
// currency amount, so it is locale independent: formatCurrency() converts the
// resulting USD value at the fixed 150 JPY/USD rate, which turns the $1,000 step
// into exactly 150,000 yen and the $50,000 maximum into 7,500,000 yen.
export const BUDGET_STEP_USD = 1000
export const BUDGET_STEPS = 50

export function budgetFromStep(stepIndex) {
  return stepIndex * BUDGET_STEP_USD
}

/**
 * Recommend restock quantities for a budget.
 *
 * Only items whose forecast exceeds current demand (gap > 0) are candidates.
 * They are ranked by gap, largest first, then filled greedily.
 *
 * @param {Array} forecasts - demand forecasts with unit_cost and lead_time_days
 * @param {number} budgetUsd - available budget in USD
 * @returns {{items: Array, totalCost: number, remaining: number}}
 */
export function buildRecommendations(forecasts, budgetUsd) {
  const candidates = forecasts
    .map(f => ({ forecast: f, gap: f.forecasted_demand - f.current_demand }))
    .filter(c => c.gap > 0 && c.forecast.unit_cost > 0)
    // Stable tie-break on SKU so equal gaps always render in the same order
    .sort((a, b) => b.gap - a.gap || a.forecast.item_sku.localeCompare(b.forecast.item_sku))

  const items = []
  let remaining = budgetUsd

  for (const { forecast, gap } of candidates) {
    // "Maximum useful quantity": never order more than the demand gap (extra
    // units would not be needed) and never more than the remaining budget buys.
    // Divide in whole cents: with fractional costs (18.99, 92.50) a plain float
    // division can land just under an exact integer and under-buy by one unit.
    const affordable = Math.floor(Math.round(remaining * 100) / Math.round(forecast.unit_cost * 100))
    const qty = Math.min(gap, affordable)

    // Deliberately `continue`, not `break`: an item that is too expensive for
    // the leftover budget must not block cheaper, lower-ranked items that fit.
    if (qty <= 0) continue

    const lineTotal = roundCents(qty * forecast.unit_cost)
    items.push({
      sku: forecast.item_sku,
      name: forecast.item_name,
      trend: forecast.trend,
      gap,
      unitCost: forecast.unit_cost,
      qty,
      lineTotal,
      leadTimeDays: forecast.lead_time_days
    })
    remaining = roundCents(remaining - lineTotal)
  }

  const totalCost = roundCents(items.reduce((sum, i) => sum + i.lineTotal, 0))
  return { items, totalCost, remaining }
}

/**
 * An order is only complete when its slowest line arrives, so the order-level
 * lead time is the MAXIMUM line lead time, not the average or sum.
 */
export function orderLeadTimeDays(items) {
  // A missing or non-numeric lead time counts as 0 rather than producing NaN,
  // which would make the expected-delivery Date invalid and throw on toISOString().
  return items.reduce((max, i) => Math.max(max, Number.isFinite(i.leadTimeDays) ? i.leadTimeDays : 0), 0)
}

// Avoid floating point drift (e.g. 18.99 * 3) accumulating across lines
function roundCents(value) {
  return Math.round(value * 100) / 100
}
