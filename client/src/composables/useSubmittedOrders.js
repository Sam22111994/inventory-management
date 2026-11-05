import { ref, readonly } from 'vue'
import { orderLeadTimeDays } from '../utils/restocking'

// Shared in-memory store for submitted restocking orders (singleton, same
// pattern as useFilters). Survives route changes but is intentionally cleared
// on page refresh: the demo has no backend POST endpoints.
const submittedOrders = ref([])
let sequence = 0

export function useSubmittedOrders() {
  /**
   * Record a restocking order. Money is stored in USD and converted at display time.
   * @param {Array} items - recommendation lines from buildRecommendations()
   * @param {number} totalCost - USD total of all lines
   * @returns {object} the stored order
   */
  const addOrder = (items, totalCost) => {
    const submittedAt = new Date()
    const leadTimeDays = orderLeadTimeDays(items)

    // Expected delivery = submission date + the slowest line's lead time
    const expectedDelivery = new Date(submittedAt)
    expectedDelivery.setDate(expectedDelivery.getDate() + leadTimeDays)

    sequence += 1
    const order = {
      id: `RST-${submittedAt.getFullYear()}-${String(sequence).padStart(4, '0')}`,
      submittedAt: submittedAt.toISOString(),
      // Copy lines so later changes to the recommendation list can't alter the order
      items: items.map(i => ({ ...i })),
      totalCost,
      leadTimeDays,
      expectedDelivery: expectedDelivery.toISOString(),
      status: 'Submitted'
    }

    // Newest first
    submittedOrders.value.unshift(order)
    return order
  }

  return {
    submittedOrders: readonly(submittedOrders),
    addOrder
  }
}
