
import { useEffect, useMemo, useState } from 'react'
import GummyRain from './components/GummyRain'
import { initGoogle, ensureAuthorized, fetchYearEvents, signOut } from './lib/googleCalendar'
import type { CalendarEvent } from './lib/types'

export default function App() {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const years = useMemo(() => {
    const y = new Date().getFullYear()
    return [y-1, y, y+1]
  }, [])

  useEffect(() => {
    initGoogle().then(() => setReady(true)).catch(err => console.error(err))
  }, [])

  const handleAuthorize = async () => {
    try {
      await ensureAuthorized()
      setAuthed(true)
    } catch (e) {
      console.error(e)
      alert('認証に失敗しました。環境変数やOAuth設定を確認してください。')
    }
  }

  const handleFetch = async () => {
    try {
      const evs = await fetchYearEvents({ year })
      setEvents(evs)
    } catch (e) {
      console.error(e)
      alert('イベント取得に失敗しました')
    }
  }

  const handleSignOut = () => {
    signOut()
    setAuthed(false)
    setEvents([])
  }

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <h1>エアライダーのグミシステム</h1>
      <p>Google Calendar の年間イベントをグミ化して降らせます。</p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          年度: 
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button onClick={handleAuthorize} disabled={!ready || authed}>
          {authed ? '認証済み' : 'Googleに認証'}
        </button>
        <button onClick={handleFetch} disabled={!authed}>今年のイベント取得</button>
        <button onClick={handleSignOut} disabled={!authed}>サインアウト</button>
        <span style={{ opacity: 0.7 }}>取得件数: {events.length}</span>
      </div>

      <GummyRain events={events} />
      <div style={{ marginTop: 12 }}>
        <em>“今年も色々頑張ったな〜” → 嬉しい！</em>
      </div>
    </div>
  )
}
