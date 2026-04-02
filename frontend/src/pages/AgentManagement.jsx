// PATH: frontend/src/pages/AgentManagement.jsx
//
// Screen 1 — Agent Management
// Features:
//   • List all agents in cards
//   • Create agent (modal) with name, description, system prompt,
//     LLM picker, and TOOL SELECTION (multi-select chips)
//   • Enable / Disable toggle per agent
//   • Select an agent to use its dry-run panel
//   • Dry Run panel at the bottom: type a prompt → see LangGraph steps + output

import React, { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Play, Zap, Bot, Trash2, Edit } from 'lucide-react'
import { agentsApi } from '../api/agents'
import { toolsApi }  from '../api/tools'
import { skillsApi } from '../api/skills'
import api from '../api/client'
import {
  PageHeader, Badge, Btn, Card, CardHeader,
  Modal, Input, Select, Textarea, Toggle, Spinner, Empty,
} from '../components/shared/UI'

/* ── Status → badge colour ── */
const STATUS_COLOR = { active:'green', inactive:'gray', draft:'amber' }

/* ── Built-in tools always available for demo ── */
// For production we only show backend-provided tools; no hardcoded builtin tools.

export default function AgentManagement() {
  const [agents,       setAgents]       = useState([])
  const [tools,        setTools]        = useState([])
  const [skills,       setSkills]       = useState([])
  const [llmConfigs,  setLlmConfigs]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [selectedAgent,setSelectedAgent]= useState(null)

  // Dry-run state
  const [prompt,       setPrompt]       = useState('')
  const [dryRunning,   setDryRunning]   = useState(false)
  const [dryResult,    setDryResult]    = useState(null)

  // Create-agent form
  const [form, setForm] = useState({
    name:'', description:'', system_prompt:'', domain:'',
    llm_config_id:'', tool_ids:[], skill_ids:[],
  })
  const [domainSelection, setDomainSelection] = useState('')
  const [customDomain, setCustomDomain] = useState('')

  const getDomainOptions = () => {
    const builtin = ['General','Research','Sales','Support','Engineering','Finance','Technical','Ops']
    const existing = [...new Set(agents.map(a => (a.domain || '').trim()).filter(Boolean))]
    return [...new Set([...builtin, ...existing])]
  }

  /* ── Load data ── */
  const load = useCallback(async () => {
    try {
      const [ag, tl, sk, llms] = await Promise.all([
        agentsApi.list(),
        toolsApi.list(),
        skillsApi.list(),
        api.get('/llm/'),
      ])
      setAgents(ag.data)
      setTools(tl.data)
      setSkills(sk.data || [])
      setLlmConfigs(llms.data || [])
    } catch (error) {
      // Backend error, keep arrays empty and show error state
      console.error('Failed to load agents/tools/skills/llms', error)
      setAgents([])
      setTools([])
      setSkills([])
      setLlmConfigs([])
      toast.error('Unable to load data from backend; please check backend status.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Toggle agent status ── */
  async function toggleAgent(id) {
    try {
      const res = await agentsApi.toggle(id)
      setAgents(prev => prev.map(a => a.id === id ? res.data : a))
      if (selectedAgent?.id === id) setSelectedAgent(res.data)
    } catch {
      setAgents(prev => prev.map(a => {
        if (a.id !== id) return a
        const next = a.status === 'active' ? 'inactive' : 'active'
        if (selectedAgent?.id === id) setSelectedAgent({ ...a, status: next })
        return { ...a, status: next }
      }))
    }
  }

  /* ── Delete agent ── */
  async function deleteAgent(id) {
    if (!confirm('Delete this agent?')) return
    try { await agentsApi.delete(id) } catch {}
    setAgents(prev => prev.filter(a => a.id !== id))
    if (selectedAgent?.id === id) setSelectedAgent(null)
    toast.success('Agent deleted')
  }

  /* ── Create/Update agent ── */
  async function createAgent() {
    if (!form.name.trim()) return toast.error('Agent name is required')

    const finalDomain = domainSelection === '__custom__'
      ? customDomain.trim()
      : domainSelection || ''

    try {
      const payload = {
        ...form,
        domain: finalDomain,
        llm_config_id: form.llm_config_id ? form.llm_config_id : null,
      }
      if (editId) {
        // Update existing
        const res = await agentsApi.update(editId, payload)
        setAgents(prev => prev.map(a => a.id === editId ? res.data : a))
        if (selectedAgent?.id === editId) setSelectedAgent(res.data)
        toast.success('Agent updated')
      } else {
        // Create new
        const res = await agentsApi.create(payload)
        setAgents(prev => [res.data, ...prev])
        toast.success('Agent created')
      }
    } catch (error) {
      console.error('Operation failed', error)
      toast.error('Operation failed; please try again.')
    }
    closeCreateModal()
  }

  function openEdit(agent) {
    setEditId(agent.id)
    setForm({
      name: agent.name || '',
      description: agent.description || '',
      system_prompt: agent.system_prompt || '',
      domain: agent.domain || '',
      llm_config_id: agent.llm_config_id || '',
      tool_ids: agent.tool_ids || [],
      skill_ids: agent.skill_ids || [],
    })

    const options = getDomainOptions()
    if (agent.domain && options.includes(agent.domain)) {
      setDomainSelection(agent.domain)
      setCustomDomain('')
    } else if (agent.domain) {
      setDomainSelection('__custom__')
      setCustomDomain(agent.domain)
    } else {
      setDomainSelection('')
      setCustomDomain('')
    }

    setShowCreate(true)
  }

  function closeCreateModal() {
    setShowCreate(false)
    setEditId(null)
    setForm({ name:'', description:'', system_prompt:'', domain:'', llm_config_id:'', tool_ids:[], skill_ids:[] })
    setDomainSelection('')
    setCustomDomain('')
  }

  /* ── Dry run ── */
  async function runDryRun() {
    if (!selectedAgent) return toast.error('Select an agent first')
    if (!prompt.trim()) return toast.error('Enter a prompt')
    setDryRunning(true)
    setDryResult(null)
    try {
      const res = await agentsApi.dryRun(selectedAgent.id, { input_prompt: prompt })
      setDryResult(res.data)
    } catch (error) {
      console.error('Dry run failed', error)
      toast.error('Dry run failed; check backend and agent configuration.')
    } finally {
      setDryRunning(false)
    }
  }

  const allTools = tools
  const groupedAgents = agents.reduce((acc, agent) => {
    const domain = (agent.domain || '').trim() || 'Uncategorized'
    if (!acc[domain]) acc[domain] = []
    acc[domain].push(agent)
    return acc
  }, {})

  const sortedDomains = Object.keys(groupedAgents).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  return (
    <div>
      <PageHeader
        title="Agent Management"
        subtitle="Create and configure AI agents with tools and LLM settings"
        action={
          <Btn onClick={() => setShowCreate(true)} style={{ marginTop:28 }}>
            <Plus size={14} /> New Agent
          </Btn>
        }
      />

      <div style={{ padding:'20px 32px 32px' }}>
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={28} /></div>
        ) : agents.length === 0 ? (
          <Empty icon="🤖" message="No agents yet — create your first one" />
        ) : (
          /* ── Agent grid by domain ── */
          <div style={{ display:'flex', flexDirection:'column', gap:20, marginBottom:24 }}>
            {sortedDomains.map(domain => (
              <div key={domain}>
                <div style={{ marginBottom:8, fontSize:14, fontWeight:700, color:'#4f8ef7' }}>{domain}</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
                  {groupedAgents[domain].map(agent => (
                    <div
                      key={agent.id}
                      onClick={() => { setSelectedAgent(agent); setDryResult(null) }}
                      style={{
                        background: selectedAgent?.id === agent.id ? 'rgba(79,142,247,.06)' : '#111318',
                        border: `1px solid ${selectedAgent?.id === agent.id ? 'rgba(79,142,247,.4)' : '#23262f'}`,
                        borderRadius:14, padding:18, cursor:'pointer',
                        transition:'all .2s',
                      }}
                    >
                      {/* Header row */}
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                        <div style={{
                          width:40, height:40,
                          background:'linear-gradient(135deg,rgba(79,142,247,.2),rgba(124,58,237,.2))',
                          borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:16, color:'#4f8ef7',
                        }}>
                          {agent.name[0]}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }} onClick={e => e.stopPropagation()}>
                          <Toggle
                            checked={agent.status === 'active'}
                            onChange={() => toggleAgent(agent.id)}
                          />
                          <button onClick={() => openEdit(agent)}
                            style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', padding:4 }}>
                            <Edit size={13} />
                          </button>
                          <button onClick={() => deleteAgent(agent.id)}
                            style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', padding:4 }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <div style={{ fontFamily:'Syne,sans-serif', fontSize:15, fontWeight:700, marginBottom:4 }}>
                        {agent.name}
                      </div>
                      <div style={{ fontSize:12, color:'#6b7080', lineHeight:1.5, marginBottom:12 }}>
                        {agent.description || 'No description'}
                      </div>

                      {/* Tool chips */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                        {(agent.tool_ids || []).map(tid => {
                          const t = allTools.find(x => x.id === tid || x.name === tid)
                          return t ? (
                            <span key={tid} style={{
                              background:'rgba(6,182,212,.08)', border:'1px solid rgba(6,182,212,.2)',
                              borderRadius:5, padding:'2px 8px', fontSize:11, color:'#06b6d4',
                              fontFamily:'DM Mono,monospace',
                            }}>{t.name}</span>
                          ) : null
                        })}
                      </div>

                      {/* Skill chips */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                        {(agent.skill_ids || []).map(sid => {
                          const s = skills.find(x => x.id === sid)
                          return s ? (
                            <span key={sid} style={{
                              background:'rgba(124,58,237,.08)', border:'1px solid rgba(124,58,237,.2)',
                              borderRadius:5, padding:'2px 8px', fontSize:11, color:'#7c3aed',
                              fontFamily:'DM Mono,monospace',
                            }}>{s.name}</span>
                          ) : null
                        })}
                      </div>

                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Badge color={STATUS_COLOR[agent.status] || 'gray'}>{agent.status}</Badge>
                        {agent.llm_config_id && <Badge color="purple">LLM linked</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Dry Run Panel ── */}
        <div style={{ background:'#111318', border:'1px solid #23262f', borderRadius:14 }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #23262f', display:'flex', alignItems:'center', gap:10 }}>
            <Zap size={14} color="#f59e0b" />
            <span style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:14 }}>Dry Run</span>
            {selectedAgent && (
              <Badge color="blue">{selectedAgent.name}</Badge>
            )}
            {!selectedAgent && (
              <span style={{ fontSize:12, color:'#6b7080' }}>← select an agent above to test it</span>
            )}
          </div>

          {/* Input row */}
          <div style={{ display:'flex', gap:10, padding:'14px 20px', borderBottom:'1px solid #23262f' }}>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runDryRun()}
              placeholder={selectedAgent ? `Test "${selectedAgent.name}" with a prompt...` : 'Select an agent first...'}
              disabled={!selectedAgent || dryRunning}
              style={{
                flex:1, background:'#1a1d25', border:'1px solid #23262f',
                borderRadius:8, padding:'10px 14px', color:'#e8eaf0',
                fontSize:13, fontFamily:'DM Sans,sans-serif', outline:'none',
              }}
            />
            <Btn
              onClick={runDryRun}
              disabled={!selectedAgent || dryRunning || !prompt.trim()}
            >
              {dryRunning ? <Spinner size={14} /> : <Play size={13} />}
              {dryRunning ? 'Running…' : 'Run'}
            </Btn>
          </div>

          {/* Output area */}
          <div style={{ padding:'16px 20px', minHeight:160 }}>
            {!dryResult && !dryRunning && (
              <div style={{ color:'#6b7080', fontSize:13, fontFamily:'DM Mono,monospace' }}>
                Output will appear here…
              </div>
            )}

            {dryRunning && (
              <div style={{ display:'flex', alignItems:'center', gap:10, color:'#6b7080', fontSize:13, fontFamily:'DM Mono,monospace' }}>
                <Spinner size={14} />
                Agent is thinking
                <span style={{ display:'inline-flex', gap:2 }}>
                  {[0,1,2].map(i => (
                    <span key={i} style={{ animation:`blink 1.2s ${i*.2}s infinite`, opacity:0 }}>.</span>
                  ))}
                </span>
              </div>
            )}

            {dryResult && (
              <div>
                {/* Steps */}
                {dryResult.steps?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace', marginBottom:8, textTransform:'uppercase', letterSpacing:'.8px' }}>
                      Execution steps
                    </div>
                    {dryResult.steps.map((step, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:6 }}>
                        <span style={{
                          background:'rgba(79,142,247,.15)', color:'#4f8ef7',
                          borderRadius:4, padding:'1px 8px', fontSize:11,
                          fontFamily:'DM Mono,monospace', flexShrink:0,
                        }}>{step.node}</span>
                        <span style={{ fontSize:11, color:'#6b7080', lineHeight:1.5, fontFamily:'DM Mono,monospace' }}>
                          {String(step.output).slice(0, 200)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Final output */}
                <div style={{ fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace', marginBottom:6, textTransform:'uppercase', letterSpacing:'.8px' }}>
                  Final output — {dryResult.duration_ms}ms
                </div>
                <div style={{
                  background:'#1a1d25', border:'1px solid #23262f',
                  borderRadius:8, padding:'14px 16px',
                  fontSize:13, color:'#e8eaf0', lineHeight:1.7,
                  whiteSpace:'pre-wrap', fontFamily:'DM Sans,sans-serif',
                }}>
                  {dryResult.output || <span style={{ color:'#6b7080' }}>(no output)</span>}
                </div>

                {dryResult.error && (
                  <div style={{ marginTop:10, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'10px 14px', color:'#ef4444', fontSize:12, fontFamily:'DM Mono,monospace' }}>
                    Error: {dryResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Create Agent Modal ── */}
      {showCreate && (
        <Modal
          title={editId ? 'Edit Agent' : 'Create Agent'}
          onClose={closeCreateModal}
          width={560}
          footer={
            <>
              <Btn variant="ghost" onClick={closeCreateModal}>Cancel</Btn>
              <Btn onClick={createAgent}>{editId ? 'Save Changes' : 'Create Agent'}</Btn>
            </>
          }
        >
          <Input
            label="Agent Name *"
            placeholder="e.g. Research Assistant"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Description"
            placeholder="What does this agent do?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <Select
            label="Domain"
            value={domainSelection || ''}
            onChange={e => {
              const val = e.target.value
              setDomainSelection(val)
              if (val === '__custom__') {
                setForm(f => ({ ...f, domain: '' }))
              } else {
                setForm(f => ({ ...f, domain: val }))
                setCustomDomain('')
              }
            }}
          >
            <option value="">(none)</option>
            {getDomainOptions().map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
            <option value="__custom__">Custom...</option>
          </Select>

          {domainSelection === '__custom__' && (
            <Input
              label="Custom domain"
              placeholder="Type a new domain"
              value={customDomain}
              onChange={e => {
                setCustomDomain(e.target.value)
                setForm(f => ({ ...f, domain: e.target.value }))
              }}
            />
          )}

          <Textarea
            label="System Prompt"
            placeholder="You are a helpful assistant that..."
            rows={4}
            value={form.system_prompt}
            onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
          />

          {/* LLM picker */}
          <Select
            label="LLM Config"
            value={form.llm_config_id}
            onChange={e => setForm(f => ({ ...f, llm_config_id: e.target.value }))}
          >
            <option value="">No LLM linked</option>
            {llmConfigs.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          {/* Tool selection */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, color:'#6b7080', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px', fontFamily:'DM Mono,monospace' }}>
              Tools — click to select
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {allTools.map(tool => {
                const selected = form.tool_ids.includes(tool.id) || form.tool_ids.includes(tool.name)
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      const id = tool.id
                      setForm(f => ({
                        ...f,
                        tool_ids: f.tool_ids.includes(id)
                          ? f.tool_ids.filter(x => x !== id)
                          : [...f.tool_ids, id],
                      }))
                    }}
                    style={{
                      display:'flex', alignItems:'center', gap:6,
                      background: selected ? 'rgba(79,142,247,.12)' : '#1a1d25',
                      border: `1px solid ${selected ? 'rgba(79,142,247,.4)' : '#23262f'}`,
                      borderRadius:7, padding:'5px 12px',
                      fontSize:12, color: selected ? '#4f8ef7' : '#6b7080',
                      cursor:'pointer', fontFamily:'DM Mono,monospace',
                      transition:'all .15s',
                    }}
                  >
                    {selected && '✓ '}{tool.name}
                    <span style={{ fontSize:10, opacity:.6 }}>({tool.type || tool.tool_type})</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Skill selection */}
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:11, color:'#6b7080', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px', fontFamily:'DM Mono,monospace' }}>
              Skills — click to select
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {skills.map(skill => {
                const selected = form.skill_ids.includes(skill.id)
                return (
                  <button
                    key={skill.id}
                    onClick={() => {
                      const id = skill.id
                      setForm(f => ({
                        ...f,
                        skill_ids: f.skill_ids.includes(id)
                          ? f.skill_ids.filter(x => x !== id)
                          : [...f.skill_ids, id],
                      }))
                    }}
                    style={{
                      display:'flex', alignItems:'center', gap:6,
                      background: selected ? 'rgba(124,58,237,.12)' : '#1a1d25',
                      border: `1px solid ${selected ? 'rgba(124,58,237,.4)' : '#23262f'}`,
                      borderRadius:7, padding:'5px 12px',
                      fontSize:12, color: selected ? '#7c3aed' : '#6b7080',
                      cursor:'pointer', fontFamily:'DM Mono,monospace',
                      transition:'all .15s',
                    }}
                  >
                    {selected && '✓ '}{skill.name}
                    <span style={{ fontSize:10, opacity:.6 }}>({skill.category || 'general'})</span>
                  </button>
                )
              })}
            </div>
          </div>
        </Modal>
      )}

      <style>{`
        @keyframes blink { 0%,80%,100%{opacity:0} 40%{opacity:1} }
      `}</style>
    </div>
  )
}

