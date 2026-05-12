'use client'
import { useState, useEffect } from 'react'

const ADMIN_EMAIL = 'whwva47@gmail.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tpjbzvzekqzmhuyhiihl.supabase.co'
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Simple Supabase REST client
async function supabaseQuery(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase error: ${err}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : []
}

type Operator = {
  id: string
  email: string
  plan: string
  plan_status: string
  trial_ends_at: string | null
  plan_expires_at: string | null
  daily_generations: number
  total_generations: number
  created_at: string
  explicit_enabled: boolean
}

type ProRequest = {
  id: string
  email: string
  payment_method: string
  status: string
  created_at: string
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
:root{--bg:#06060E;--bg2:#0C0C1A;--bg3:#111128;--card:#0E0E22;--bd:rgba(139,92,246,0.15);--bd2:rgba(212,163,0,0.2);--p:#7C3AED;--pl:#A855F7;--pll:#C4B5FD;--g:#D4A300;--gl:#F5D98A;--t1:#EDE9FE;--t2:#A78BFA;--t3:#6D6A8A;--ok:#34D399;--err:#F87171;--warn:#FBD96A;--serif:'Cinzel',serif;--sans:'DM Sans',sans-serif}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--sans);background:var(--bg);color:var(--t1);min-height:100vh;-webkit-font-smoothing:antialiased}
.container{max-width:1100px;margin:0 auto;padding:24px}
.topbar{background:rgba(6,6,14,0.96);backdrop-filter:blur(16px);border-bottom:1px solid var(--bd);padding:14px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
.brand{font-family:var(--serif);font-size:15px;font-weight:700;background:linear-gradient(135deg,var(--pl),var(--gl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.card{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:20px;margin-bottom:16px}
.table{width:100%;border-collapse:collapse;font-size:12.5px}
.table th{text-align:left;padding:8px 12px;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.08em;border-bottom:1px solid var(--bd)}
.table td{padding:9px 12px;border-bottom:1px solid rgba(139,92,246,0.07);color:var(--t2);vertical-align:middle}
.table tr:hover td{background:rgba(124,58,237,0.04)}
.badge{display:inline-block;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:700}
.badge-pro{background:rgba(212,163,0,0.15);color:var(--gl);border:1px solid rgba(212,163,0,0.3)}
.badge-basic{background:rgba(96,165,250,0.12);color:#60a5fa;border:1px solid rgba(96,165,250,0.25)}
.badge-free{background:rgba(52,211,153,0.1);color:var(--ok);border:1px solid rgba(52,211,153,0.25)}
.badge-pending{background:rgba(251,217,106,0.12);color:var(--warn);border:1px solid rgba(251,217,106,0.25)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:6px 13px;border-radius:7px;font-family:var(--sans);font-size:11.5px;font-weight:600;cursor:pointer;border:none;transition:all 0.15s}
.btn-primary{background:linear-gradient(135deg,var(--p),var(--pl));color:#fff}
.btn-gold{background:linear-gradient(135deg,var(--g),var(--gl));color:#0a0a1a}
.btn-ghost{background:rgba(124,58,237,0.08);color:var(--pll);border:1px solid var(--bd)}
.btn-danger{background:rgba(248,113,113,0.1);color:var(--err);border:1px solid rgba(248,113,113,0.25)}
.btn-sm{padding:4px 9px;font-size:10.5px}
.btn:disabled{opacity:0.4;cursor:not-allowed}
.inp{padding:9px 12px;background:rgba(0,0,0,0.3);border:1px solid var(--bd);border-radius:8px;color:var(--t1);font-size:13px;font-family:var(--sans);outline:none;transition:border-color 0.2s}
.inp:focus{border-color:var(--pl)}
.inp::placeholder{color:var(--t3)}
select.inp{cursor:pointer}
.lbl{display:block;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:100;display:flex;align-items:center;justify-content:center;padding:24px}
.modal{background:var(--card);border:1px solid var(--bd2);border-radius:16px;padding:28px;width:100%;max-width:440px}
.modal-title{font-family:var(--serif);font-size:16px;color:var(--gl);margin-bottom:16px}
.spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.15);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.stat-box{background:rgba(13,13,30,0.8);border:1px solid var(--bd);border-radius:12px;padding:16px;text-align:center}
.stat-num{font-family:var(--serif);font-size:24px;font-weight:700;margin-bottom:4px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
@media(max-width:700px){.g4{grid-template-columns:repeat(2,1fr)}}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.3);border-radius:2px}
`

export default function AdminPage() {
  const [authed, setAuthed]         = useState(false)
  const [password, setPassword]     = useState('')
  const [authErr, setAuthErr]       = useState('')
  const [operators, setOperators]   = useState<Operator[]>([])
  const [requests, setRequests]     = useState<ProRequest[]>([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = useState('')
  const [editOp, setEditOp]         = useState<Operator|null>(null)
  const [editPlan, setEditPlan]     = useState('pro')
  const [editDays, setEditDays]     = useState(30)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState('')
  const [tab, setTab]               = useState<'operators'|'requests'>('operators')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function checkPassword() {
    // Simple admin password -- change this to something secure
    if (password === 'cic-admin-2026') {
      setAuthed(true)
      loadData()
    } else {
      setAuthErr('Incorrect password.')
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const [ops, reqs] = await Promise.all([
        supabaseQuery('profiles?order=created_at.desc&limit=200'),
        supabaseQuery('pro_requests?order=created_at.desc&limit=100'),
      ])
      setOperators(ops)
      setRequests(reqs)
    } catch (e: any) {
      showToast('Error loading data: ' + e.message)
    }
    setLoading(false)
  }

  async function saveOperator() {
    if (!editOp) return
    setSaving(true)
    try {
      const expires = new Date()
      expires.setDate(expires.getDate() + editDays)

      const updates: any = {
        plan: editPlan,
        plan_status: 'approved',
        plan_expires_at: editPlan === 'free' ? null : expires.toISOString(),
        explicit_enabled: editPlan === 'pro',
        max_daily_generations: editPlan === 'pro' ? 999999 : editPlan === 'basic' ? 999999 : 50,
      }

      await supabaseQuery(`profiles?email=eq.${encodeURIComponent(editOp.email)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })

      showToast(`Updated ${editOp.email} to ${editPlan}`)
      setEditOp(null)
      loadData()
    } catch (e: any) {
      showToast('Error: ' + e.message)
    }
    setSaving(false)
  }

  async function extendTrial(op: Operator, days: number) {
    try {
      const newEnd = new Date()
      newEnd.setDate(newEnd.getDate() + days)
      await supabaseQuery(`profiles?email=eq.${encodeURIComponent(op.email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ trial_ends_at: newEnd.toISOString() }),
      })
      showToast(`Trial extended ${days} days for ${op.email}`)
      loadData()
    } catch (e: any) {
      showToast('Error: ' + e.message)
    }
  }

  async function deleteOperator(op: Operator) {
    if (!confirm(`Delete ${op.email}? This cannot be undone.`)) return
    try {
      await supabaseQuery(`profiles?email=eq.${encodeURIComponent(op.email)}`, {
        method: 'DELETE',
      })
      showToast(`Deleted ${op.email}`)
      loadData()
    } catch (e: any) {
      showToast('Error: ' + e.message)
    }
  }

  async function approveRequest(req: ProRequest) {
    setSaving(true)
    try {
      const expires = new Date()
      expires.setDate(expires.getDate() + 30)
      // Activate pro
      await supabaseQuery(`profiles?email=eq.${encodeURIComponent(req.email)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          plan: 'pro',
          plan_status: 'approved',
          plan_expires_at: expires.toISOString(),
          explicit_enabled: true,
          max_daily_generations: 999999,
        }),
      })
      // Mark request as paid
      await supabaseQuery(`pro_requests?id=eq.${req.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      })
      showToast(`Pro activated for ${req.email}`)
      loadData()
    } catch (e: any) {
      showToast('Error: ' + e.message)
    }
    setSaving(false)
  }

  async function dismissRequest(req: ProRequest) {
    try {
      await supabaseQuery(`pro_requests?id=eq.${req.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'dismissed' }),
      })
      showToast(`Dismissed request from ${req.email}`)
      loadData()
    } catch (e: any) {
      showToast('Error: ' + e.message)
    }
  }

  function daysLeft(dateStr: string | null) {
    if (!dateStr) return '--'
    const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
    return d > 0 ? `${d}d` : 'Expired'
  }

  const filtered = operators.filter(o =>
    !search || o.email.toLowerCase().includes(search.toLowerCase()) || o.plan.includes(search)
  )

  const stats = {
    total: operators.length,
    pro:   operators.filter(o => o.plan === 'pro').length,
    basic: operators.filter(o => o.plan === 'basic').length,
    trial: operators.filter(o => o.plan === 'free').length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
  }

  // Auth screen
  if (!authed) return (
    <>
      <style>{CSS}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)' }}>
        <div className="card" style={{ width:340, textAlign:'center', padding:32 }}>
          <div style={{ fontFamily:'var(--serif)', fontSize:18, color:'var(--gl)', marginBottom:6 }}>CIC Admin</div>
          <div style={{ fontSize:12, color:'var(--t3)', marginBottom:20 }}>Operator Management</div>
          <input className="inp" type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && checkPassword()}
            placeholder="Admin password" style={{ width:'100%', marginBottom:10 }}/>
          {authErr && <div style={{ color:'var(--err)', fontSize:12, marginBottom:10 }}>{authErr}</div>}
          <button className="btn btn-gold" style={{ width:'100%' }} onClick={checkPassword}>Enter</button>
        </div>
      </div>
    </>
  )

  return (
    <>
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:20, right:20, background:'var(--card)', border:'1px solid var(--ok)', borderRadius:10, padding:'10px 16px', fontSize:13, color:'var(--ok)', zIndex:200 }}>
          {toast}
        </div>
      )}

      {/* Edit Modal */}
      {editOp && (
        <div className="modal-bg" onClick={() => setEditOp(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Operator</div>
            <div style={{ fontSize:13, color:'var(--t2)', marginBottom:16 }}>{editOp.email}</div>

            <div style={{ marginBottom:12 }}>
              <label className="lbl">Plan</label>
              <select className="inp" style={{ width:'100%' }} value={editPlan} onChange={e => setEditPlan(e.target.value)}>
                <option value="pro">Pro -- $15/month</option>
                <option value="basic">Basic -- $8/month</option>
                <option value="free">Free Trial</option>
              </select>
            </div>

            {editPlan !== 'free' && (
              <div style={{ marginBottom:16 }}>
                <label className="lbl">Duration (days)</label>
                <select className="inp" style={{ width:'100%' }} value={editDays} onChange={e => setEditDays(+e.target.value)}>
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </div>
            )}

            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="btn btn-gold" onClick={saveOperator} disabled={saving} style={{ flex:1 }}>
                {saving ? <><span className="spin"/> Saving...</> : 'Save Changes'}
              </button>
              <button className="btn btn-danger" onClick={() => deleteOperator(editOp)} style={{ flex:1 }}>
                Delete Account
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditOp(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="topbar">
        <div className="brand">CIC Admin</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={loadData} disabled={loading}>
            {loading ? <><span className="spin"/> Loading</> : 'Refresh'}
          </button>
          <a href="/dashboard" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Dashboard</a>
        </div>
      </div>

      <div className="container">

        {/* Stats */}
        <div className="g4">
          {[
            { val: stats.total,           label: 'Total Operators',   cls: 'var(--pll)' },
            { val: stats.pro,             label: 'Pro',               cls: 'var(--gl)'  },
            { val: stats.basic,           label: 'Basic',             cls: '#60a5fa'    },
            { val: stats.pendingRequests, label: 'Pending Upgrades',  cls: 'var(--warn)'},
          ].map(s => (
            <div key={s.label} className="stat-box">
              <div className="stat-num" style={{ color: s.cls }}>{s.val}</div>
              <div style={{ fontSize:11, color:'var(--t3)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <button className={`btn ${tab==='operators'?'btn-primary':'btn-ghost'}`} onClick={() => setTab('operators')}>
            Operators ({stats.total})
          </button>
          <button className={`btn ${tab==='requests'?'btn-primary':'btn-ghost'}`} onClick={() => setTab('requests')}>
            Upgrade Requests {stats.pendingRequests > 0 && `(${stats.pendingRequests} pending)`}
          </button>
        </div>

        {/* OPERATORS TAB */}
        {tab === 'operators' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bd)', display:'flex', gap:10, alignItems:'center' }}>
              <input className="inp" placeholder="Search by email or plan..." value={search}
                onChange={e => setSearch(e.target.value)} style={{ flex:1 }}/>
              <div style={{ fontSize:12, color:'var(--t3)', whiteSpace:'nowrap' }}>{filtered.length} operators</div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Plan</th>
                    <th>Trial Ends</th>
                    <th>Plan Expires</th>
                    <th>Replies Today</th>
                    <th>Total Replies</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(op => (
                    <tr key={op.id}>
                      <td style={{ color:'var(--t1)', fontWeight:500 }}>{op.email}</td>
                      <td>
                        <span className={`badge badge-${op.plan === 'pro' ? 'pro' : op.plan === 'basic' ? 'basic' : 'free'}`}>
                          {op.plan.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ color: daysLeft(op.trial_ends_at) === 'Expired' ? 'var(--err)' : 'var(--t2)' }}>
                        {daysLeft(op.trial_ends_at)}
                      </td>
                      <td style={{ color: op.plan_expires_at && daysLeft(op.plan_expires_at) === 'Expired' ? 'var(--err)' : 'var(--t2)' }}>
                        {daysLeft(op.plan_expires_at)}
                      </td>
                      <td>{op.daily_generations || 0}</td>
                      <td>{op.total_generations || 0}</td>
                      <td>{op.created_at ? new Date(op.created_at).toLocaleDateString() : '--'}</td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="btn btn-ghost btn-sm"
                            onClick={() => { setEditOp(op); setEditPlan(op.plan); setEditDays(30) }}>
                            Edit
                          </button>
                          <button className="btn btn-sm" style={{ background:'rgba(52,211,153,0.1)', color:'var(--ok)', border:'1px solid rgba(52,211,153,0.2)' }}
                            onClick={() => extendTrial(op, 7)}>
                            +7d
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>
                      {loading ? 'Loading...' : 'No operators found'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Payment Method</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id}>
                      <td style={{ color:'var(--t1)', fontWeight:500 }}>{req.email}</td>
                      <td style={{ textTransform:'capitalize' }}>{req.payment_method || '--'}</td>
                      <td>
                        <span className={`badge ${req.status === 'pending' ? 'badge-pending' : req.status === 'paid' ? 'badge-pro' : 'badge-free'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td>{req.created_at ? new Date(req.created_at).toLocaleDateString() : '--'}</td>
                      <td>
                        {req.status === 'pending' && (
                          <div style={{ display:'flex', gap:5 }}>
                            <button className="btn btn-gold btn-sm" onClick={() => approveRequest(req)} disabled={saving}>
                              Activate Pro
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => dismissRequest(req)}>
                              Dismiss
                            </button>
                          </div>
                        )}
                        {req.status !== 'pending' && (
                          <span style={{ fontSize:11, color:'var(--t3)' }}>{req.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign:'center', padding:32, color:'var(--t3)' }}>
                      {loading ? 'Loading...' : 'No upgrade requests yet'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
