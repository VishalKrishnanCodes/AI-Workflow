// PATH: frontend/src/api/tools.js
import api from './client'

export const toolsApi = {
  list:   ()          => api.get('/tools/'),
  get:    (id)        => api.get(`/tools/${id}`),
  create: (data)      => api.post('/tools/', data),
  update: (id, data)  => api.put(`/tools/${id}`, data),
  delete: (id)        => api.delete(`/tools/${id}`),
  toggle: (id)        => api.patch(`/tools/${id}/toggle`),
  test:   (id)        => api.post(`/tools/${id}/test`),
}