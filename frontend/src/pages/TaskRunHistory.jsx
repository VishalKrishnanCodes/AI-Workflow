// PATH: frontend/src/pages/TaskRunHistory.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Trash2, ChevronDown, ChevronRight, Terminal, FileText } from 'lucide-react'
import { taskRunsApi } from '../api/taskRuns'
import { PageHeader, Badge, Btn, Card, CardHeader, Spinner, Empty } from '../components/shared/UI'
import { format } from 'date-fns'

const STATUS_COLOR = { success:'green', failed:'red', running:'amber', pending:'gray', timeout:'red', cancelled:'gray' }

// Extract the final output from the runner logs
function extractFinalOutput(logs) {
  if (!logs) return null
  const marker = '[runner] Final output:'
  const idx = logs.indexOf(marker)
  if (idx === -1) return null
  const after = logs.slice(idx + marker.length)
  // Everything up to the next [runner] line (or end of string)
  const nextRunner = after.indexOf('\n[runner]')
  const raw = nextRunner === -1 ? after : after.slice(0, nextRunner)
  return raw.trim() || null
}

export default function TaskRunHistory() {
  const [runs,         setRuns]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [filter,       setFilter]       = useState('all')
  const [expandedId,   setExpandedId]   = useState(null)   // logs panel
  const [outputId,     setOutputId]     = useState(null)   // output panel
  const [refreshing,   setRefreshing]   = useState(false)
  const intervalRef = useRef(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await taskRunsApi.list({ limit: 50 })
      setRuns(res.data)
      setBackendError(false)
    } catch {
      setRuns([])
      setBackendError(true)
      toast.error('Unable to load data from backend')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => load(true), 10000)
    return () => clearInterval(intervalRef.current)
  }, [load])

  async function deleteRun(id) {
    if (!confirm('Delete this run record?')) return
    try { await taskRunsApi.delete(id) } catch {}
    setRuns(prev => prev.filter(r => r.id !== id))
    if (expandedId === id) setExpandedId(null)
    if (outputId === id)   setOutputId(null)
    toast.success('Run deleted')
  }

  function toggleLogs(id) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function toggleOutput(e, id) {
    e.stopPropagation()
    setOutputId(prev => prev === id ? null : id)
  }

  const filtered = filter === 'all' ? runs : runs.filter(r => r.status === filter)

  function fmt(iso) {
    if (!iso) return '—'
    try { return format(new Date(iso), 'dd MMM yyyy HH:mm:ss') } catch { return iso }
  }

  function duration(r) {
    if (r.duration_seconds != null) return `${r.duration_seconds}s`
    if (r.started_at && r.finished_at)
      return `${Math.round((new Date(r.finished_at) - new Date(r.started_at)) / 1000)}s`
    return '—'
  }

  const COLS = ['', 'Task Name', 'Schedule', 'Run On', 'Duration', 'Status', 'Exit Code', 'Triggered By', 'Output', '']

  return (
    <div>
      <PageHeader
        title="Task Run History"
        subtitle="Full execution log for every agent task run"
        action={
          <Btn variant="ghost" onClick={() => load(true)} style={{ marginTop: 28 }}>
            {refreshing ? <Spinner size={13} /> : <RefreshCw size={13} />}
            Refresh
          </Btn>
        }
      />

      <div style={{ padding: '20px 32px 32px' }}>

        {/* Summary bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          {[
            { key: 'all',     label: 'All Runs', value: runs.length,                                 color: 'var(--accent)', rawColor: '#4f8ef7' },
            { key: 'success', label: 'Success',  value: runs.filter(r => r.status === 'success').length, color: 'var(--green)',  rawColor: '#22c55e' },
            { key: 'failed',  label: 'Failed',   value: runs.filter(r => r.status === 'failed').length,  color: 'var(--red)',    rawColor: '#ef4444' },
            { key: 'running', label: 'Running',  value: runs.filter(r => r.status === 'running').length, color: 'var(--amber)',  rawColor: '#f59e0b' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              style={{
                background: filter === s.key
                  ? `rgba(${s.rawColor === '#4f8ef7' ? '79,142,247' : s.rawColor === '#22c55e' ? '34,197,94' : s.rawColor === '#ef4444' ? '239,68,68' : '245,158,11'},.12)`
                  : 'var(--bg2)',
                border: `1px solid ${filter === s.key ? s.rawColor + '66' : 'var(--bd)'}`,
                borderRadius: 10, padding: '12px 18px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 3, textAlign: 'left',
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'DM Mono,monospace' }}>{s.label}</span>
              <span style={{ fontFamily: 'Syne,sans-serif', fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader
            title="Run Log"
            right={<span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono,monospace' }}>auto-refresh 10s</span>}
          />

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
          ) : backendError ? (
            <Empty icon="⚠️" message="Unable to load data from backend" />
          ) : filtered.length === 0 ? (
            <Empty icon="📜" message="No runs found" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {COLS.map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono,monospace',
                        textTransform: 'uppercase', letterSpacing: '.8px',
                        borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(run => {
                    const isLogsOpen   = expandedId === run.id
                    const isOutputOpen = outputId   === run.id
                    const finalOutput  = extractFinalOutput(run.logs)
                    const hasOutput    = !!finalOutput

                    return (
                      <React.Fragment key={run.id}>

                        {/* ── Main row ── */}
                        <tr
                          onClick={() => toggleLogs(run.id)}
                          style={{ cursor: 'pointer', borderBottom: (isLogsOpen || isOutputOpen) ? 'none' : '1px solid var(--bd)' }}
                          onMouseOver={e => e.currentTarget.style.background = 'rgba(128,128,128,.05)'}
                          onMouseOut={e  => e.currentTarget.style.background = ''}
                        >
                          {/* Expand logs icon */}
                          <td style={{ padding: '12px 8px 12px 14px', width: 24 }}>
                            {isLogsOpen
                              ? <ChevronDown size={13} color="var(--accent)" />
                              : <ChevronRight size={13} color="var(--muted)" />
                            }
                          </td>

                          {/* Task name */}
                          <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', color: 'var(--text)' }}>
                            {run.task_name || run.task_id?.slice(0, 8) || '—'}
                          </td>

                          {/* Schedule */}
                          <td style={{ padding: '12px 14px' }}>
                            {run.cron_expression ? (
                              <span style={{ background: 'var(--bg3)', border: '1px solid var(--bd)', borderRadius: 5, padding: '2px 8px', fontSize: 11, color: 'var(--cyan)', fontFamily: 'DM Mono,monospace' }}>
                                {run.cron_expression}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>
                            )}
                          </td>

                          {/* Run on */}
                          <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono,monospace', whiteSpace: 'nowrap' }}>
                            {fmt(run.started_at)}
                          </td>

                          {/* Duration */}
                          <td style={{ padding: '12px 14px', fontSize: 12, fontFamily: 'DM Mono,monospace', color: 'var(--text)' }}>
                            {duration(run)}
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 14px' }}>
                            <Badge color={STATUS_COLOR[run.status] || 'gray'} dot>{run.status}</Badge>
                          </td>

                          {/* Exit code */}
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontFamily: 'DM Mono,monospace', fontSize: 12,
                              color: run.exit_code === 0 ? 'var(--green)' : run.exit_code == null ? 'var(--muted)' : 'var(--red)',
                            }}>
                              {run.exit_code ?? '—'}
                            </span>
                          </td>

                          {/* Triggered by */}
                          <td style={{ padding: '12px 14px' }}>
                            <Badge color={run.triggered_by === 'manual' ? 'purple' : 'blue'}>
                              {run.triggered_by || '—'}
                            </Badge>
                          </td>

                          {/* Output button */}
                          <td style={{ padding: '12px 14px' }} onClick={e => toggleOutput(e, run.id)}>
                            <button
                              style={{
                                display: 'flex', alignItems: 'center', gap: 5,
                                background: isOutputOpen
                                  ? 'rgba(245,158,11,.2)'
                                  : hasOutput ? 'rgba(245,158,11,.1)' : 'transparent',
                                border: `1px solid ${isOutputOpen ? 'rgba(245,158,11,.7)' : hasOutput ? 'rgba(245,158,11,.35)' : 'transparent'}`,
                                borderRadius: 6, padding: '4px 10px',
                                fontSize: 11, fontFamily: 'DM Sans,sans-serif', fontWeight: 600,
                                color: hasOutput ? '#f59e0b' : 'var(--muted)',
                                cursor: hasOutput ? 'pointer' : 'default',
                                transition: 'all .15s',
                              }}
                              disabled={!hasOutput}
                              title={hasOutput ? 'Show agent results' : 'No results available'}
                            >
                              <FileText size={11} />
                              {isOutputOpen ? 'Hide Results' : 'Show Results'}
                            </button>
                          </td>

                          {/* Delete */}
                          <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => deleteRun(run.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 6, borderRadius: 6 }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>

                        {/* ── Output panel ── */}
                        {isOutputOpen && (
                          <tr style={{ borderBottom: isLogsOpen ? 'none' : '1px solid var(--bd)' }}>
                            <td colSpan={10} style={{ padding: '0 14px 16px 40px' }}>
                              <div style={{ paddingTop: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                  <FileText size={13} color="var(--accent)" />
                                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'Syne,sans-serif', color: 'var(--text)' }}>
                                    Agent Output
                                  </span>
                                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono,monospace' }}>
                                    {run.task_name || ''}
                                  </span>
                                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono,monospace' }}>
                                    {fmt(run.finished_at)}
                                  </span>
                                </div>
                                <div style={{
                                  background: 'var(--bg2)', border: '1px solid var(--bd)',
                                  borderRadius: 10, padding: '18px 20px',
                                  fontSize: 13, color: 'var(--text)', lineHeight: 1.8,
                                  whiteSpace: 'pre-wrap', fontFamily: 'DM Sans,sans-serif',
                                  maxHeight: 420, overflowY: 'auto',
                                }}>
                                  {finalOutput}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ── Logs panel ── */}
                        {isLogsOpen && (
                          <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                            <td colSpan={10} style={{ padding: '0 14px 16px 40px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingTop: 12 }}>
                                <Terminal size={13} color="var(--accent)" />
                                <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'Syne,sans-serif', color: 'var(--text)' }}>Container Logs</span>
                                {run.docker_image && (
                                  <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono,monospace' }}>
                                    {run.docker_image}
                                  </span>
                                )}
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'DM Mono,monospace' }}>
                                  finished: {fmt(run.finished_at)}
                                </span>
                              </div>

                              <div style={{
                                background: 'var(--bg)', border: '1px solid var(--bd)',
                                borderRadius: 8, padding: '14px 16px',
                                fontFamily: 'DM Mono,monospace', fontSize: 12,
                                lineHeight: 1.8, maxHeight: 340, overflowY: 'auto',
                                color: 'var(--muted)',
                              }}>
                                {run.logs ? (
                                  run.logs.split('\n').map((line, i) => {
                                    let color = 'var(--muted)'
                                    if (line.includes('ERROR') || line.includes('FATAL') || line.includes('Traceback')) color = 'var(--red)'
                                    else if (line.includes('successfully') || line.match(/^\[runner\] Final/)) color = 'var(--green)'
                                    else if (line.startsWith('[runner]')) color = 'var(--accent)'
                                    else if (line.includes('Node:') || line.includes('Tool:')) color = 'var(--cyan)'
                                    return <div key={i} style={{ color }}>{line || '\u00A0'}</div>
                                  })
                                ) : (
                                  <span style={{ color: 'var(--muted)' }}>No logs available</span>
                                )}
                              </div>

                              {run.error_message && (
                                <div style={{
                                  marginTop: 10, background: 'rgba(239,68,68,.07)',
                                  border: '1px solid rgba(239,68,68,.2)', borderRadius: 8,
                                  padding: '10px 14px', color: 'var(--red)',
                                  fontSize: 12, fontFamily: 'DM Mono,monospace',
                                }}>
                                  Error: {run.error_message}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}

                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
