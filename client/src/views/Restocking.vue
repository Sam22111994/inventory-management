<template>
  <div class="restocking">
    <div class="page-header">
      <h2>{{ t('restocking.title') }}</h2>
      <p>{{ t('restocking.description') }}</p>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div v-if="placedOrder" class="success-banner" role="status">
        <span>{{ t('restocking.orderPlaced', { orderNumber: placedOrder.id, days: placedOrder.leadTimeDays }) }}</span>
        <router-link to="/orders" class="banner-link">{{ t('restocking.viewOrders') }}</router-link>
      </div>

      <div class="card budget-card">
        <div class="budget-header">
          <span class="budget-label">{{ t('restocking.budget') }}</span>
          <span class="budget-value">{{ formatCurrency(budgetUsd, currentCurrency) }}</span>
        </div>
        <!-- The model is a step index; the currency conversion happens only at display time -->
        <input
          v-model.number="stepIndex"
          type="range"
          class="budget-slider"
          min="0"
          :max="BUDGET_STEPS"
          step="1"
          :aria-label="t('restocking.budgetSlider')"
          :aria-valuetext="formatCurrency(budgetUsd, currentCurrency)"
          :style="{ '--fill': sliderFillPercent }"
          @input="placedOrder = null"
        />
        <div class="slider-labels">
          <span>{{ formatCurrency(0, currentCurrency) }}</span>
          <span>{{ formatCurrency(budgetFromStep(BUDGET_STEPS), currentCurrency) }}</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card info">
          <div class="stat-label">{{ t('restocking.budget') }}</div>
          <div class="stat-value">{{ formatCurrencyWithDecimals(budgetUsd, currentCurrency, 2) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('restocking.totalCost') }}</div>
          <div class="stat-value">{{ formatCurrencyWithDecimals(recommendation.totalCost, currentCurrency, 2) }}</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">{{ t('restocking.remainingBudget') }}</div>
          <div class="stat-value">{{ formatCurrencyWithDecimals(recommendation.remaining, currentCurrency, 2) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{{ t('restocking.itemsRecommended') }}</div>
          <div class="stat-value">{{ recommendation.items.length }}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">{{ t('restocking.recommendations') }} ({{ recommendation.items.length }})</h3>
          <button
            type="button"
            class="place-order-btn"
            :disabled="recommendation.items.length === 0"
            @click="placeOrder"
          >
            {{ t('restocking.placeOrder') }}
          </button>
        </div>

        <div v-if="recommendation.items.length === 0" class="empty-state">
          {{ t('restocking.noRecommendations') }}
        </div>
        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>{{ t('restocking.table.sku') }}</th>
                <th>{{ t('restocking.table.itemName') }}</th>
                <th>{{ t('restocking.table.trend') }}</th>
                <th>{{ t('restocking.table.demandGap') }}</th>
                <th>{{ t('restocking.table.unitCost') }}</th>
                <th>{{ t('restocking.table.quantity') }}</th>
                <th>{{ t('restocking.table.lineTotal') }}</th>
                <th>{{ t('restocking.table.leadTime') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in recommendation.items" :key="item.sku">
                <td><strong>{{ item.sku }}</strong></td>
                <td>{{ translateProductName(item.name) }}</td>
                <td>
                  <span :class="['badge', item.trend]">{{ t('trends.' + item.trend) }}</span>
                </td>
                <td>{{ item.gap }}</td>
                <td>{{ formatCurrencyWithDecimals(item.unitCost, currentCurrency, 2) }}</td>
                <td><strong>{{ item.qty }}</strong></td>
                <td><strong>{{ formatCurrencyWithDecimals(item.lineTotal, currentCurrency, 2) }}</strong></td>
                <td>{{ t('restocking.days', { count: item.leadTimeDays }) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../api'
import { useI18n } from '../composables/useI18n'
import { useSubmittedOrders } from '../composables/useSubmittedOrders'
import { formatCurrency, formatCurrencyWithDecimals } from '../utils/currency'
import { BUDGET_STEPS, budgetFromStep, buildRecommendations } from '../utils/restocking'

const { t, currentCurrency, translateProductName } = useI18n()
const { addOrder } = useSubmittedOrders()

const loading = ref(true)
const error = ref(null)
const forecasts = ref([])
const stepIndex = ref(0)
const placedOrder = ref(null)

const budgetUsd = computed(() => budgetFromStep(stepIndex.value))
const recommendation = computed(() => buildRecommendations(forecasts.value, budgetUsd.value))

// Filled portion of the slider track, as a percentage string
const sliderFillPercent = computed(() => `${(stepIndex.value / BUDGET_STEPS) * 100}%`)

const loadForecasts = async () => {
  try {
    loading.value = true
    error.value = null
    forecasts.value = await api.getDemandForecasts()
  } catch (err) {
    error.value = t('restocking.loadError')
    console.error('Load error:', err)
  } finally {
    loading.value = false
  }
}

const placeOrder = () => {
  if (recommendation.value.items.length === 0) return
  placedOrder.value = addOrder(recommendation.value.items, recommendation.value.totalCost)
  // Reset after storing; the banner is cleared only by user @input on the slider,
  // so this programmatic reset does not dismiss it.
  stepIndex.value = 0
}

onMounted(loadForecasts)
</script>

<style scoped>
.success-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  background: #d1fae5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.938rem;
  font-weight: 500;
}

.banner-link {
  color: #065f46;
  font-weight: 700;
  text-decoration: underline;
  white-space: nowrap;
}

.budget-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 1rem;
}

.budget-label {
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.budget-value {
  font-size: 2.25rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}

.budget-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(to right, #2563eb 0%, #2563eb var(--fill, 0%), #e2e8f0 var(--fill, 0%), #e2e8f0 100%);
}

.budget-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #2563eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
}

.budget-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #2563eb;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
}

.budget-slider:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 4px;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.813rem;
  color: #64748b;
}

.place-order-btn {
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.place-order-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.place-order-btn:disabled {
  background: #cbd5e1;
  color: #64748b;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #64748b;
  font-size: 0.938rem;
}
</style>
