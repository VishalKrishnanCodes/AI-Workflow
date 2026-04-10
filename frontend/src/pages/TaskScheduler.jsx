// PATH: frontend/src/pages/TaskScheduler.jsx
import React, { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Clock, Play, Trash2, Edit, Wand2 } from 'lucide-react'
import { tasksApi } from '../api/tasks'
import { agentsApi } from '../api/agents'
import {
  PageHeader, Badge, Btn, Card, CardHeader,
  Modal, Input, Select, Textarea, Toggle, Spinner, Empty,
} from '../components/shared/UI'

const CRON_PRESETS = [
  { label: 'Every hour',            value: '0 * * * *'   },
  { label: 'Daily at 7 AM',         value: '0 7 * * *'   },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Every Monday at 9 AM',  value: '0 9 * * 1'   },
  { label: 'Every 6 hours',         value: '0 */6 * * *' },
  { label: 'Custom',                value: ''             },
]

// ── Natural language → cron ───────────────────────────────────────────────────
function parseNaturalCron(text) {
  const t = text.toLowerCase().trim()

  // ── helpers ──
  const DAYS = { sun:0, sunday:0, mon:1, monday:1, tue:2, tuesday:2,
                 wed:3, wednesday:3, thu:4, thursday:4, fri:5, friday:5, sat:6, saturday:6 }

  // parse "7pm", "7:30pm", "19:00", "7 pm", "7:30 pm"
  function parseTime(str) {
    const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/)
    if (!m) return null
    let h = parseInt(m[1])
    const min = m[2] ? parseInt(m[2]) : 0
    const meridiem = m[3]
    if (meridiem === 'pm' && h < 12) h += 12
    if (meridiem === 'am' && h === 12) h = 0
    return { h, min }
  }

  // ── every N minutes ──
  const everyMin = t.match(/every\s+(\d+)\s+min/)
  if (everyMin) return `*/${everyMin[1]} * * * *`

  // ── every N hours ──
  const everyHr = t.match(/every\s+(\d+)\s+hour/)
  if (everyHr) return `0 */${everyHr[1]} * * *`

  // ── every hour ──
  if (/every\s+hour/.test(t)) return '0 * * * *'

  // ── every day / daily at <time> ──
  const dailyAt = t.match(/(?:every\s+day|daily)\s+at\s+([\d:apm\s]+)/)
  if (dailyAt) {
    const time = parseTime(dailyAt[1])
    if (time) return `${time.min} ${time.h} * * *`
  }

  // ── at <time> every day ──
  const atEveryDay = t.match(/at\s+([\d:apm\s]+)\s+every\s+day/)
  if (atEveryDay) {
    const time = parseTime(atEveryDay[1])
    if (time) return `${time.min} ${time.h} * * *`
  }

  // ── every weekday at <time> ──
  const weekdayAt = t.match(/every\s+weekday\s+at\s+([\d:apm\s]+)/)
  if (weekdayAt) {
    const time = parseTime(weekdayAt[1])
    if (time) return `${time.min} ${time.h} * * 1-5`
  }

  // ── every weekend at <time> ──
  const weekendAt = t.match(/every\s+weekend\s+at\s+([\d:apm\s]+)/)
  if (weekendAt) {
    const time = parseTime(weekendAt[1])
    if (time) return `${time.min} ${time.h} * * 0,6`
  }

  // ── every <day> at <time> ──
  const dayAt = t.match(/every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\s+at\s+([\d:apm\s]+)/)
  if (dayAt) {
    const dow = DAYS[dayAt[1]]
    const time = parseTime(dayAt[2])
    if (time != null && dow != null) return `${time.min} ${time.h} * * ${dow}`
  }

  // ── at <time> on <day> ──
  const atOnDay = t.match(/at\s+([\d:apm\s]+)\s+on\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)/)
  if (atOnDay) {
    const time = parseTime(atOnDay[1])
    const dow = DAYS[atOnDay[2]]
    if (time != null && dow != null) return `${time.min} ${time.h} * * ${dow}`
  }

  // ── every morning (9am default) ──
  if (/every\s+morning/.test(t)) {
    const time = parseTime(t) || { h: 9, min: 0 }
    return `${time.min} ${time.h} * * *`
  }

  // ── every night / every evening (8pm default) ──
  if (/every\s+(night|evening)/.test(t)) {
    const time = parseTime(t) || { h: 20, min: 0 }
    return `${time.min} ${time.h} * * *`
  }

  // ── midnight ──
  if (/midnight/.test(t)) return '0 0 * * *'

  // ── noon ──
  if (/noon/.test(t)) return '0 12 * * *'

  // ── bare time with no other context → daily at that time ──
  const bareTime = t.match(/^(?:at\s+)?([\d]{1,2}(?::\d{2})?\s*(?:am|pm))$/)
  if (bareTime) {
    const time = parseTime(bareTime[1])
    if (time) return `${time.min} ${time.h} * * *`
  }

  return null
}

// Human-readable description of a cron expression
function describeCron(expr) {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr
  const [min, hour, dom, month, dow] = parts
  if (min === '*' && hour === '*') return 'Every minute'
  if (min.startsWith('*/')) return `Every ${min.slice(2)} minutes`
  if (hour.startsWith('*/') && min === '0') return `Every ${hour.slice(2)} hours`
  const h = parseInt(hour), m = parseInt(min)
  const timeStr = isNaN(h) ? `${hour}:${min}` :
    `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`
  const DAYS_LABEL = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  if (dow === '*' && dom === '*') return `Daily at ${timeStr}`
  if (dow === '1-5') return `Weekdays at ${timeStr}`
  if (dow === '0,6') return `Weekends at ${timeStr}`
  if (DAYS_LABEL[parseInt(dow)]) return `Every ${DAYS_LABEL[parseInt(dow)]} at ${timeStr}`
  return expr
}

export default function TaskScheduler() {
  const [tasks, setTasks] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    name: '', description: '', agent_id: '', cron_expression: '0 7 * * *', input_prompt: '', status: 'active',
  })
  const [cronPreset, setCronPreset] = useState('0 7 * * *')
  const [nlInput, setNlInput] = useState('')
  const [nlResult, setNlResult] = useState(null) // { cron, label } | null

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
    const payload = { ...form, trigger_type: 'cron', input_payload: { prompt: form.input_prompt } }
    delete payload.input_prompt

    try {
      if (editId) {
        const res = await tasksApi.update(editId, payload)
        setTasks(prev => prev.map(t => t.id === editId ? res.data : t))
        toast.success('Task updated')
      } else {
        const res = await tasksApi.create(payload)
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
      input_prompt: task.input_payload?.prompt || '',
      status: task.status || 'active'
    })
    const isPreset = CRON_PRESETS.find(p => p.value === task.cron_expression)
    setCronPreset(isPreset ? task.cron_expression : '')
    setShowCreate(true)
  }

  function closeModal() {
    setShowCreate(false)
    setEditId(null)
    setForm({ name: '', description: '', agent_id: '', cron_expression: '0 7 * * *', input_prompt: '', status: 'active' })
    setCronPreset('0 7 * * *')
    setNlInput('')
    setNlResult(null)
  }

  function handleNlParse() {
    if (!nlInput.trim()) return
    const cron = parseNaturalCron(nlInput)
    if (cron) {
      setNlResult({ cron, label: describeCron(cron) })
      setForm(f => ({ ...f, cron_expression: cron }))
      setCronPreset('') // switch to custom so the expression is visible
    } else {
      setNlResult({ cron: null, label: null })
      toast.error("Couldn't parse that — try something like \"every day at 7pm\" or \"every Monday at 9am\"")
    }
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
    try { await tasksApi.delete(id) } catch { }
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

  const active = tasks.filter(t => t.status === 'active').length

  return (
    <div>
      <PageHeader
        title="Task Scheduler"
        subtitle="Set up recurring agent tasks with cron expressions"
        action={
          <Btn onClick={() => setShowCreate(true)} style={{ marginTop: 28 }}>
            <Plus size={14} /> Schedule Task
          </Btn>
        }
      />

      <div style={{ padding: '20px 32px 32px' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Total Tasks', value: tasks.length, color: 'var(--accent)' },
            { label: 'Active', value: active, color: 'var(--green)' },
            { label: 'Paused', value: tasks.length - active, color: 'var(--muted)' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg2)', border: '1px solid var(--bd)', borderRadius: 10,
              padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'DM Mono,monospace' }}>{s.label}</span>
              <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Tasks grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
        ) : backendError ? (
          <Empty icon="⚠️" message="Unable to load data from backend" />
        ) : tasks.length === 0 ? (
          <Empty icon="⏰" message="No scheduled tasks yet — create your first one" />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(350px,1fr))', gap: 14 }}>
            {tasks.map(task => (
              <Card key={task.id} style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Syne,sans-serif', fontSize: 15, fontWeight: 700, marginBottom: 2, color: 'var(--text)' }}>
                      {task.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {task.description || 'No description'}
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => openEdit(task)}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4, marginRight: 8 }}
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Cron */}
                <div style={{ background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'DM Mono,monospace', marginBottom: 4 }}>
                    Schedule
                  </div>
                  <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 12, color: 'var(--accent)' }}>
                    {task.cron_expression}
                  </div>
                </div>

                {/* Times */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12, fontSize: 11 }}>
                  <div>
                    <span style={{ color: 'var(--muted)' }}>Last run</span>
                    <div style={{ color: 'var(--text)', fontFamily: 'DM Mono,monospace', fontSize: 10, marginTop: 2 }}>
                      {task.last_run ? new Date(task.last_run).toLocaleDateString() : '—'}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)' }}>Next run</span>
                    <div style={{ color: 'var(--text)', fontFamily: 'DM Mono,monospace', fontSize: 10, marginTop: 2 }}>
                      {task.next_run ? new Date(task.next_run).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Btn size="sm" onClick={() => triggerNow(task.id)}>
                    <Play size={12} /> Run Now
                  </Btn>
                  <Toggle
                    checked={task.status === 'active'}
                    onChange={() => toggleTask(task.id)}
                  />
                  <Badge color={task.status === 'active' ? 'green' : 'gray'}>
                    {task.status === 'active' ? 'active' : 'paused'}
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
          {/* Natural language schedule input */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display:'block', fontSize:11, color:'var(--muted)', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px', fontFamily:'DM Mono,monospace' }}>
              Describe your schedule (optional)
            </label>
            <div style={{ display:'flex', gap:8 }}>
              <input
                value={nlInput}
                onChange={e => { setNlInput(e.target.value); setNlResult(null) }}
                onKeyDown={e => e.key === 'Enter' && handleNlParse()}
                placeholder='e.g. "every day at 7pm" or "every Monday at 9am"'
                style={{
                  flex:1, background:'var(--bg3)', border:'1px solid var(--bd)',
                  borderRadius:8, padding:'9px 13px', color:'var(--text)',
                  fontSize:13, fontFamily:'DM Sans,sans-serif', outline:'none',
                }}
              />
              <button
                onClick={handleNlParse}
                style={{
                  background:'var(--accent)', border:'none', borderRadius:8,
                  padding:'9px 14px', cursor:'pointer', color:'#fff',
                  display:'flex', alignItems:'center', gap:6, fontSize:12,
                  fontFamily:'DM Sans,sans-serif', fontWeight:500, flexShrink:0,
                }}
              >
                <Wand2 size={13}/> Convert
              </button>
            </div>
            {nlResult?.cron && (
              <div style={{
                marginTop:8, background:'rgba(34,197,94,.08)', border:'1px solid rgba(34,197,94,.2)',
                borderRadius:7, padding:'8px 12px', display:'flex', alignItems:'center', gap:10,
              }}>
                <span style={{ fontSize:12, color:'var(--green)', fontFamily:'DM Mono,monospace' }}>
                  {nlResult.cron}
                </span>
                <span style={{ fontSize:11, color:'var(--muted)' }}>→ {nlResult.label}</span>
              </div>
            )}
          </div>

          <Select
            label="Cron Schedule *"
            value={cronPreset}
            onChange={e => {
              setCronPreset(e.target.value)
              setNlResult(null)
              if (e.target.value) setForm(f => ({ ...f, cron_expression: e.target.value }))
            }}
          >
            {CRON_PRESETS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
          {cronPreset === '' && (
            <Input
              label="Cron Expression"
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


