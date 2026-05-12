'use strict'

const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const path = require('path')
const os = require('os')

const PORT = Number(process.env.PORT) || 3000
const SUPABASE_TARGET = 'https://xcvbeffecftjyejddvmg.supabase.co'

const app = express()

// ── Proxy para o Supabase (REST + WebSocket do Realtime) ───────────────────
const supabaseProxy = createProxyMiddleware({
  target: SUPABASE_TARGET,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/supabase': '' },
})
app.use('/supabase', supabaseProxy)

// ── Arquivos estáticos do app ──────────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))

// ── Iniciar ────────────────────────────────────────────────────────────────
function getLocalIP() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

const server = app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP()
  console.log('\n========================================')
  console.log('  GANTT - Servidor Local')
  console.log('========================================')
  console.log(`\n  Este computador:  http://localhost:${PORT}`)
  console.log(`  Rede interna:     http://${ip}:${PORT}`)
  console.log('\n  Abra o link "Rede interna" no')
  console.log('  computador da producao.\n')
  console.log('  Pressione Ctrl+C para encerrar.')
  console.log('========================================\n')
})

// Suporte a WebSocket (Supabase Realtime)
server.on('upgrade', supabaseProxy.upgrade)
