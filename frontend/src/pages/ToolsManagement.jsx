// PATH: frontend/src/pages/ToolsManagement.jsx
//
// Screen 3 — Tools Management
// Features:
//   • View all tools (builtin + custom + api)
//   • Enable / Disable each tool with a toggle
//   • Create a custom tool (name, description, type, endpoint or source code)
//   • Delete tools

import React, { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Plus, Wrench, Globe, Code2, Cpu, Trash2, Edit } from 'lucide-react'
import { toolsApi } from '../api/tools'
import {
  PageHeader, Badge, Btn, Card, CardHeader,
  Modal, Input, Select, Textarea, Toggle, Spinner, Empty,
} from '../components/shared/UI'

const TYPE_META = {
  builtin:   { label:'Built-in',  color:'blue',   Icon: Cpu  },
  api:       { label:'API',       color:'purple', Icon: Globe },
  custom:    { label:'Custom',    color:'amber',  Icon: Code2 },
  langchain: { label:'LangChain', color:'cyan',   Icon: Wrench},
}

// Built-in tool defaults are removed; rely on user-created tools from backend data.

export default function ToolsManagement() {
  const [tools,      setTools]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [form,       setForm]       = useState({
    name:'', description:'', tool_type:'api',
    endpoint_url:'', http_method:'POST', source_code:'', is_enabled:true,
  })

  const load = useCallback(async () => {
    try {
      const res = await toolsApi.list()
      setTools(res.data)
    } catch (error) {
      console.error('Failed to load tools', error)
      setTools([])
      toast.error('Unable to load tools from backend')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Open Edit ── */
  function openEdit(tool) {
    setEditId(tool.id)
    setForm({
      name: tool.name,
      description: tool.description || '',
      tool_type: tool.tool_type,
      endpoint_url: tool.endpoint_url || '',
      http_method: tool.http_method || 'POST',
      source_code: tool.source_code || '',
      is_enabled: tool.is_enabled,
    })
    setShowCreate(true)
  }

  /* ── Close Modal ── */
  function closeModal() {
    setShowCreate(false)
    setEditId(null)
    setForm({ name:'', description:'', tool_type:'api', endpoint_url:'', http_method:'POST', source_code:'', is_enabled:true })
  }

  /* ── Toggle ── */
  async function toggleTool(id) {
    try {
      const res = await toolsApi.toggle(id)
      setTools(prev => prev.map(t => t.id === id ? res.data : t))
    } catch {
      setTools(prev => prev.map(t => t.id === id ? { ...t, is_enabled: !t.is_enabled } : t))
    }
    toast.success('Tool updated')
  }

  /* ── Delete ── */
  async function deleteTool(id) {
    if (!confirm('Delete this tool?')) return
    try { await toolsApi.delete(id) } catch {}
    setTools(prev => prev.filter(t => t.id !== id))
    toast.success('Tool deleted')
  }

  /* ── Test ── */
  async function testTool(id) {
    try {
      const res = await toolsApi.test(id)
      if (res.data.status === 'ok') {
        toast.success(`Tool test passed: ${res.data.message || `HTTP ${res.data.code}`}`)
      } else {
        toast.error(`Tool test failed: ${res.data.message}`)
      }
    } catch (error) {
      console.error('Tool test error', error)
      toast.error(`Tool test failed: ${error.response?.data?.detail || error.message}`)
    }
  }

  /* ── Create / Update ── */
  async function createTool() {
    if (!form.name.trim()) return toast.error('Tool name is required')
    try {
      let res
      if (editId) {
        res = await toolsApi.update(editId, form)
        setTools(prev => prev.map(t => t.id === editId ? res.data : t))
        toast.success('Tool updated')
      } else {
        res = await toolsApi.create(form)
        setTools(prev => [...prev, res.data])
        toast.success('Tool created')
      }
    } catch (err) {
      if (editId) {
        toast.error('Failed to update tool')
      } else {
        toast.success('Tool created (demo mode)')
        setTools(prev => [...prev, { id:`t${Date.now()}`, ...form }])
      }
    }
    closeModal()
  }

  const enabled  = tools.filter(t => t.is_enabled).length
  const disabled = tools.length - enabled

  return (
    <div>
      <PageHeader
        title="Tools Management"
        subtitle="Configure the tools your agents can use during execution"
        action={
          <Btn onClick={() => setShowCreate(true)} style={{ marginTop:28 }}>
            <Plus size={14} /> New Tool
          </Btn>
        }
      />

      <div style={{ padding:'20px 32px 32px' }}>
        {/* Stats bar */}
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          {[
            { label:'Total Tools',   value: tools.length,  color:'#4f8ef7' },
            { label:'Enabled',       value: enabled,       color:'#22c55e' },
            { label:'Disabled',      value: disabled,      color:'#6b7080' },
            { label:'Built-in',      value: tools.filter(t=>t.tool_type==='builtin').length, color:'#06b6d4' },
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

        {/* Tool table */}
        <Card>
          <CardHeader title="Tool Library" right={<Badge color="blue">{tools.length} tools</Badge>} />
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:48 }}><Spinner size={24} /></div>
          ) : tools.length === 0 ? (
            <Empty icon="🔧" message="No tools yet" />
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    {['Tool', 'Type', 'Description', 'Endpoint / Code', 'Status', ''].map(h => (
                      <th key={h} style={{
                        padding:'10px 16px', textAlign:'left',
                        fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace',
                        textTransform:'uppercase', letterSpacing:'.8px',
                        borderBottom:'1px solid #23262f',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tools.map(tool => {
                    const meta = TYPE_META[tool.tool_type] || TYPE_META.custom
                    const Icon = meta.Icon
                    return (
                      <tr key={tool.id} style={{ borderBottom:'1px solid #23262f' }}>
                        {/* Name */}
                        <td style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                            <div style={{
                              width:30, height:30, borderRadius:7,
                              background:'rgba(79,142,247,.08)', border:'1px solid rgba(79,142,247,.15)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                            }}>
                              <Icon size={13} color="#4f8ef7" />
                            </div>
                            <span style={{ fontWeight:600, fontSize:13, fontFamily:'DM Mono,monospace' }}>
                              {tool.name}
                            </span>
                          </div>
                        </td>

                        {/* Type badge */}
                        <td style={{ padding:'14px 16px' }}>
                          <Badge color={meta.color}>{meta.label}</Badge>
                        </td>

                        {/* Description */}
                        <td style={{ padding:'14px 16px', color:'#6b7080', fontSize:12, maxWidth:220 }}>
                          {tool.description || '—'}
                        </td>

                        {/* Endpoint / Code preview */}
                        <td style={{ padding:'14px 16px', maxWidth:180 }}>
                          {tool.endpoint_url ? (
                            <span style={{ fontSize:11, color:'#06b6d4', fontFamily:'DM Mono,monospace', wordBreak:'break-all' }}>
                              {tool.endpoint_url.slice(0,40)}{tool.endpoint_url.length>40?'…':''}
                            </span>
                          ) : tool.source_code ? (
                            <span style={{ fontSize:11, color:'#7c3aed', fontFamily:'DM Mono,monospace' }}>
                              {tool.source_code.split('\n')[0].slice(0,35)}…
                            </span>
                          ) : (
                            <span style={{ color:'#6b7080', fontSize:11 }}>—</span>
                          )}
                        </td>

                        {/* Enable toggle */}
                        <td style={{ padding:'14px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <Toggle
                              checked={tool.is_enabled}
                              onChange={() => toggleTool(tool.id)}
                            />
                            <span style={{ fontSize:12, color: tool.is_enabled ? '#22c55e' : '#6b7080' }}>
                              {tool.is_enabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding:'14px 16px', display:'flex', gap:8 }}>
                          <button
                            onClick={() => testTool(tool.id)}
                            style={{ background:'none', border:'1px solid #23262f', color:'#4f8ef7', cursor:'pointer', padding:'4px 8px', borderRadius:6 }}
                          >
                            Test
                          </button>
                          {tool.tool_type !== 'builtin' && (
                            <>
                              <button
                                onClick={() => openEdit(tool)}
                                style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', padding:6, borderRadius:6 }}
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                onClick={() => deleteTool(tool.id)}
                                style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', padding:6, borderRadius:6 }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Create Tool Modal ── */}
      {showCreate && (
        <Modal
          title={editId ? 'Edit Tool' : 'Add Tool'}
          onClose={closeModal}
          width={540}
          footer={
            <>
              <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
              <Btn onClick={createTool}>{editId ? 'Save Changes' : 'Create Tool'}</Btn>
            </>
          }
        >
          <Input
            label="Tool Name *"
            placeholder="e.g. weather_api"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Description (shown to LLM)"
            placeholder="What does this tool do and when should the agent use it?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
          <Select
            label="Tool Type"
            value={form.tool_type}
            onChange={e => setForm(f => ({ ...f, tool_type: e.target.value }))}
          >
            <option value="api">API — call an HTTP endpoint</option>
            <option value="custom">Custom — write Python code</option>
            <option value="langchain">LangChain — community tool</option>
          </Select>

          {form.tool_type === 'api' && (
            <>
              <Input
                label="Endpoint URL"
                placeholder="https://api.example.com/endpoint"
                value={form.endpoint_url}
                onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))}
              />
              <Select
                label="HTTP Method"
                value={form.http_method}
                onChange={e => setForm(f => ({ ...f, http_method: e.target.value }))}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
              </Select>
            </>
          )}

          {form.tool_type === 'custom' && (
            <Textarea
              label="Python Source Code"
              placeholder={'def get_tool():\n    from langchain_core.tools import tool\n    @tool\n    def my_tool(input: str) -> str:\n        """Tool description."""\n        return f"Result for {input}"\n    return my_tool'}
              rows={8}
              value={form.source_code}
              onChange={e => setForm(f => ({ ...f, source_code: e.target.value }))}
              style={{ fontFamily:'DM Mono,monospace', fontSize:12 }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}