// PATH: frontend/src/api/agents.js
import api from './client'

export const agentsApi = {
  list:    ()           => api.get('/agents/'),
  get:     (id)         => api.get(`/agents/${id}`),
  create:  (data)       => api.post('/agents/', data),
  update:  (id, data)   => api.put(`/agents/${id}`, data),
  delete:  (id)         => api.delete(`/agents/${id}`),
  toggle:  (id)         => api.patch(`/agents/${id}/toggle`),
  dryRun:  (id, data)   => api.post(`/agents/${id}/dry-run`, data),
}