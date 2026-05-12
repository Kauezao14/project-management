import { createClient } from '@supabase/supabase-js'

const DIRECT_URL = 'https://xcvbeffecftjyejddvmg.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjdmJlZmZlY2Z0anllamRkdm1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTYzMTEsImV4cCI6MjA5NDE3MjMxMX0.BJqyr0ff-KF6WIvXyXowdHuRbjkCkIhDgJlsNQLsPoY'

function resolveApiUrl(): string {
  const host = window.location.hostname
  // GitHub Pages or local dev → direct Supabase connection
  if (host.includes('github.io') || host === 'localhost' || host === '127.0.0.1') {
    return DIRECT_URL
  }
  // LAN access via local server — proxy is on the same origin
  const port = window.location.port ? `:${window.location.port}` : ''
  return `${window.location.protocol}//${host}${port}/supabase`
}

export const supabase = createClient(resolveApiUrl(), ANON_KEY)
