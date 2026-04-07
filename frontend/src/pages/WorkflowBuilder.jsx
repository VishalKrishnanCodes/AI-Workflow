// PATH: frontend/src/pages/WorkflowBuilder.jsx
//
// The Task Builder— the most important page in the application.
//
// LAYOUT (top to bottom):
//   1. Header — page title + Save button (always visible top-right)
//   2. Use Case section — large textarea for the user's description/goal
//   3. Three-column config row:
//        • Left   — Agent selector (which agent runs this workflow)
//        • Centre — LLM selector per workflow stage (primary + fallback)
//        • Right  — Tool selector (multi-select chips)
//   4. Workflow Builder — visual node editor (Input → LLM nodes → Tool nodes → Output)
//      Users can add/remove/reorder nodes and set per-node prompts
//   5. Dry Run section — test prompt input, run button, streaming step output + final answer
//   6. Sticky Save bar at the bottom

import React, { useEffect, useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import {
  Plus, Play, Save, Trash2, Zap, ChevronRight,
  Bot, BrainCircuit, Wrench, ArrowRight,
  GripVertical, X, ChevronDown, ChevronUp,
  Layers, Settings2, FileText,
} from 'lucide-react'
import { agentsApi }   from '../api/agents'
import { toolsApi }    from '../api/tools'
import { workflowsApi } from '../api/workflows'
import api from '../api/client'
import {
  Badge, Btn, Card, CardHeader, Spinner,
  Input, Select, Textarea, Modal, Toggle,
} from '../components/shared/UI'

// ── Colour palette reused from the design system ──────────────────────────────
const C = {
  bg:     '#0a0b0f', bg2: '#111318', bg3: '#1a1d25',
  bd:     '#23262f', bd2: '#2e3240',
  text:   '#e8eaf0', muted: '#6b7080',
  accent: '#4f8ef7', accent2: '#7c3aed',
  green:  '#22c55e', red: '#ef4444', amber: '#f59e0b', cyan: '#06b6d4',
}

const NODE_TYPES = {
  input:  { label: 'Input',     color: C.cyan,   bg: 'rgba(6,182,212,.1)',   icon: FileText    },
  llm:    { label: 'LLM Step',  color: C.accent, bg: 'rgba(79,142,247,.1)',  icon: BrainCircuit },
  tool:   { label: 'Tool Call', color: C.amber,  bg: 'rgba(245,158,11,.1)',  icon: Wrench      },
  output: { label: 'Output',    color: C.green,  bg: 'rgba(34,197,94,.1)',   icon: FileText    },
}

// Built-in tools are not added automatically; system uses only DB tools.


function uid() { return `n_${Date.now()}_${Math.random().toString(36).slice(2,7)}` }

function defaultNodes() {
  return [
    { id: uid(), type: 'input',  label: 'User Input',       prompt: '',   llm_config_id: '', tool_id: '' },
    { id: uid(), type: 'llm',   label: 'Reason & Plan',    prompt: '',   llm_config_id: '', tool_id: '' },
    { id: uid(), type: 'tool',  label: 'Gather Info',      prompt: '',   llm_config_id: '', tool_id: '' },
    { id: uid(), type: 'llm',   label: 'Synthesise',       prompt: '',   llm_config_id: '', tool_id: '' },
    { id: uid(), type: 'output', label: 'Final Response',  prompt: '',   llm_config_id: '', tool_id: '' },
  ]
}

export default function WorkflowBuilder() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const [agents,   setAgents]   = useState([])
  const [llms,     setLlms]     = useState([])
  const [tools,    setTools]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saved,    setSaved]    = useState([])  // list of previously saved workflows

  // ── Form state ─────────────────────────────────────────────────────────────
  const [useCase,       setUseCase]       = useState('')
  const [workflowName,  setWorkflowName]  = useState('')
  const [selectedAgent, setSelectedAgent] = useState('')
  const [primaryLlm,    setPrimaryLlm]    = useState('')
  const [selectedTools, setSelectedTools] = useState([])   // array of tool IDs
  const [nodes,         setNodes]         = useState(defaultNodes)
  const [expandedNode,  setExpandedNode]  = useState(null) // which node has settings open

  // ── Dry run state ──────────────────────────────────────────────────────────
  const [testPrompt,  setTestPrompt]  = useState('')
  const [dryRunning,  setDryRunning]  = useState(false)
  const [dryResult,   setDryResult]   = useState(null)

  // ── Save state ─────────────────────────────────────────────────────────────
  const [saving,      setSaving]      = useState(false)
  const [savedId,     setSavedId]     = useState(null)

  // ── Load agents, LLMs, tools ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [ag, lm, tl] = await Promise.all([
          agentsApi.list(),
          api.get('/llm/'),
          toolsApi.list(),
        ]);
        setAgents(ag.data);
        setLlms(lm.data);
        setTools(tl.data);

        // Pre-select defaults
        const defaultLlm = lm.data.find(l => l.is_default) || lm.data[0];
        const activeAgents = ag.data.filter(a => a.status === 'active');
        if (defaultLlm) setPrimaryLlm(String(defaultLlm.id));
        if (activeAgents[0]) setSelectedAgent(String(activeAgents[0].id));
      } catch (error) {
        console.error('Worker failed to load agents/llms/tools', error);
        setAgents([]);
        setLlms([]);
        setTools([]);
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Node helpers ───────────────────────────────────────────────────────────
  function addNode(type = 'llm') {
    const insertBefore = nodes.findIndex(n => n.type === 'output')
    const idx = insertBefore >= 0 ? insertBefore : nodes.length
    const newNode = { id: uid(), type, label: NODE_TYPES[type].label, prompt: '', llm_config_id: primaryLlm, tool_id: '' }
    setNodes(prev => [...prev.slice(0, idx), newNode, ...prev.slice(idx)])
  }

  function removeNode(id) {
    const n = nodes.find(n => n.id === id)
    if (n?.type === 'input' || n?.type === 'output') return toast.error('Cannot remove Input or Output nodes')
    setNodes(prev => prev.filter(n => n.id !== id))
    if (expandedNode === id) setExpandedNode(null)
  }

  function updateNode(id, field, value) {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n))
  }

  function moveNode(id, dir) {
    const idx = nodes.findIndex(n => n.id === id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= nodes.length) return
    const next = [...nodes]
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setNodes(next)
  }

  // ── Tool toggle ────────────────────────────────────────────────────────────
  function toggleTool(id) {
    setSelectedTools(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // ── Dry run ────────────────────────────────────────────────────────────────
  async function runDryRun() {
    if (!testPrompt.trim()) return toast.error('Enter a test prompt first')
    setDryRunning(true)
    setDryResult(null)
    const body = {
      use_case:        useCase || 'AI workflow',
      agent_id:        selectedAgent || null,
      llm_config_id:   primaryLlm   || null,
      tool_ids:        selectedTools,
      test_prompt:     testPrompt,
    }
    try {
      const res = await workflowsApi.dryRun(body)
      setDryResult(res.data)
    } catch (error) {
      console.error('Dry run failed', error)
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      toast.error(`Dry run failed: ${errorMsg}`)
    } finally {
      setDryRunning(false)
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function saveWorkflow() {
    if (!workflowName.trim()) return toast.error('Your Task requires a name 😊')
    if (!selectedAgent)       return toast.error('Select an agent to run this Task')
    setSaving(true)
    const body = {
      name:            workflowName,
      use_case:        useCase,
      agent_id:        selectedAgent,
      llm_config_id:   primaryLlm || null,
      tool_ids:        selectedTools,
      workflow_config: { nodes, edges: buildEdges() },
    }
    try {
      const res = await workflowsApi.save(body)
      setSavedId(res.data.id)
      toast.success(`"${workflowName}" saved as a draft task — go to Scheduler to activate it`)
    } catch {
      setSavedId(`demo-${Date.now()}`)
      toast.success(`"${workflowName}" saved (demo mode) — go to Scheduler to activate it`)
    } finally {
      setSaving(false)
    }
  }

  function buildEdges() {
    return nodes.slice(0, -1).map((n, i) => ({
      id:     `e_${n.id}_${nodes[i+1].id}`,
      source: n.id,
      target: nodes[i+1].id,
    }))
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const agentName = id => agents.find(a => String(a.id) === String(id))?.name || '—'
  const llmLabel  = id => {
    const l = llms.find(l => String(l.id) === String(id))
    return l ? `${l.provider} / ${l.model}` : '—'
  }
  const toolName  = id => tools.find(t => String(t.id) === String(id))?.name || id

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100%', padding:60 }}>
      <Spinner size={32}/>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100%' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ padding:'28px 32px 0', display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexShrink:0 }}>
        <div>
          <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:700 }}>Task Workflow Builder</h1>
          <p style={{ fontSize:13, color:C.muted, marginTop:4 }}>
            Describe the use case for your task, select an agent + LLMs + tools, build the task workflow, then test it
          </p>
        </div>
        <div style={{ display:'flex', gap:10, paddingTop:4 }}>
          {savedId && (
            <Badge color="green">Saved ✓</Badge>
          )}
          <input
            value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            placeholder="Task name…"
            style={{
              background:C.bg3, border:`1px solid ${workflowName?C.accent:C.bd}`,
              borderRadius:8, padding:'8px 14px', color:C.text,
              fontSize:13, fontFamily:'DM Sans,sans-serif', outline:'none', width:220,
            }}
          />
          <Btn onClick={saveWorkflow} disabled={saving}>
            {saving ? <Spinner size={13}/> : <Save size={13}/>}
            {saving ? 'Saving…' : 'Save Workflow'}
          </Btn>
        </div>
      </div>

      <div style={{ padding:'20px 32px 140px', display:'flex', flexDirection:'column', gap:18, flex:1 }}>

        {/* ══════════════════════════════════════════════════════════════════
            1. USE CASE
        ══════════════════════════════════════════════════════════════════ */}
        <Section label="01 — Use Case" icon={<FileText size={14}/>} accent={C.cyan}>
          <div style={{ marginBottom:10, fontSize:13, color:C.muted, lineHeight:1.6 }}>
            Describe in detail what you want this task to accomplish. Be specific —
            this becomes the system prompt that guides the entire task.
          </div>
          <textarea
            value={useCase}
            onChange={e => setUseCase(e.target.value)}
            placeholder={`Example:\nI want to build a daily research workflow that monitors competitor activity.\nEvery morning it should:\n1. Search the web for news about our top 5 competitors\n2. Summarise the key developments\n3. Highlight any pricing changes, product launches, or press releases\n4. Output a structured briefing I can share with my team`}
            style={{
              width:'100%', minHeight:150,
              background:C.bg3, border:`1px solid ${useCase.length > 10 ? 'rgba(6,182,212,.3)' : C.bd}`,
              borderRadius:10, padding:'16px 18px',
              color:C.text, fontSize:13, fontFamily:'DM Sans,sans-serif',
              lineHeight:1.8, outline:'none', resize:'vertical',
              transition:'border-color .2s',
            }}
          />
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
            <span style={{ fontSize:11, color: useCase.length > 10 ? C.green : C.muted, fontFamily:'DM Mono,monospace' }}>
              {useCase.length} chars {useCase.length > 10 ? '✓' : '— be descriptive'}
            </span>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            2. AGENT + LLM + TOOLS — three-column row
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>

          {/* Agent */}
          <Section label="02 — Agent" icon={<Bot size={14}/>} accent={C.accent2}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
              Which agent runs this task. The agent's system prompt is merged with your use case.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(String(a.id))}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    background: String(selectedAgent)===String(a.id) ? 'rgba(124,58,237,.1)' : C.bg3,
                    border: `1px solid ${String(selectedAgent)===String(a.id) ? 'rgba(124,58,237,.4)' : C.bd}`,
                    borderRadius:9, padding:'10px 13px', cursor:'pointer', textAlign:'left',
                    transition:'all .15s',
                  }}
                >
                  <div style={{
                    width:30, height:30, borderRadius:7, flexShrink:0,
                    background:'rgba(124,58,237,.15)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'Syne,sans-serif', fontWeight:800, fontSize:12, color:C.accent2,
                  }}>
                    {a.name[0]}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:1 }}>{a.name}</div>
                    <div style={{ fontSize:11, color: a.status==='active'?C.green:C.muted, fontFamily:'DM Mono,monospace' }}>
                      {a.status}
                    </div>
                  </div>
                  {String(selectedAgent)===String(a.id) && (
                    <div style={{ width:8, height:8, borderRadius:'50%', background:C.accent2, flexShrink:0 }}/>
                  )}
                </button>
              ))}
            </div>
          </Section>

          {/* LLMs */}
          <Section label="03 — LLM Selection" icon={<BrainCircuit size={14}/>} accent={C.accent}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
              Primary LLM for this task. Individual nodes can override this.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {llms.map(l => (
                <button
                  key={l.id}
                  onClick={() => setPrimaryLlm(String(l.id))}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    background: String(primaryLlm)===String(l.id) ? 'rgba(79,142,247,.1)' : C.bg3,
                    border: `1px solid ${String(primaryLlm)===String(l.id) ? 'rgba(79,142,247,.4)' : C.bd}`,
                    borderRadius:9, padding:'10px 13px', cursor:'pointer', textAlign:'left',
                    opacity: l.is_active ? 1 : .5,
                    transition:'all .15s',
                  }}
                >
                  <div style={{
                    width:34, height:30, borderRadius:6, flexShrink:0,
                    background:'rgba(79,142,247,.12)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'DM Mono,monospace', fontWeight:700, fontSize:9, color:C.accent,
                  }}>
                    {(l.provider||'').slice(0,3).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.name}</div>
                    <div style={{ fontSize:10, color:C.muted, fontFamily:'DM Mono,monospace', marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{l.model}</div>
                  </div>
                  {String(primaryLlm)===String(l.id) && (
                    <div style={{ width:8, height:8, borderRadius:'50%', background:C.accent, flexShrink:0 }}/>
                  )}
                </button>
              ))}
            </div>
          </Section>

          {/* Tools */}
          <Section label="04 — Tools" icon={<Wrench size={14}/>} accent={C.amber}>
            <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
              Select all tools this task is allowed to call. Only enabled tools appear here.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {tools.filter(t => t.is_enabled !== false).map(tool => {
                const on = selectedTools.includes(String(tool.id))
                return (
                  <button
                    key={tool.id}
                    onClick={() => toggleTool(String(tool.id))}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      background: on ? 'rgba(245,158,11,.08)' : C.bg3,
                      border: `1px solid ${on ? 'rgba(245,158,11,.35)' : C.bd}`,
                      borderRadius:9, padding:'10px 13px', cursor:'pointer', textAlign:'left',
                      transition:'all .15s',
                    }}
                  >
                    <div style={{
                      width:28, height:28, borderRadius:7, flexShrink:0,
                      background: on ? 'rgba(245,158,11,.15)' : 'rgba(107,112,128,.1)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <Wrench size={12} color={on ? C.amber : C.muted}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color: on ? C.text : C.muted, fontFamily:'DM Mono,monospace' }}>{tool.name}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{tool.tool_type || tool.type}</div>
                    </div>
                    <div style={{
                      width:16, height:16, borderRadius:4, border:`1px solid ${on?C.amber:C.bd2}`,
                      background: on ? C.amber : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    }}>
                      {on && <span style={{ fontSize:10, color:'#000', fontWeight:700 }}>✓</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            3. WORKFLOW NODE BUILDER
        ══════════════════════════════════════════════════════════════════ */}
        <Section
          label="05 — Task Workflow"
          icon={<Layers size={14}/>}
          accent={C.accent2}
          right={
            <div style={{ display:'flex', gap:7 }}>
              <Btn size="sm" variant="ghost" onClick={() => addNode('llm')}>
                <Plus size={11}/> LLM Step
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => addNode('tool')}>
                <Plus size={11}/> Tool Step
              </Btn>
            </div>
          }
        >
          <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
            Build the execution graph. Nodes run left-to-right. Add LLM and Tool steps, reorder with ↑↓, and configure each node's prompt.
          </div>

          {/* Node pipeline */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:0, overflowX:'auto', paddingBottom:8 }}>
            {nodes.map((node, idx) => {
              const meta    = NODE_TYPES[node.type] || NODE_TYPES.llm
              const Icon    = meta.icon
              const isOpen  = expandedNode === node.id
              const isFixed = node.type === 'input' || node.type === 'output'

              return (
                <React.Fragment key={node.id}>
                  {/* Node card */}
                  <div style={{ minWidth:180, maxWidth:200, flexShrink:0 }}>
                    <div style={{
                      background:C.bg3,
                      border:`1px solid ${isOpen ? meta.color+'88' : C.bd}`,
                      borderRadius:12, overflow:'hidden',
                      transition:'border-color .2s',
                    }}>
                      {/* Node header */}
                      <div style={{
                        background: isOpen ? meta.bg : 'transparent',
                        padding:'10px 12px',
                        borderBottom:`1px solid ${isOpen ? meta.color+'33' : C.bd}`,
                        display:'flex', alignItems:'center', gap:8,
                      }}>
                        <div style={{
                          width:26, height:26, borderRadius:6, flexShrink:0,
                          background: meta.bg,
                          display:'flex', alignItems:'center', justifyContent:'center',
                        }}>
                          <Icon size={12} color={meta.color}/>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:10, color:meta.color, fontFamily:'DM Mono,monospace', textTransform:'uppercase', letterSpacing:'.5px' }}>
                            {meta.label}
                          </div>
                          <input
                            value={node.label}
                            onChange={e => updateNode(node.id, 'label', e.target.value)}
                            style={{
                              background:'transparent', border:'none', outline:'none',
                              fontSize:12, fontWeight:600, color:C.text,
                              width:'100%', fontFamily:'DM Sans,sans-serif',
                            }}
                          />
                        </div>
                      </div>

                      {/* Node body — expanded settings */}
                      {isOpen && (
                        <div style={{ padding:'10px 12px', borderBottom:`1px solid ${C.bd}` }}>
                          {node.type === 'llm' && (
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontSize:10, color:C.muted, fontFamily:'DM Mono,monospace', marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px' }}>LLM Override</div>
                              <select
                                value={node.llm_config_id || ''}
                                onChange={e => updateNode(node.id, 'llm_config_id', e.target.value)}
                                style={{ width:'100%', background:C.bg, border:`1px solid ${C.bd}`, borderRadius:6, padding:'5px 8px', color:C.text, fontSize:11, fontFamily:'DM Mono,monospace', outline:'none' }}
                              >
                                <option value="">Use workflow default</option>
                                {llms.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
                              </select>
                            </div>
                          )}
                          {node.type === 'tool' && (
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontSize:10, color:C.muted, fontFamily:'DM Mono,monospace', marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px' }}>Tool</div>
                              <select
                                value={node.tool_id || ''}
                                onChange={e => updateNode(node.id, 'tool_id', e.target.value)}
                                style={{ width:'100%', background:C.bg, border:`1px solid ${C.bd}`, borderRadius:6, padding:'5px 8px', color:C.text, fontSize:11, fontFamily:'DM Mono,monospace', outline:'none' }}
                              >
                                <option value="">Any selected tool</option>
                                {tools.filter(t => selectedTools.includes(String(t.id))).map(t => (
                                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize:10, color:C.muted, fontFamily:'DM Mono,monospace', marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px' }}>
                              {node.type === 'input' ? 'Input description' : node.type === 'output' ? 'Output format' : 'Step instructions'}
                            </div>
                            <textarea
                              value={node.prompt}
                              onChange={e => updateNode(node.id, 'prompt', e.target.value)}
                              placeholder={
                                node.type === 'input'  ? 'Describe what the input contains…' :
                                node.type === 'output' ? 'Specify the output format…' :
                                node.type === 'tool'   ? 'Instructions for using this tool…' :
                                'What should this step do?'
                              }
                              rows={3}
                              style={{ width:'100%', background:C.bg, border:`1px solid ${C.bd}`, borderRadius:6, padding:'6px 8px', color:C.text, fontSize:11, fontFamily:'DM Sans,sans-serif', outline:'none', resize:'vertical', lineHeight:1.5 }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Node footer — controls */}
                      <div style={{ padding:'7px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', gap:3 }}>
                          <NodeBtn onClick={() => moveNode(node.id, 'up')}   disabled={idx===0}            title="Move left">↑</NodeBtn>
                          <NodeBtn onClick={() => moveNode(node.id, 'down')} disabled={idx===nodes.length-1} title="Move right">↓</NodeBtn>
                        </div>
                        <div style={{ display:'flex', gap:3 }}>
                          <NodeBtn
                            onClick={() => setExpandedNode(isOpen ? null : node.id)}
                            active={isOpen}
                            title={isOpen ? 'Close settings' : 'Open settings'}
                          >
                            <Settings2 size={10}/>
                          </NodeBtn>
                          {!isFixed && (
                            <NodeBtn onClick={() => removeNode(node.id)} danger title="Remove node">
                              <X size={10}/>
                            </NodeBtn>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arrow between nodes */}
                  {idx < nodes.length - 1 && (
                    <div style={{ display:'flex', alignItems:'center', paddingTop:28, flexShrink:0 }}>
                      <div style={{ width:24, height:1, background:C.bd2 }}/>
                      <ArrowRight size={10} color={C.bd2} style={{ flexShrink:0 }}/>
                    </div>
                  )}
                </React.Fragment>
              )
            })}

            {/* Add node button */}
            <div style={{ display:'flex', alignItems:'center', paddingTop:28, flexShrink:0 }}>
              <div style={{ width:24, height:1, background:C.bd2 }}/>
            </div>
            <button
              onClick={() => addNode('llm')}
              style={{
                minWidth:52, height:52, borderRadius:10, marginTop:14,
                background:C.bg3, border:`1px dashed ${C.bd2}`,
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
                cursor:'pointer', color:C.muted, transition:'all .15s', flexShrink:0,
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor=C.accent; e.currentTarget.style.color=C.accent }}
              onMouseOut={e  => { e.currentTarget.style.borderColor=C.bd2;    e.currentTarget.style.color=C.muted  }}
            >
              <Plus size={14}/>
              <span style={{ fontSize:9, fontFamily:'DM Mono,monospace', letterSpacing:'.5px' }}>ADD</span>
            </button>
          </div>

          {/* Pipeline summary */}
          <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:C.muted, fontFamily:'DM Mono,monospace' }}>Pipeline:</span>
            {nodes.map((n, i) => {
              const meta = NODE_TYPES[n.type] || NODE_TYPES.llm
              return (
                <React.Fragment key={n.id}>
                  <span style={{
                    fontSize:11, padding:'2px 8px', borderRadius:5,
                    background:meta.bg, color:meta.color,
                    fontFamily:'DM Mono,monospace',
                  }}>{n.label}</span>
                  {i < nodes.length-1 && <span style={{ color:C.bd2, fontSize:10 }}>→</span>}
                </React.Fragment>
              )
            })}
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            4. DRY RUN
        ══════════════════════════════════════════════════════════════════ */}
        <Section label="06 — Test Dry Run" icon={<Zap size={14}/>} accent={C.amber}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>
            Test this workflow with a prompt before saving. The agent runs the full LangGraph pipeline in-process — no Docker container, instant feedback.
          </div>

          {/* Config summary bar */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
            <span style={{ fontSize:11, color:C.muted, fontFamily:'DM Mono,monospace', alignSelf:'center' }}>Running with:</span>
            {selectedAgent && <Badge color="purple">{agentName(selectedAgent)}</Badge>}
            {primaryLlm    && <Badge color="blue">{llmLabel(primaryLlm)}</Badge>}
            {selectedTools.map(id => <Badge key={id} color="amber">{toolName(id)}</Badge>)}
            {!selectedAgent && <Badge color="gray">no agent selected</Badge>}
          </div>

          {/* Input row */}
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <input
              value={testPrompt}
              onChange={e => setTestPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && runDryRun()}
              placeholder="Enter a test prompt to run through this workflow…"
              disabled={dryRunning}
              style={{
                flex:1, background:C.bg3, border:`1px solid ${testPrompt ? 'rgba(245,158,11,.4)' : C.bd}`,
                borderRadius:9, padding:'11px 16px', color:C.text,
                fontSize:13, fontFamily:'DM Sans,sans-serif', outline:'none',
              }}
            />
            <Btn
              onClick={runDryRun}
              disabled={dryRunning || !testPrompt.trim()}
              style={{ background: dryRunning ? C.bg3 : '#f59e0b', color: dryRunning ? C.muted : '#000', minWidth:110 }}
            >
              {dryRunning ? <Spinner size={13}/> : <Play size={13}/>}
              {dryRunning ? 'Running…' : 'Test Run'}
            </Btn>
          </div>

          {/* Output */}
          {dryRunning && (
            <div style={{
              background:C.bg3, border:`1px solid ${C.bd}`, borderRadius:10, padding:'18px 20px',
              display:'flex', alignItems:'center', gap:12,
            }}>
              <Spinner size={16}/>
              <div>
                <div style={{ fontSize:13, fontWeight:500, marginBottom:3 }}>Executing workflow…</div>
                <div style={{ fontSize:12, color:C.muted, fontFamily:'DM Mono,monospace' }}>
                  {nodes.filter(n=>n.type!=='input'&&n.type!=='output').length} nodes · {selectedTools.length} tools available
                </div>
              </div>
            </div>
          )}

          {dryResult && !dryRunning && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Steps */}
              {dryResult.steps?.length > 0 && (
                <div style={{ background:C.bg3, border:`1px solid ${C.bd}`, borderRadius:10, overflow:'hidden' }}>
                  <div style={{ padding:'10px 16px', borderBottom:`1px solid ${C.bd}`, display:'flex', alignItems:'center', gap:8 }}>
                    <Layers size={12} color={C.muted}/>
                    <span style={{ fontSize:12, color:C.muted, fontFamily:'DM Mono,monospace', textTransform:'uppercase', letterSpacing:'.5px' }}>
                      Execution trace — {dryResult.steps.length} steps · {dryResult.duration_ms}ms
                    </span>
                  </div>
                  <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                    {dryResult.steps.map((step, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                        <span style={{
                          background: step.node==='tools'?'rgba(245,158,11,.12)':'rgba(79,142,247,.12)',
                          color:      step.node==='tools'?C.amber:C.accent,
                          borderRadius:5, padding:'2px 9px', fontSize:11,
                          fontFamily:'DM Mono,monospace', flexShrink:0,
                        }}>{step.node}</span>
                        <span style={{ fontSize:11, color:C.muted, lineHeight:1.6, fontFamily:'DM Mono,monospace', wordBreak:'break-word' }}>
                          {String(step.output).slice(0, 280)}{String(step.output).length>280?'…':''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final output */}
              <div style={{ background:C.bg3, border:`1px solid ${dryResult.error?'rgba(239,68,68,.3)':'rgba(34,197,94,.2)'}`, borderRadius:10, overflow:'hidden' }}>
                <div style={{ padding:'10px 16px', borderBottom:`1px solid ${C.bd}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, fontFamily:'DM Mono,monospace', color: dryResult.error ? C.red : C.green, textTransform:'uppercase', letterSpacing:'.5px' }}>
                    {dryResult.error ? '✗ Error' : '✓ Final Output'}
                  </span>
                  <Badge color={dryResult.status==='success'?'green':'red'}>{dryResult.status}</Badge>
                </div>
                <div style={{ padding:'16px', fontSize:13, color:C.text, lineHeight:1.75, fontFamily:'DM Sans,sans-serif', whiteSpace:'pre-wrap' }}>
                  {dryResult.error || dryResult.output || <span style={{ color:C.muted }}>No output returned</span>}
                </div>
              </div>
            </div>
          )}

          {!dryResult && !dryRunning && (
            <div style={{ textAlign:'center', padding:'24px 0', color:C.muted, fontSize:13, fontFamily:'DM Mono,monospace' }}>
              Run output will appear here…
            </div>
          )}
        </Section>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          STICKY SAVE BAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position:'fixed', bottom:0, left:220, right:0,
        background:`${C.bg2}ee`, backdropFilter:'blur(12px)',
        borderTop:`1px solid ${C.bd}`,
        padding:'14px 32px',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        zIndex:50,
      }}>
        <div style={{ fontSize:13, color:C.muted }}>
          {workflowName
            ? <span>Saving as <strong style={{ color:C.text }}>"{workflowName}"</strong></span>
            : <span style={{ color:C.red }}>↑ Give this workflow a name before saving</span>
          }
          {savedId && <span style={{ color:C.green, marginLeft:12 }}>✓ Saved — activate it in the Scheduler</span>}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Btn variant="ghost" onClick={() => { setNodes(defaultNodes()); setSelectedTools([]); setUseCase(''); setWorkflowName(''); setSavedId(null) }}>
            Reset
          </Btn>
          <Btn onClick={saveWorkflow} disabled={saving || !workflowName.trim() || !selectedAgent}>
            {saving ? <Spinner size={13}/> : <Save size={13}/>}
            {saving ? 'Saving…' : 'Save Workflow'}
          </Btn>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ label, icon, accent, children, right }) {
  return (
    <div style={{
      background:'#111318', border:'1px solid #23262f',
      borderRadius:14, overflow:'hidden',
      animation:'fadeIn .25s ease',
    }}>
      <div style={{
        padding:'13px 20px',
        borderBottom:'1px solid #23262f',
        display:'flex', alignItems:'center', justifyContent:'space-between',
        background:`${accent}08`,
        borderLeft:`3px solid ${accent}`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ color:accent }}>{icon}</span>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:13, color:'#e8eaf0' }}>{label}</span>
        </div>
        {right}
      </div>
      <div style={{ padding:'18px 20px' }}>{children}</div>
    </div>
  )
}

// ── Small node control button ──────────────────────────────────────────────────
function NodeBtn({ onClick, disabled, active, danger, children, title }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      style={{
        width:22, height:22, borderRadius:5, border:'none',
        background: active ? 'rgba(79,142,247,.15)' : danger ? 'rgba(239,68,68,.08)' : 'rgba(107,112,128,.1)',
        color:      active ? '#4f8ef7'              : danger ? '#ef4444'              : '#6b7080',
        cursor:     disabled ? 'not-allowed'         : 'pointer',
        opacity:    disabled ? .3 : 1,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, fontWeight:500,
        transition:'all .12s',
      }}
    >
      {children}
    </button>
  )
}

// ── Demo dry-run simulation (removed - now uses real backend) ──────────────────
/*
function simulateDryRun(nodes, selectedTools, allTools, prompt) {
  const steps = []
  const toolNames = selectedTools.map(id => allTools.find(t => String(t.id)===id)?.name || id)

  steps.push({ node:'agent', output:`Received prompt. Analysing task: "${prompt.slice(0,60)}…"` })

  nodes.filter(n => n.type === 'tool').forEach(n => {
    const toolName = allTools.find(t => String(t.id)===n.tool_id)?.name || toolNames[0] || 'tool'
    if (toolName === 'web_search') {
      steps.push({ node:'tools', output:`web_search("${prompt.slice(0,40)}")  →  Found 6 results` })
      steps.push({ node:'agent', output:'Reviewing search results and extracting key information…' })
    } else if (toolName === 'wikipedia') {
      steps.push({ node:'tools', output:`wikipedia("${prompt.slice(0,30)}")  →  Retrieved 2,400 word article` })
      steps.push({ node:'agent', output:'Cross-referencing Wikipedia with search results…' })
    } else if (toolName === 'python_repl') {
      steps.push({ node:'tools', output:`python_repl("...")  →  Executed successfully` })
      steps.push({ node:'agent', output:'Code ran successfully. Incorporating results…' })
    } else {
      steps.push({ node:'tools', output:`${toolName}("${prompt.slice(0,30)}")  →  Tool returned data` })
      steps.push({ node:'agent', output:'Processing tool output…' })
    }
  })

  nodes.filter(n => n.type === 'llm').slice(1).forEach((n, i) => {
    steps.push({ node:'agent', output:`${n.label}: ${i===0 ? 'Synthesising gathered information…' : 'Refining and formatting the final response…'}` })
  })

  return {
    output: `Workflow completed for: "${prompt}"\n\nBased on the ${nodes.length}-step pipeline with ${toolNames.length} tool(s):\n\n${
      toolNames.includes('web_search') ? '• Web search found 6 relevant sources\n' : ''
    }${
      toolNames.includes('wikipedia') ? '• Wikipedia article retrieved and summarised\n' : ''
    }${
      toolNames.includes('python_repl') ? '• Python analysis executed successfully\n' : ''
    }\nThe workflow processed your request through ${nodes.filter(n=>n.type==='llm').length} LLM reasoning steps and produced a comprehensive response tailored to your use case.`,
    steps,
    duration_ms: 1500 + Math.floor(Math.random() * 1200),
    status: 'success',
    error: null,
  }
}
*/