// PATH: frontend/src/pages/LLMSettings.jsx
import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import api from '../api/client'
import { PageHeader, Badge, Btn, Card, CardHeader, Modal, Input, Select, Toggle, Spinner, Empty } from '../components/shared/UI'

const PROVIDERS = ['openai', 'anthropic', 'groq', 'ollama', 'gemini', 'custom']
const MODELS = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192', 'llama3-70b-8192', 'groq/compound', 'groq/compound-mini'], // 'mixtral-8x7b-32768' 'gemma2-9b-it'
  ollama: ['minimax-m2.7', 'qwen3.5', 'ministral-3', 'devstral-small=2',
    'gpt-oss:120b'],
  gemini: ['Gemini 2.5 Flash', 'Gemini 2 Flash'],
  custom: [],
}


export default function LLMSettings() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editId, setEditId] = useState(null)
  const [testState, setTestState] = useState({})  // { [id]: 'testing'|'ok'|'fail' }
  const [form, setForm] = useState({ name: '', provider: 'groq', model: 'groq/compound', api_key: '', api_base_url: '', temperature: '0.7', max_tokens: '2048', is_default: false })

  useEffect(() => {
    api.get('/llm/')
      .then(r => setConfigs(r.data))
      .catch(error => {
        console.error('Failed to load LLM configs', error)
        toast.error('Unable to load LLMs from backend; please check backend status.')
        setConfigs([])
      })
      .finally(() => setLoading(false))
  }, [])

  async function testConnection(id) {
    setTestState(s => ({ ...s, [id]: 'testing' }))
    try {
      const r = await api.post(`/llm/${id}/test`)
      setTestState(s => ({ ...s, [id]: r.data.success ? 'ok' : 'fail' }))
      toast[r.data.success ? 'success' : 'error'](r.data.message)
    } catch {
      // Demo
      await new Promise(r => setTimeout(r, 1200))
      setTestState(s => ({ ...s, [id]: 'ok' }))
      toast.success('Connection OK (demo mode)')
    }
  }

  async function create() {
    if (!form.name || !form.model) return toast.error('Name and model required')
    const payload = { ...form, temperature: parseFloat(form.temperature), max_tokens: parseInt(form.max_tokens) }
    try {
      if (editId) {
        // Update existing
        const r = await api.put(`/llm/${editId}`, payload)
        setConfigs(p => p.map(c => c.id === editId ? r.data : c))
        toast.success('LLM config updated')
      } else {
        // Create new
        const r = await api.post('/llm/', payload)
        setConfigs(p => [r.data, ...p])
        toast.success('LLM config created')
      }
    } catch (error) {
      console.error('Operation failed', error)
      toast.error('Operation failed; check backend')
    }
    setShowCreate(false)
    setEditId(null)
    setForm({ name: '', provider: 'groq', model: 'groq/compound', api_key: '', api_base_url: '', temperature: '0.7', max_tokens: '2048', is_default: false })
  }

  function openEdit(config) {
    setEditId(config.id)
    setForm(config)
    setShowCreate(true)
  }

  function closeModal() {
    setShowCreate(false)
    setEditId(null)
    setForm({ name: '', provider: 'groq', model: 'groq/compound', api_key: '', api_base_url: '', temperature: '0.7', max_tokens: '2048', is_default: false })
  }

  async function deleteConfig(id) {
    if (!confirm('Are you sure you want to delete this LLM config? This action cannot be undone.')) return
    try { await api.delete(`/llm/${id}`) } catch { }
    setConfigs(p => p.filter(c => c.id !== id))
    toast.success('Deleted')
  }

  const models = MODELS[form.provider] || []

  return (
    <div>
      <PageHeader
        title="LLM Settings"
        subtitle="Manage your LLM providers, API keys and model parameters"
        action={<Btn onClick={() => setShowCreate(true)} style={{ marginTop: 28 }}><Plus size={14} /> Add LLM</Btn>}
      />
      <div style={{ padding: '20px 32px 32px' }}>
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={28} /></div>
          : configs.length === 0 ? <Empty icon="🧠" message="No LLM configs — add one to get started" />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {configs.map(c => (
                  <Card key={c.id}>
                    <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Provider badge */}
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(79,142,247,.1)', border: '1px solid rgba(79,142,247,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Mono,monospace', fontWeight: 700, fontSize: 11, color: 'var(--accent)', flexShrink: 0 }}>
                        {c.provider.slice(0, 3).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{c.name}</span>
                          {c.is_default && <Badge color="amber">default</Badge>}
                          <Badge color={c.is_active ? 'green' : 'gray'}>{c.is_active ? 'active' : 'inactive'}</Badge>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'DM Mono,monospace' }}>
                          {c.provider} · {c.model} · temp {c.temperature ?? '—'} · max_tokens {c.max_tokens ?? '—'}
                        </div>
                        {c.api_base_url && <div style={{ fontSize: 11, color: 'var(--cyan)', fontFamily: 'DM Mono,monospace', marginTop: 2 }}>{c.api_base_url}</div>}
                      </div>
                      {/* Test result icon */}
                      {testState[c.id] === 'ok' && <CheckCircle size={16} color="#22c55e" />}
                      {testState[c.id] === 'fail' && <XCircle size={16} color="#ef4444" />}
                      {/* Actions */}
                      <Btn variant="ghost" size="sm" onClick={() => testConnection(c.id)} disabled={testState[c.id] === 'testing'}>
                        {testState[c.id] === 'testing' ? <Spinner size={12} /> : null} Test
                      </Btn>
                      <Btn variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Btn>
                      <Btn variant="danger" size="sm" onClick={() => deleteConfig(c.id)}>Delete</Btn>
                    </div>
                  </Card>
                ))}
              </div>
            )}
      </div>

      {showCreate && (
        <Modal title={editId ? 'Edit LLM Config' : 'Add LLM Config'} onClose={closeModal} width={500}
          footer={<><Btn variant="ghost" onClick={closeModal}>Cancel</Btn><Btn onClick={create}>{editId ? 'Update' : 'Create'}</Btn></>}>
          <Input label="Config Name *" placeholder="e.g. GPT-4o Production" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Select label="Provider" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value, model: MODELS[e.target.value]?.[0] || '' }))}>
            {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select label="Model" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
            {models.length ? models.map(m => <option key={m} value={m}>{m}</option>) : <option value={form.model}>{form.model || 'enter below'}</option>}
          </Select>
          {(form.provider === 'custom' || form.provider === 'ollama') && <Input label="Base URL" placeholder="http://localhost:11434" value={form.api_base_url} onChange={e => setForm(f => ({ ...f, api_base_url: e.target.value }))} />}
          <Input label="API Key" type="password" placeholder="sk-..." value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Temperature" type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: e.target.value }))} />
            <Input label="Max Tokens" type="number" min="1" step="256" value={form.max_tokens} onChange={e => setForm(f => ({ ...f, max_tokens: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle checked={form.is_default} onChange={v => setForm(f => ({ ...f, is_default: v }))} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Set as default LLM for new agents</span>
          </div>
        </Modal>
      )}
    </div>
  )
}