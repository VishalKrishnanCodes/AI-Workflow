// PATH: frontend/src/pages/TaskRunHistory.jsx
//
// Screen 5 — Task Run History
// Features:
//   • Table: Task name | Schedule | Run on | Status | Exit code | Duration
//   • Click any row → expand inline log viewer (full stdout/stderr)
//   • Filter by status (all / success / failed / running)
//   • Delete a run record
//   • Auto-refresh every 10s while any run is in-progress

import React, { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Trash2, ChevronDown, ChevronRight, Terminal } from 'lucide-react'
import { taskRunsApi } from '../api/taskRuns'
import { PageHeader, Badge, Btn, Card, CardHeader, Spinner, Empty } from '../components/shared/UI'
import { format } from 'date-fns'

const STATUS_COLOR = { success:'green', failed:'red', running:'amber', pending:'gray', timeout:'red', cancelled:'gray' }

export default function TaskRunHistory() {
  const [runs,       setRuns]       = useState([])
  const [loading,    setLoading]    = useState(true)
  const [backendError, setBackendError] = useState(false)
  const [filter,     setFilter]     = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef(null)

  const load = useCallback(async (silent=false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await taskRunsApi.list({ limit:50 })
      // Attach task_name from task object if present
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
    // Auto-refresh every 10s
    intervalRef.current = setInterval(() => load(true), 10000)
    return () => clearInterval(intervalRef.current)
  }, [load])

  async function deleteRun(id) {
    if (!confirm('Delete this run record?')) return
    try { await taskRunsApi.delete(id) } catch {}
    setRuns(prev => prev.filter(r => r.id !== id))
    if (expandedId === id) setExpandedId(null)
    toast.success('Run deleted')
  }

  const filtered = filter === 'all' ? runs : runs.filter(r => r.status === filter)

  function fmt(iso) {
    if (!iso) return '—'
    try { return format(new Date(iso), 'dd MMM yyyy HH:mm:ss') } catch { return iso }
  }

  function duration(r) {
    if (r.duration_seconds != null) return `${r.duration_seconds}s`
    if (r.started_at && r.finished_at) {
      return `${Math.round((new Date(r.finished_at)-new Date(r.started_at))/1000)}s`
    }
    return '—'
  }

  return (
    <div>
      <PageHeader
        title="Task Run History"
        subtitle="Full execution log for every agent task run"
        action={
          <Btn variant="ghost" onClick={() => load(true)} style={{ marginTop:28 }}>
            {refreshing ? <Spinner size={13}/> : <RefreshCw size={13}/>}
            Refresh
          </Btn>
        }
      />

      <div style={{ padding:'20px 32px 32px' }}>

        {/* Summary bar */}
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          {[
            { key:'all',     label:'All Runs',  value:runs.length,                                    color:'#4f8ef7' },
            { key:'success', label:'Success',   value:runs.filter(r=>r.status==='success').length,    color:'#22c55e' },
            { key:'failed',  label:'Failed',    value:runs.filter(r=>r.status==='failed').length,     color:'#ef4444' },
            { key:'running', label:'Running',   value:runs.filter(r=>r.status==='running').length,    color:'#f59e0b' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              style={{
                background: filter===s.key ? `rgba(${s.color==='#4f8ef7'?'79,142,247':s.color==='#22c55e'?'34,197,94':s.color==='#ef4444'?'239,68,68':'245,158,11'},.12)` : '#111318',
                border: `1px solid ${filter===s.key ? s.color+'66' : '#23262f'}`,
                borderRadius:10, padding:'12px 18px', cursor:'pointer',
                display:'flex', flexDirection:'column', gap:3, textAlign:'left',
                transition:'all .15s',
              }}
            >
              <span style={{ fontSize:10, color:'#6b7080', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'DM Mono,monospace' }}>{s.label}</span>
              <span style={{ fontFamily:'Syne,sans-serif', fontSize:24, fontWeight:800, color:s.color }}>{s.value}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader
            title="Run Log"
            right={<span style={{ fontSize:12, color:'#6b7080', fontFamily:'DM Mono,monospace' }}>auto-refresh 10s</span>}
          />

          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={28}/></div>
          ) : backendError ? (
            <Empty icon="⚠️" message="Unable to load data from backend" />
          ) : filtered.length === 0 ? (
            <Empty icon="📜" message="No runs found" />
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['','Task Name','Schedule','Run On','Duration','Status','Exit Code','Triggered By',''].map((h,i) => (
                      <th key={i} style={{
                        padding:'10px 14px', textAlign:'left',
                        fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace',
                        textTransform:'uppercase', letterSpacing:'.8px',
                        borderBottom:'1px solid #23262f', whiteSpace:'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(run => {
                    const isExpanded = expandedId === run.id
                    return (
                      <React.Fragment key={run.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : run.id)}
                          style={{ cursor:'pointer', borderBottom: isExpanded ? 'none' : '1px solid #23262f' }}
                          onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                          onMouseOut={e  => e.currentTarget.style.background=''}
                        >
                          {/* Expand icon */}
                          <td style={{ padding:'12px 8px 12px 14px', width:24 }}>
                            {isExpanded
                              ? <ChevronDown size={13} color="#4f8ef7"/>
                              : <ChevronRight size={13} color="#6b7080"/>
                            }
                          </td>

                          {/* Task name */}
                          <td style={{ padding:'12px 14px', fontWeight:600, fontSize:13, whiteSpace:'nowrap' }}>
                            {run.task_name || run.task_id?.slice(0,8) || '—'}
                          </td>

                          {/* Schedule */}
                          <td style={{ padding:'12px 14px' }}>
                            {run.cron_expression ? (
                              <span style={{ background:'#1a1d25', border:'1px solid #23262f', borderRadius:5, padding:'2px 8px', fontSize:11, color:'#06b6d4', fontFamily:'DM Mono,monospace' }}>
                                {run.cron_expression}
                              </span>
                            ) : (
                              <span style={{ fontSize:11, color:'#6b7080' }}>—</span>
                            )}
                          </td>

                          {/* Run on */}
                          <td style={{ padding:'12px 14px', fontSize:12, color:'#6b7080', fontFamily:'DM Mono,monospace', whiteSpace:'nowrap' }}>
                            {fmt(run.started_at)}
                          </td>

                          {/* Duration */}
                          <td style={{ padding:'12px 14px', fontSize:12, fontFamily:'DM Mono,monospace', color:'#e8eaf0' }}>
                            {duration(run)}
                          </td>

                          {/* Status */}
                          <td style={{ padding:'12px 14px' }}>
                            <Badge color={STATUS_COLOR[run.status] || 'gray'} dot>
                              {run.status}
                            </Badge>
                          </td>

                          {/* Exit code */}
                          <td style={{ padding:'12px 14px' }}>
                            <span style={{
                              fontFamily:'DM Mono,monospace', fontSize:12,
                              color: run.exit_code === 0 ? '#22c55e' : run.exit_code == null ? '#6b7080' : '#ef4444',
                            }}>
                              {run.exit_code ?? '—'}
                            </span>
                          </td>

                          {/* Triggered by */}
                          <td style={{ padding:'12px 14px' }}>
                            <Badge color={run.triggered_by==='manual'?'purple':'blue'}>
                              {run.triggered_by || '—'}
                            </Badge>
                          </td>

                          {/* Delete */}
                          <td style={{ padding:'12px 14px' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => deleteRun(run.id)}
                              style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', padding:6, borderRadius:6 }}
                            >
                              <Trash2 size={13}/>
                            </button>
                          </td>
                        </tr>

                        {/* ── Expanded log viewer ── */}
                        {isExpanded && (
                          <tr style={{ borderBottom:'1px solid #23262f' }}>
                            <td colSpan={9} style={{ padding:'0 14px 16px 40px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, paddingTop:12 }}>
                                <Terminal size={13} color="#4f8ef7"/>
                                <span style={{ fontSize:12, fontWeight:600, fontFamily:'Syne,sans-serif' }}>Container Logs</span>
                                {run.docker_image && (
                                  <span style={{ fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace' }}>
                                    {run.docker_image}
                                  </span>
                                )}
                                <span style={{ marginLeft:'auto', fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace' }}>
                                  finished: {fmt(run.finished_at)}
                                </span>
                              </div>

                              <div style={{
                                background:'#0a0b0f', border:'1px solid #23262f',
                                borderRadius:8, padding:'14px 16px',
                                fontFamily:'DM Mono,monospace', fontSize:12,
                                lineHeight:1.8, maxHeight:340, overflowY:'auto',
                                color:'#8b949e',
                              }}>
                                {run.logs ? (
                                  run.logs.split('\n').map((line, i) => {
                                    let color = '#8b949e'
                                    if (line.includes('ERROR') || line.includes('FATAL') || line.includes('Traceback')) color = '#ef4444'
                                    else if (line.includes('successfully') || line.includes('output') || line.match(/^\[runner\] Final/)) color = '#22c55e'
                                    else if (line.startsWith('[runner]')) color = '#4f8ef7'
                                    else if (line.includes('Node:') || line.includes('Tool:')) color = '#06b6d4'
                                    return (
                                      <div key={i} style={{ color }}>
                                        {line || '\u00A0'}
                                      </div>
                                    )
                                  })
                                ) : (
                                  <span style={{ color:'#6b7080' }}>No logs available — expand a completed run to see output</span>
                                )}
                              </div>

                              {run.error_message && (
                                <div style={{
                                  marginTop:10, background:'rgba(239,68,68,.07)',
                                  border:'1px solid rgba(239,68,68,.2)', borderRadius:8,
                                  padding:'10px 14px', color:'#ef4444',
                                  fontSize:12, fontFamily:'DM Mono,monospace',
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