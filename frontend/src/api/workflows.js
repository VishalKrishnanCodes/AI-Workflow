// PATH: frontend/src/api/workflows.js
//
// API calls for the Workflow Builder page.
// All calls go to the /workflows/* endpoints.

import api from './client'

export const workflowsApi = {
  dryRun:       (data) => api.post('/workflows/dry-run', data),
  save:         (data) => api.post('/workflows/save', data),
  list:         ()     => api.get('/workflows/'),
  get:          (id)   => api.get(`/workflows/${id}`),
  extractCron:  (data) => api.post('/workflows/extract-cron', data),
}