// PATH: frontend/src/api/workflows.js
//
// API calls for the Workflow Builder page.
// All calls go to the /workflows/* endpoints.

import api from './client'

export const workflowsApi = {
  // Run a workflow config as a dry run (without saving)
  dryRun:  (data)   => api.post('/workflows/dry-run', data),

  // Save a workflow as a draft task
  save:    (data)   => api.post('/workflows/save', data),

  // List all saved workflow-tasks
  list:    ()       => api.get('/workflows/'),

  // Get a single saved workflow by its task ID
  get:     (id)     => api.get(`/workflows/${id}`),
}