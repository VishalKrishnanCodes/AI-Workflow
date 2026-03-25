// PATH: frontend/src/components/shared/Layout.jsx
//
// The persistent shell: sidebar navigation + main content area.
// Every page is rendered inside <main> — the sidebar never re-mounts.

import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bot, BrainCircuit,
  Wrench, Clock, ScrollText,
} from 'lucide-react'

const NAV = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/agents',    icon: Bot,             label: 'Agents'       },
  { to: '/llm',       icon: BrainCircuit,    label: 'LLM Settings' },
  { to: '/tools',     icon: Wrench,          label: 'Tools'        },
  { to: '/scheduler', icon: Clock,           label: 'Scheduler'    },
  { to: '/history',   icon: ScrollText,      label: 'Run History'  },
]

export default function Layout({ children }) {
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220, minWidth: 220,
        background: '#111318',
        borderRight: '1px solid #23262f',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid #23262f' }}>
          <div style={{ fontFamily:'Syne,sans-serif', fontSize:17, fontWeight:800, letterSpacing:'-0.5px' }}>
            ⬡ Orion
          </div>
          <div style={{ fontSize:10, color:'#6b7080', letterSpacing:'2px', textTransform:'uppercase', marginTop:3, fontFamily:'DM Mono,monospace' }}>
            AI Workflow
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ padding:'12px 10px', flex:1, display:'flex', flexDirection:'column', gap:2 }}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                border: '1px solid transparent',
                color:      isActive ? '#4f8ef7'              : '#6b7080',
                background: isActive ? 'rgba(79,142,247,.08)' : 'transparent',
                borderColor:isActive ? 'rgba(79,142,247,.15)' : 'transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={15} style={{ opacity: isActive ? 1 : 0.7 }} />
                  <span style={{ fontFamily:'DM Sans,sans-serif' }}>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer status */}
        <div style={{ padding:'14px 18px', borderTop:'1px solid #23262f' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'#6b7080', fontFamily:'DM Mono,monospace' }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 2s infinite' }} />
            API connected
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        {children}
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </div>
  )
}