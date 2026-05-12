'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AdminPage() {
  const [users, setUsers] = useState<any[]>([])

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setUsers(data)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function approveUser(id: string) {
    await supabase
      .from('profiles')
      .update({
        approved: true
      })
      .eq('id', id)

    loadUsers()
  }

  async function upgradeUser(id: string) {
    await supabase
      .from('profiles')
      .update({
        package: 'premium'
      })
      .eq('id', id)

    loadUsers()
  }

  async function deleteUser(id: string) {
    await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    loadUsers()
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#050510',
        color: 'white',
        padding: '40px',
        fontFamily: 'var(--font-inter)',
      }}
    >
      <h1
        className="heading-font"
        style={{
          fontSize: '54px',
          fontWeight: '900',
          marginBottom: '30px',
        }}
      >
        Admin Dashboard
      </h1>

      <div
        style={{
          overflowX: 'auto',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              {[
                'Email',
                'Role',
                'Package',
                'Approved',
                'Created',
                'Actions',
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '20px',
                    textAlign: 'left',
                    color: '#cbd5e1',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                style={{
                  borderTop:
                    '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <td style={{ padding: '20px' }}>
                  {user.email}
                </td>

                <td style={{ padding: '20px' }}>
                  {user.role}
                </td>

                <td style={{ padding: '20px' }}>
                  {user.package}
                </td>

                <td style={{ padding: '20px' }}>
                  {user.approved ? '✅' : '❌'}
                </td>

                <td style={{ padding: '20px' }}>
                  {new Date(
                    user.created_at
                  ).toLocaleDateString()}
                </td>

                <td style={{ padding: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                    }}
                  >
                    <button
                      onClick={() =>
                        approveUser(user.id)
                      }
                      style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: '#16a34a',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '700',
                      }}
                    >
                      Approve
                    </button>

                    <button
                      onClick={() =>
                        upgradeUser(user.id)
                      }
                      style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: '#7c3aed',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '700',
                      }}
                    >
                      Upgrade
                    </button>

                    <button
                      onClick={() =>
                        deleteUser(user.id)
                      }
                      style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: '#dc2626',
                        color: 'white',
                        cursor: 'pointer',
                        fontWeight: '700',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
