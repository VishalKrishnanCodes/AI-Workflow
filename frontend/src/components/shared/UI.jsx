// PATH: frontend/src/components/shared/UI.jsx
//
// Tiny reusable primitives used across all pages.
// Import what you need: import { Badge, Btn, Card, Spinner, Toggle } from '../shared/UI'

import React from 'react'

/* ── Badge ─────────────────────────────────────────────────────── */
const BADGE_COLORS = {
  green:  { bg:'rgba(34,197,94,.1)',  color:'#22c55e' },
  red:    { bg:'rgba(239,68,68,.1)',  color:'#ef4444' },
  amber:  { bg:'rgba(245,158,11,.1)', color:'#f59e0b' },
  blue:   { bg:'rgba(79,142,247,.1)', color:'#4f8ef7' },
  purple: { bg:'rgba(124,58,237,.1)', color:'#7c3aed' },
  gray:   { bg:'rgba(107,112,128,.1)',color:'#6b7080' },
  cyan:   { bg:'rgba(6,182,212,.1)',  color:'#06b6d4' },
}

export function Badge({ color = 'gray', children, dot }) {
  const s = BADGE_COLORS[color] || BADGE_COLORS.gray
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'3px 9px', borderRadius:100,
      fontSize:11, fontWeight:500, fontFamily:'DM Mono,monospace',
      background: s.bg, color: s.color,
    }}>
      {dot && <span style={{ width:5, height:5, borderRadius:'50%', background:s.color, display:'inline-block' }} />}
      {children}
    </span>
  )
}

/* ── Button ────────────────────────────────────────────────────── */
export function Btn({ variant='primary', size='md', onClick, children, disabled, style={} }) {
  const base = {
    display:'inline-flex', alignItems:'center', gap:6,
    borderRadius:8, fontFamily:'DM Sans,sans-serif', fontWeight:500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? .5 : 1, border:'none',
    padding: size==='sm' ? '5px 12px' : '8px 16px',
    fontSize: size==='sm' ? 12 : 13,
    transition: 'all .15s',
    ...style,
  }
  const variants = {
    primary: { background:'#4f8ef7', color:'#fff' },
    ghost:   { background:'transparent', color:'#6b7080', border:'1px solid #23262f' },
    danger:  { background:'rgba(239,68,68,.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,.2)' },
    success: { background:'rgba(34,197,94,.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,.2)' },
  }
  return (
    <button style={{ ...base, ...variants[variant] }} onClick={disabled ? undefined : onClick} disabled={disabled}>
      {children}
    </button>
  )
}

/* ── Card ──────────────────────────────────────────────────────── */
export function Card({ children, style={} }) {
  return (
    <div style={{
      background:'#111318', border:'1px solid #23262f',
      borderRadius:14, ...style,
    }}>
      {children}
    </div>
  )
}

export function CardHeader({ title, right }) {
  return (
    <div style={{
      padding:'15px 20px', borderBottom:'1px solid #23262f',
      display:'flex', alignItems:'center', justifyContent:'space-between',
    }}>
      <span style={{ fontFamily:'Syne,sans-serif', fontWeight:600, fontSize:14 }}>{title}</span>
      {right}
    </div>
  )
}

/* ── Page shell ────────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ padding:'28px 32px 0', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
      <div>
        <h1 style={{ fontFamily:'Syne,sans-serif', fontSize:22, fontWeight:700 }}>{title}</h1>
        {subtitle && <p style={{ fontSize:13, color:'#6b7080', marginTop:4 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ── Spinner ───────────────────────────────────────────────────── */
export function Spinner({ size=18 }) {
  return (
    <span style={{
      display:'inline-block', width:size, height:size,
      border:`2px solid #23262f`, borderTopColor:'#4f8ef7',
      borderRadius:'50%', animation:'spin .7s linear infinite',
    }} />
  )
}

/* ── Toggle switch ─────────────────────────────────────────────── */
export function Toggle({ checked, onChange }) {
  return (
    <label style={{ position:'relative', display:'inline-block', width:36, height:20, cursor:'pointer', flexShrink:0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ opacity:0, width:0, height:0 }} />
      <span style={{
        position:'absolute', inset:0, borderRadius:100,
        background: checked ? '#4f8ef7' : '#2e3240',
        transition:'background .2s',
      }} />
      <span style={{
        position:'absolute', top:3, left: checked ? 19 : 3,
        width:14, height:14, background:'#fff',
        borderRadius:'50%', transition:'left .2s',
      }} />
    </label>
  )
}

/* ── Input / Select / Textarea ─────────────────────────────────── */
const inputBase = {
  width:'100%', background:'#1a1d25', border:'1px solid #23262f',
  borderRadius:8, padding:'9px 13px', color:'#e8eaf0',
  fontSize:13, fontFamily:'DM Sans,sans-serif', outline:'none',
}

export function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:'block', fontSize:11, color:'#6b7080', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px', fontFamily:'DM Mono,monospace' }}>{label}</label>}
      <input style={inputBase} {...props} />
    </div>
  )
}

export function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:'block', fontSize:11, color:'#6b7080', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px', fontFamily:'DM Mono,monospace' }}>{label}</label>}
      <select style={{ ...inputBase, cursor:'pointer' }} {...props}>{children}</select>
    </div>
  )
}

export function Textarea({ label, rows=4, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:'block', fontSize:11, color:'#6b7080', marginBottom:5, textTransform:'uppercase', letterSpacing:'.5px', fontFamily:'DM Mono,monospace' }}>{label}</label>}
      <textarea style={{ ...inputBase, resize:'vertical', lineHeight:1.6 }} rows={rows} {...props} />
    </div>
  )
}

/* ── Modal ─────────────────────────────────────────────────────── */
export function Modal({ title, onClose, footer, children, width=520 }) {
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', backdropFilter:'blur(4px)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background:'#111318', border:'1px solid #23262f', borderRadius:14, width, maxHeight:'88vh', overflow:'auto' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #23262f', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontFamily:'Syne,sans-serif', fontWeight:700, fontSize:16 }}>{title}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6b7080', cursor:'pointer', fontSize:20, lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
        {footer && <div style={{ padding:'16px 24px', borderTop:'1px solid #23262f', display:'flex', justifyContent:'flex-end', gap:10 }}>{footer}</div>}
      </div>
    </div>
  )
}

/* ── Empty state ───────────────────────────────────────────────── */
export function Empty({ icon, message }) {
  return (
    <div style={{ padding:'60px 20px', textAlign:'center', color:'#6b7080' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:14 }}>{message}</div>
    </div>
  )
}

/* Global spin keyframe injected once */
const styleTag = document.createElement('style')
styleTag.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'
document.head.appendChild(styleTag)