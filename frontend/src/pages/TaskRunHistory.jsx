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

/* ── Demo data used when backend is offline ── */
const DEMO_RUNS = [
  { id:'r1', task_id:'tk1', task_name:'Daily Market Digest', cron_expression:'0 7 * * 1-5', started_at:'2025-01-15T07:00:12Z', finished_at:'2025-01-15T07:00:54Z', duration_seconds:42, status:'success', exit_code:0, triggered_by:'cron', docker_image:'ai-workflow-agent-runner:latest',
    logs:`[runner] Starting task=tk1 run=r1 agent=a1\n[runner] Fetching http://backend:8000/agents/a1\n[runner] Loaded agent: Research Agent\n[runner] LLM: openai / gpt-4o\n[runner] Tool loaded: web_search\n[runner] Tool loaded: wikipedia\n[runner] LangGraph compiled successfully\n[runner] Executing agent...\n[runner] Node: agent\n[runner] Node: tools  →  web_search("market digest 2025-01-15")\n[runner] Node: agent\n[runner] Node: tools  →  wikipedia("stock market January 2025")\n[runner] Node: agent\n[runner] Final output:\nMarket Digest — 15 Jan 2025:\n• S&P 500 up 0.4% to 4,912\n• NASDAQ gained 0.7%\n• Key driver: positive CPI data released this morning\n• Top movers: NVDA +3.2%, TSLA -1.1%\n[runner] Task completed successfully\n` },

  { id:'r2', task_id:'tk2', task_name:'Weekly Code Audit', cron_expression:'0 9 * * 1', started_at:'2025-01-13T09:00:05Z', finished_at:'2025-01-13T09:01:32Z', duration_seconds:87, status:'success', exit_code:0, triggered_by:'cron', docker_image:'ai-workflow-agent-runner:latest',
    logs:`[runner] Starting task=tk2 run=r2 agent=a2\n[runner] Fetching http://backend:8000/agents/a2\n[runner] Loaded agent: Code Review Agent\n[runner] LLM: anthropic / claude-3-5-sonnet-20241022\n[runner] Tool loaded: python_repl\n[runner] LangGraph compiled successfully\n[runner] Executing agent...\n[runner] Node: agent\n[runner] Node: tools  →  python_repl("import ast; tree = ast.parse(open('main.py').read())")\n[runner] Node: agent  →  Detected 2 style issues, 0 critical bugs\n[runner] Final output:\nCode Review Complete:\n✅ No critical security vulnerabilities\n⚠️  2 style issues found\n   - Line 14: ambiguous variable name\n   - Line 58: missing type annotation\n💡 Suggestion: Add unit tests for the payment module\n[runner] Task completed successfully\n` },

  { id:'r3', task_id:'tk1', task_name:'Daily Market Digest', cron_expression:'0 7 * * 1-5', started_at:'2025-01-14T07:00:08Z', finished_at:'2025-01-14T07:00:20Z', duration_seconds:12, status:'failed', exit_code:1, triggered_by:'cron', docker_image:'ai-workflow-agent-runner:latest',
    logs:`[runner] Starting task=tk1 run=r3 agent=a1\n[runner] Fetching http://backend:8000/agents/a1\n[runner] Loaded agent: Research Agent\n[runner] LLM: openai / gpt-4o\n[runner] Tool loaded: web_search\n[runner] LangGraph compiled successfully\n[runner] Executing agent...\n[runner] Node: agent\n[runner] Node: tools  →  web_search("market digest 2025-01-14")\nERROR: RateLimitError: You exceeded your current quota.\n        Please check your plan and billing details.\n[runner] FATAL ERROR: LLM API rate limit exceeded\nTraceback (most recent call last):\n  File "run_agent.py", line 87, in main\n    async for event in graph.astream(...):\n  File "langchain_openai/chat_models.py", line 412\n    raise RateLimitError(message)\nopenai.RateLimitError: Rate limit exceeded\n` },

  { id:'r4', task_id:'tk3', task_name:'Ad-hoc Analysis', cron_expression:null, started_at:'2025-01-10T14:23:00Z', finished_at:'2025-01-10T14:25:10Z', duration_seconds:130, status:'success', exit_code:0, triggered_by:'manual', docker_image:'ai-workflow-agent-runner:latest',
    logs:`[runner] Starting task=tk3 run=r4 agent=a3\n[runner] Fetching http://backend:8000/agents/a3\n[runner] Loaded agent: Data Analyst Agent\n[runner] LLM: openai / gpt-4o\n[runner] Tool loaded: python_repl\n[runner] Tool loaded: web_search\n[runner] LangGraph compiled successfully\n[runner] Executing agent...\n[runner] Node: agent\n[runner] Node: tools  →  python_repl("import pandas as pd; df = pd.read_csv('sales.csv'); print(df.describe())")\ncount    1245.000000\nmean       42.312000\nstd         8.739812\nmin        12.000000\n25%        36.000000\n50%        43.000000\n75%        49.000000\nmax        78.000000\n[runner] Node: agent  →  Analysing Q3 anomaly...\n[runner] Node: tools  →  python_repl("df[df['quarter']=='Q3'].groupby('region').sum()")\n[runner] Final output:\nData Analysis Complete:\n• 1,245 records processed\n• Mean value: 42.3 (σ = 8.7)\n• Q3 spike detected in North region (+34% vs avg)\n• Recommendation: Investigate North region supply chain\n[runner] Task completed successfully\n` },

  { id:'r5', task_id:'tk1', task_name:'Daily Market Digest', cron_expression:'0 7 * * 1-5', started_at:'2025-01-13T07:00:10Z', finished_at:'2025-01-13T07:00:48Z', duration_seconds:38, status:'success', exit_code:0, triggered_by:'cron', docker_image:'ai-workflow-agent-runner:latest',
    logs:`[runner] Starting task=tk1 run=r5 agent=a1\n[runner] Loaded agent: Research Agent\n[runner] Tool loaded: web_search\n[runner] Tool loaded: wikipedia\n[runner] LangGraph compiled successfully\n[runner] Executing agent...\n[runner] Node: agent\n[runner] Node: tools  →  web_search("market digest 2025-01-13")\n[runner] Node: agent\n[runner] Final output:\nMarket Digest — 13 Jan 2025:\n• S&P 500 closed at 4,890 (+0.2%)\n• Bond yields steady at 4.3%\n• Fed minutes released — no rate changes expected Q1\n[runner] Task completed successfully\n` },
]

export default function TaskRunHistory() {
  const [runs,       setRuns]       = useState([])
  const [loading,    setLoading]    = useState(true)
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
    } catch {
      setRuns(DEMO_RUNS)
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