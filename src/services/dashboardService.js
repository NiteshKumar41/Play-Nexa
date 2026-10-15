import { apiClient } from './apiClient'
import { normalizeDashboardSummary } from './dashboardSummary'

export async function getDashboardSummary() {
  const response = await apiClient.get('/dashboard/summary')
  return normalizeDashboardSummary(response.data)
}
