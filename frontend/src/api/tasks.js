// PATH: frontend/src/api/tasks.js
import api from './client'

export const tasksApi = {
  list:    ()          => api.get('/tasks/'),
  get:     (id)        => api.get(`/tasks/${id}`),
  create:  (data)      => api.post('/tasks/', data),
  update:  (id, data)  => api.put(`/tasks/${id}`, data),
  delete:  (id)        => api.delete(`/tasks/${id}`),
  toggle:  (id)        => api.patch(`/tasks/${id}/toggle`),
  trigger: (id)        => api.post(`/tasks/${id}/trigger`),
}