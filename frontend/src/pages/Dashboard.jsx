// PATH: frontend/src/pages/Dashboard.jsx
import React, { useEffect,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Card, CardHeader, Badge, Btn, Spinner } from '../components/shared/UI'
import { ArrowRight } from 'lucide-react'

const DEFAULT_STATS = {
  total_agents:0, active_agents:0, total_tools:0, enabled_tools:0,
  total_tasks:0, active_schedules:0, total_runs:0, successful_runs:0, failed_runs:0,
  recent_runs: [],
}

const STATUS_COLOR = { success:'green', failed:'red', running:'amber', pending:'gray' }

export default function Dashboard() {
  const [stats,   setStats]   = useState(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)
  const nav = useNavigate()
  

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(() => {
        setStats(DEFAULT_STATS)
          toast.error('Unable to load data from backend; please check backend status.')
    })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh' }}><Spinner size={32}/></div>

  const s = stats
  const successPct = s.total_runs ? Math.round((s.successful_runs/s.total_runs)*100) : 0

  const STAT_CARDS = [
    { label:'Total Agents',    value:s.total_agents,     sub:`${s.active_agents} active`,    color:'#4f8ef7',  accent:'rgba(79,142,247,.15)',  to:'/agents'    },
    { label:'Active Tools',    value:s.enabled_tools,    sub:`${s.total_tools} in library`,  color:'#22c55e',  accent:'rgba(34,197,94,.15)',   to:'/tools'     },
    { label:'Cron Schedules',  value:s.active_schedules, sub:`${s.total_tasks} tasks total`, color:'#f59e0b',  accent:'rgba(245,158,11,.15)',  to:'/scheduler' },
    { label:'Success Rate',    value:`${successPct}%`,   sub:`${s.total_runs} total runs`,   color:'#7c3aed',  accent:'rgba(124,58,237,.15)',  to:'/history'   },
  ]

  return (
    <div>
      <div style={{ padding:'28px 32px 0' }}>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:700 }}>Dashboard</h1>
        <p style={{ fontSize:13, color:'#6b7080', marginTop:4 }}>Platform overview</p>
      </div>

      <div style={{ padding:'20px 32px 32px' }}>
        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
          {STAT_CARDS.map(c => (
            <div key={c.label}
              onClick={() => nav(c.to)}
              style={{
                background:'#111318', border:'1px solid #23262f', borderRadius:14,
                padding:'18px 20px', cursor:'pointer', position:'relative', overflow:'hidden',
                transition:'border-color .2s',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor='#2e3240'}
              onMouseOut={e  => e.currentTarget.style.borderColor='#23262f'}
            >
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${c.color},transparent)` }} />
              <div style={{ fontSize:10, color:'#6b7080', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'DM Mono,monospace' }}>{c.label}</div>
              <div style={{ fontFamily:'Syne,sans-serif', fontSize:34, fontWeight:800, color:c.color, margin:'8px 0 4px' }}>{c.value}</div>
              <div style={{ fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace' }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Two column */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Recent runs */}
          <Card>
            <CardHeader title="Recent Runs" right={
              <Btn variant="ghost" size="sm" onClick={() => nav('/history')}>
                View all <ArrowRight size={12}/>
              </Btn>
            }/>
            <div style={{ padding:'8px 0' }}>
              {(s.recent_runs || []).map(r => (
                <div key={r.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 18px' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                    background: r.status==='success'?'#22c55e':r.status==='failed'?'#ef4444':'#f59e0b' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{r.task_name || '—'}</div>
                    <div style={{ fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace', marginTop:1 }}>
                      {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace' }}>{r.duration_seconds}s</div>
                  <Badge color={STATUS_COLOR[r.status]||'gray'}>{r.status}</Badge>
                </div>
              ))} 
            </div>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader title="Quick Actions" />
            <div style={{ padding:16, display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { label:'Create a new agent',       sub:'Set up LLM + tools',           to:'/agents',    color:'#4f8ef7' },
                { label:'Configure tools',           sub:'Enable / disable tool library', to:'/tools',     color:'#22c55e' },
                { label:'Add LLM provider',          sub:'OpenAI, Anthropic, Ollama…',    to:'/llm',       color:'#7c3aed' },
                { label:'Schedule a task',           sub:'Cron or manual trigger',        to:'/scheduler', color:'#f59e0b' },
                { label:'View run history & logs',   sub:'Inspect execution logs',        to:'/history',   color:'#06b6d4' },
              ].map(a => (
                <div key={a.to}
                  onClick={() => nav(a.to)}
                  style={{
                    display:'flex', alignItems:'center', gap:12,
                    background:'#1a1d25', border:'1px solid #23262f',
                    borderRadius:9, padding:'11px 14px', cursor:'pointer',
                    transition:'border-color .15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor='#2e3240'}
                  onMouseOut={e  => e.currentTarget.style.borderColor='#23262f'}
                >
                  <div style={{ width:8, height:8, borderRadius:'50%', background:a.color, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{a.label}</div>
                    <div style={{ fontSize:11, color:'#6b7080', marginTop:1 }}>{a.sub}</div>
                  </div>
                  <ArrowRight size={13} color="#6b7080"/>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}