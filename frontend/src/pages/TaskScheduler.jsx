// PATH: frontend/src/pages/TaskScheduler.jsx
//
// Screen 4 — Task Scheduler
// Features:
//   • List all scheduled tasks
//   • Create a new scheduled task (name, cron expression, agent to run, input prompt)
//   • Edit task cron schedule
//   • View next run time
//   • Pause / Resume schedule
//   • Manual trigger a run
//   • Delete a task

import React, { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Clock, Play, Pause, Trash2, Edit } from 'lucide-react'
import { tasksApi } from '../api/tasks'
import { agentsApi } from '../api/agents'
import {
  PageHeader, Badge, Btn, Card, CardHeader,
  Modal, Input, Select, Textarea, Toggle, Spinner, Empty,
} from '../components/shared/UI'

const CRON_PRESETS = [
  { label:'Every hour', value:'0 * * * *' },
  { label:'Daily at 7 AM', value:'0 7 * * *' },
  { label:'Every weekday at 9 AM', value:'0 9 * * 1-5' },
  { label:'Every Monday at 9 AM', value:'0 9 * * 1' },
  { label:'Every 6 hours', value:'0 */6 * * *' },
  { label:'Custom', value:'' },
]

export default function TaskScheduler() {
  const [tasks,       setTasks]       = useState([])
  const [agents,      setAgents]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [editId,      setEditId]      = useState(null)
  const [form,        setForm]        = useState({
    name:'', description:'', agent_id:'', cron_expression:'0 7 * * *', input_prompt:'', is_active:true,
  })
  const [cronPreset, setCronPreset] = useState('0 7 * * *')

  const load = useCallback(async () => {
    try {
      const [tk, ag] = await Promise.all([tasksApi.list(), agentsApi.list()])
      setTasks(tk.data)
      setAgents(ag.data)
      setBackendError(false)
    } catch {
      setTasks([])
      setAgents([])
      setBackendError(true)
      toast.error('Unable to load data from backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveTask() {
    if (!form.name.trim()) return toast.error('Task name is required')
    if (!form.agent_id) return toast.error('Select an agent')
    if (!form.cron_expression.trim()) return toast.error('Cron expression is required')
    try {
      if (editId) {
        const res = await tasksApi.update(editId, form)
        setTasks(prev => prev.map(t => t.id === editId ? res.data : t))
        toast.success('Task updated')
      } else {
        const res = await tasksApi.create(form)
        setTasks(prev => [res.data, ...prev])
        toast.success('Task scheduled')
      }
    } catch {
      toast.error(`Unable to ${editId ? 'update' : 'schedule'} task: backend unavailable`)
    }
    closeModal()
  }

  function openEdit(task) {
    setEditId(task.id)
    setForm({
      name: task.name || '',
      description: task.description || '',
      agent_id: task.agent_id || '',
      cron_expression: task.cron_expression || '0 7 * * *',
      input_prompt: task.input_prompt || '',
      is_active: task.is_active !== undefined ? task.is_active : true
    })
    const isPreset = CRON_PRESETS.find(p => p.value === task.cron_expression)
    setCronPreset(isPreset ? task.cron_expression : '')
    setShowCreate(true)
  }

  function closeModal() {
    setShowCreate(false)
    setEditId(null)
    setForm({ name:'', description:'', agent_id:'', cron_expression:'0 7 * * *', input_prompt:'', is_active:true })
    setCronPreset('0 7 * * *')
  }

  async function toggleTask(id) {
    try {
      const res = await tasksApi.toggle(id)
      setTasks(prev => prev.map(t => t.id === id ? res.data : t))
      toast.success('Task updated')
    } catch {
      toast.error('Unable to update task: backend unavailable')
    }
  }

  async function deleteTask(id) {
    if (!confirm('Delete this task?')) return
    try { await tasksApi.delete(id) } catch {}
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success('Task deleted')
  }

  async function triggerNow(id) {
    try {
      await tasksApi.trigger(id)
      toast.success('Task triggered!')
    } catch {
      toast.error('Unable to trigger task: backend unavailable')
    }
  }

  const active = tasks.filter(t => t.is_active).length

  return (
    <div>
      <PageHeader
        title="Task Scheduler"
        subtitle="Set up recurring agent tasks with cron expressions"
        action={
          <Btn onClick={() => setShowCreate(true)} style={{ marginTop:28 }}>
            <Plus size={14} /> Schedule Task
          </Btn>
        }
      />

      <div style={{ padding:'20px 32px 32px' }}>
        {/* Stats */}
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          {[
            { label:'Total Tasks', value: tasks.length, color:'#4f8ef7' },
            { label:'Active', value: active, color:'#22c55e' },
            { label:'Paused', value: tasks.length - active, color:'#6b7080' },
          ].map(s => (
            <div key={s.label} style={{
              background:'#111318', border:'1px solid #23262f', borderRadius:10,
              padding:'12px 18px', display:'flex', flexDirection:'column', gap:3,
            }}>
              <span style={{ fontSize:10, color:'#6b7080', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'DM Mono,monospace' }}>{s.label}</span>
              <span style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Tasks grid */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={28} /></div>
        ) : backendError ? (
          <Empty icon="⚠️" message="Unable to load data from backend" />
        ) : tasks.length === 0 ? (
          <Empty icon="⏰" message="No scheduled tasks yet — create your first one" />
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(350px,1fr))', gap:14 }}>
            {tasks.map(task => (
              <Card key={task.id} style={{ padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, marginBottom:2 }}>
                      {task.name}
                    </div>
                    <div style={{ fontSize:12, color:'#6b7080' }}>
                      {task.description || 'No description'}
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => openEdit(task)}
                      style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', padding:4, marginRight: 8 }}
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', padding:4 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Cron */}
                <div style={{ background:'#1a1d25', border:'1px solid #23262f', borderRadius:8, padding:'10px 12px', marginBottom:12 }}>
                  <div style={{ fontSize:10, color:'#6b7080', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'DM Mono,monospace', marginBottom:4 }}>
                    Schedule
                  </div>
                  <div style={{ fontFamily:'DM Mono,monospace', fontSize:12, color:'#4f8ef7' }}>
                    {task.cron_expression}
                  </div>
                </div>

                {/* Times */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12, fontSize:11 }}>
                  <div>
                    <span style={{ color:'#6b7080' }}>Last run</span>
                    <div style={{ color:'#e8eaf0', fontFamily:'DM Mono,monospace', fontSize:10, marginTop:2 }}>
                      {task.last_run ? new Date(task.last_run).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color:'#6b7080' }}>Next run</span>
                    <div style={{ color:'#e8eaf0', fontFamily:'DM Mono,monospace', fontSize:10, marginTop:2 }}>
                      {task.next_run ? new Date(task.next_run).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <Btn size="sm" onClick={() => triggerNow(task.id)}>
                    <Play size={12} /> Run Now
                  </Btn>
                  <Toggle
                    checked={task.is_active}
                    onChange={() => toggleTask(task.id)}
                  />
                  <Badge color={task.is_active ? 'green' : 'gray'}>
                    {task.is_active ? 'active' : 'paused'}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showCreate && (
        <Modal
          title={editId ? "Edit Task" : "Schedule a Task"}
          onClose={closeModal}
          width={540}
          footer={
            <>
              <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={saveTask}>{editId ? "Update" : "Schedule"}</Btn>
            </>
          }
        >
          <Input
            label="Task Name *"
            placeholder="e.g. Daily Market Digest"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Description"
            placeholder="What does this task do?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <Select
            label="Agent *"
            value={form.agent_id}
            onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}
          >
            <option value="">Select an agent</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
          <Select
            label="Cron Schedule *"
            value={cronPreset}
            onChange={e => {
              setCronPreset(e.target.value)
              if (e.target.value) setForm(f => ({ ...f, cron_expression: e.target.value }))
            }}
          >
            {CRON_PRESETS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
          {cronPreset === '' && (
            <Input
              label="Custom Cron Expression"
              placeholder="0 7 * * * — see crontab.guru"
              value={form.cron_expression}
              onChange={e => setForm(f => ({ ...f, cron_expression: e.target.value }))}
            />
          )}
          <Textarea
            label="Input Prompt (what to send to the agent)"
            placeholder="Describe what the agent should do when this task runs..."
            rows={4}
            value={form.input_prompt}
            onChange={e => setForm(f => ({ ...f, input_prompt: e.target.value }))}
          />
        </Modal>
      )}
    </div>
  )
}


