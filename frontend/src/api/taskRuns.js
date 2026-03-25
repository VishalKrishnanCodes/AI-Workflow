// PATH: frontend/src/api/taskRuns.js
import api from './client'

export const taskRunsApi = {
  list:   (params)  => api.get('/task-runs/', { params }),   // ?task_id=&skip=&limit=
  get:    (id)      => api.get(`/task-runs/${id}`),          // full logs for one run
  delete: (id)      => api.delete(`/task-runs/${id}`),
}