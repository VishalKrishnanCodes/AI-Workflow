import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/shared/Layout'
import Dashboard from './pages/Dashboard'
import AgentManagement from './pages/AgentManagement'
import LLMSettings from './pages/LLMSettings'
import ToolsManagement from './pages/ToolsManagement'
import TaskScheduler from './pages/TaskScheduler'
import TaskRunHistory from './pages/TaskRunHistory'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/agents" element={<AgentManagement />} />
        <Route path="/llm" element={<LLMSettings />} />
        <Route path="/tools" element={<ToolsManagement />} />
        <Route path="/scheduler" element={<TaskScheduler />} />
        <Route path="/history" element={<TaskRunHistory />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}