import { useState, useEffect, useRef } from 'react'
import './App.css'
import Sp500Chart from './Sp500Chart.jsx'
import GoldChart from './GoldChart.jsx'
import VixChart from './VixChart.jsx'

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const API = API_BASE ? `${API_BASE}/api` : '/api'

function useMarkets() {
  const [markets, setMarkets] = useState({ sp500_data: [], gold_data: [], vix_data: [], btc_data: [] })
  useEffect(() => {
    const load = () => {
      fetch(`${API}/markets`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => setMarkets({
          sp500_data: j.sp500_data || [],
          gold_data: j.gold_data || [],
          vix_data: j.vix_data || [],
          btc_data: j.btc_data || [],
        }))
    }
    load()
    const id = setInterval(load, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
  return markets
}

function SentimentGauge({ summary }) {
  if (!summary || summary.error) return null
  const score = summary.overall_score ?? 0
  const label = (summary.sentiment_label || 'neutral').toUpperCase()
  const displayLabel = label === 'POSITIVE' ? 'BULLISH' : label === 'NEGATIVE' ? 'BEARISH' : 'NEUTRAL'
  const pct = Math.round((score + 1) / 2 * 100)
  const color = score >= 0.05 ? '#22c55e' : score <= -0.05 ? '#ef4444' : '#eab308'

  return (
    <div className="gauge-card">
      <h3>Market Sentiment</h3>
      <div className="gauge-bullish-wrap">
        <div className="gauge-track gradient-track">
          <div className="gauge-needle" style={{ left: `${pct}%`, borderColor: color }} />
        </div>
        <div className="gauge-bullish-value">
          <span className="sentiment-label" style={{ color }}>{displayLabel}</span>
          <span className="gauge-value" style={{ color }}>{pct}/100</span>
        </div>
      </div>
      <p className="aggregated-label">Aggregated Sentiment Score</p>
      <div className="stats-row">
        <span className="stat positive">{summary.positive_pct}% positive</span>
        <span className="stat neutral">{summary.neutral_pct}% neutral</span>
        <span className="stat negative">{summary.negative_pct}% negative</span>
      </div>
    </div>
  )
}

function TrendBadge({ trend }) {
  if (!trend) return null
  const cls = trend === 'improving' ? 'trend-up' : trend === 'declining' ? 'trend-down' : 'trend-stable'
  return <span className={`trend-badge ${cls}`}>{trend}</span>
}

function formatTimestamp(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n) => String(n).padStart(2, '0')
  const dd = pad(d.getUTCDate())
  const mm = pad(d.getUTCMonth() + 1)
  const yyyy = d.getUTCFullYear()
  const hh = pad(d.getUTCHours())
  const min = pad(d.getUTCMinutes())
  const ss = pad(d.getUTCSeconds())
  return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss} GMT`
}

function NewsList({ news, hasMore, loadingMore, onLoadMore, total }) {
  if (!news?.length) return <p className="empty">No news yet. Run the pipeline to fetch articles.</p>
  const sentimentEmoji = (label) => {
    if (label === 'positive') return '😊'
    if (label === 'negative') return '☹'
    return '😐'
  }
  return (
    <div className="news-table-wrap">
      <table className="news-table">
        <thead>
          <tr>
            <th>Headline</th>
            <th>Type</th>
            <th>Source</th>
            <th>Timestamp</th>
            <th>Sentiment</th>
          </tr>
        </thead>
        <tbody>
          {news.map((article, i) => (
            <tr key={i}>
              <td>
                <a href={article.url || '#'} target="_blank" rel="noopener noreferrer" className="news-title">
                  {article.title || '(No title)'}
                </a>
              </td>
              <td className="news-type-cell">
                {article.news_type && <span className={`type-badge type-${(article.news_type || '').toLowerCase().replace(/[\s\/]+/g, '-')}`}>{article.news_type}</span>}
              </td>
              <td className="news-source-cell">{article.source}</td>
              <td className="news-time-cell">{formatTimestamp(article.published_at)}</td>
              <td>
                <span className={`sentiment-badge ${article.sentiment_label || 'neutral'}`}>
                  {(article.sentiment_label || 'neutral').charAt(0).toUpperCase() + (article.sentiment_label || 'neutral').slice(1)}
                  {' '}{sentimentEmoji(article.sentiment_label || 'neutral')}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : `Load More (${news.length} of ${total})`}
          </button>
        </div>
      )}
    </div>
  )
}

function SentimentYesterdayVsToday({ history }) {
  if (!history?.length) return null

  const byDate = {}
  for (const h of history) {
    const ts = h.timestamp
    const score = h.overall_score
    if (ts == null || score == null) continue
    const d = new Date(ts).toISOString().slice(0, 10)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(score)
  }
  const dates = Object.keys(byDate).sort()
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
  const todayStr = dates[dates.length - 1]
  const yesterdayStr = dates.length >= 2 ? dates[dates.length - 2] : null
  const todayScore = todayStr && byDate[todayStr] ? avg(byDate[todayStr]) : null
  const yesterdayScore = yesterdayStr && byDate[yesterdayStr] ? avg(byDate[yesterdayStr]) : null

  if (todayScore == null && yesterdayScore == null) return null

  const toLabel = (s) => (s >= 0.05 ? 'Positive' : s <= -0.05 ? 'Negative' : 'Neutral')
  const toColor = (s) => (s >= 0.05 ? '#86efac' : s <= -0.05 ? '#fca5a5' : '#bef264')
  const fmt = (s) => (s != null ? s.toFixed(2) : '—')

  return (
    <div className="chart-card sentiment-compare-card">
      <h3>Sentiment Yesterday vs Today</h3>
      <div className="sentiment-compare">
        <div className="sentiment-day">
          <span className="day-label">Yesterday</span>
          <span className="day-score" style={{ color: toColor(yesterdayScore) }}>{fmt(yesterdayScore)}</span>
          <span className="day-sentiment">{toLabel(yesterdayScore)}</span>
        </div>
        <div className="sentiment-vs">vs</div>
        <div className="sentiment-day">
          <span className="day-label">Today</span>
          <span className="day-score" style={{ color: toColor(todayScore) }}>{fmt(todayScore)}</span>
          <span className="day-sentiment">{toLabel(todayScore)}</span>
        </div>
      </div>
    </div>
  )
}

let _fgIdCounter = 0

function FearGreedCard({ fearGreed, title, source }) {
  const [ids] = useState(() => {
    const n = ++_fgIdCounter
    return { grad: `fgGrad${n}`, arc: `fgArc${n}`, shadow: `fgShadow${n}`, glow: `fgGlow${n}` }
  })

  if (!fearGreed || fearGreed.error) {
    const msg = fearGreed?.error === 'no_api_key'
      ? 'Set RAPIDAPI_KEY to enable'
      : fearGreed?.error
        ? `Unable to fetch: ${fearGreed.error}`
        : 'Loading…'
    return (
      <div className="correlation-card fear-greed-card">
        <h3>{title}</h3>
        <p className="correlation-empty">{msg}</p>
      </div>
    )
  }

  const value = fearGreed.value ?? 0
  const classification = fearGreed.classification || 'Unknown'
  const prevValue = fearGreed.previous_value
  const prevClassification = fearGreed.previous_classification
  const weekAgo = fearGreed.week_ago_value
  const pct = Math.min(100, Math.max(0, value))

  const cx = 100
  const cy = 90
  const r = 70
  const arcLen = Math.PI * r
  const strokeW = 18

  const needleAngle = Math.PI - Math.PI * (pct / 100)
  const needleLen = r - 8
  const needleX = cx + needleLen * Math.cos(needleAngle)
  const needleY = cy - needleLen * Math.sin(needleAngle)

  const segmentColor =
    pct <= 20 ? '#ef4444' :
    pct <= 40 ? '#f97316' :
    pct <= 60 ? '#eab308' :
    pct <= 80 ? '#84cc16' : '#22c55e'

  const filledLen = arcLen * (pct / 100)

  const changePrev = prevValue != null ? value - prevValue : null
  const changeWeek = weekAgo != null ? value - weekAgo : null

  return (
    <div className="correlation-card fear-greed-card">
      <h3>{title}</h3>
      <div className="fear-greed-gauge-wrap">
        <svg viewBox="0 0 200 115" className="fear-greed-svg">
          <defs>
            <linearGradient id={ids.grad} gradientUnits="userSpaceOnUse" x1="20" y1="90" x2="180" y2="90">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="25%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="75%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
            <path id={ids.arc} d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} />
            <filter id={ids.shadow}>
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.4" />
            </filter>
            <filter id={ids.glow}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Track */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" stroke="#1e293b" strokeWidth={strokeW} strokeLinecap="round" />
          {/* Filled arc */}
          <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none" stroke={`url(#${ids.grad})`} strokeWidth={strokeW} strokeLinecap="round"
            strokeDasharray={`${filledLen} ${arcLen}`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }} />
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const a = Math.PI - Math.PI * (tick / 100)
            const ix = cx + (r + 13) * Math.cos(a)
            const iy = cy - (r + 13) * Math.sin(a)
            const ox = cx + (r + 4) * Math.cos(a)
            const oy = cy - (r + 4) * Math.sin(a)
            return <g key={tick}>
              <line x1={ox} y1={oy} x2={ix} y2={iy} stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          })}
          {/* Zone labels */}
          <text x={cx - r - 6} y={cy + 12} fill="#ef4444" fontSize="7" fontWeight="600" textAnchor="start">0</text>
          <text x={cx} y={cy - r - 6} fill="#eab308" fontSize="7" fontWeight="600" textAnchor="middle">50</text>
          <text x={cx + r + 6} y={cy + 12} fill="#22c55e" fontSize="7" fontWeight="600" textAnchor="end">100</text>
          {/* Needle */}
          <line x1={cx} y1={cy} x2={needleX} y2={needleY}
            stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" filter={`url(#${ids.shadow})`}
            style={{ transition: 'x2 0.8s ease, y2 0.8s ease' }} />
          {/* Needle glow dot */}
          <circle cx={needleX} cy={needleY} r="3" fill={segmentColor} filter={`url(#${ids.glow})`} opacity="0.8" />
          {/* Center hub */}
          <circle cx={cx} cy={cy} r="6" fill="#1e293b" stroke="#475569" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="2.5" fill="#94a3b8" />
        </svg>
        <div className="fear-greed-value-block">
          <span className="fear-greed-value" style={{ color: segmentColor }}>{value}</span>
          <span className="fear-greed-classification-inline" style={{ color: segmentColor }}>
            {classification.toUpperCase()}
          </span>
        </div>
        <div className="fear-greed-changes">
          {changePrev != null && (
            <span className={`fg-change ${changePrev >= 0 ? 'fg-up' : 'fg-down'}`}>
              {changePrev >= 0 ? '▲' : '▼'} {Math.abs(changePrev)} prev close
            </span>
          )}
          {changeWeek != null && (
            <span className={`fg-change ${changeWeek >= 0 ? 'fg-up' : 'fg-down'}`}>
              {changeWeek >= 0 ? '▲' : '▼'} {Math.abs(changeWeek)} vs 1w ago
            </span>
          )}
        </div>
      </div>
      <p className="fear-greed-source">{source}</p>
    </div>
  )
}

function BtcTrackerCard({ btcData }) {
  if (!btcData?.length) {
    return (
      <div className="correlation-card btc-tracker-card">
        <h3>BTC Tracker</h3>
        <p className="correlation-empty">Loading…</p>
      </div>
    )
  }

  const latest = btcData[btcData.length - 1]
  const prev = btcData[btcData.length - 2]
  const price = latest?.close ?? 0
  const prevPrice = prev?.close ?? price
  const changePct = prevPrice ? ((price - prevPrice) / prevPrice) * 100 : 0
  const isUp = changePct >= 0

  const fmt = (n) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`
    return `$${n.toFixed(2)}`
  }

  return (
    <div className="correlation-card btc-tracker-card">
      <h3>
        <span className="btc-logo">₿</span> BTC Tracker
      </h3>
      <p className="btc-price">{fmt(price)}</p>
      <p className={`btc-change ${isUp ? 'up' : 'down'}`}>
        {isUp ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}% (24h)
      </p>
      <p className="btc-label">Bitcoin (BTC-USD)</p>
    </div>
  )
}


function OverallCorrelation({ apiBase }) {
  const [data, setData] = useState(null)
  const [activePeriod, setActivePeriod] = useState('7d')
  const canvasRef = useRef(null)

  useEffect(() => {
    fetch(`${apiBase}/correlation-matrix`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [apiBase])

  const period = data?.periods?.find((p) => p.key === activePeriod) || data?.periods?.[0]
  const matrix = period?.matrix || {}
  const indicators = data?.indicators || []
  const overallRow = matrix['Overall Sentiment'] || {}
  const hasOverall = Object.values(overallRow).some((v) => v != null)

  // Draw heatmap — single row: Overall Sentiment vs each ticker
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !hasOverall || !indicators.length) return

    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1

    const cellW = 90
    const cellH = 52
    const labelH = 40
    const totalW = indicators.length * cellW
    const totalH = labelH + cellH

    canvas.width = totalW * dpr
    canvas.height = totalH * dpr
    canvas.style.width = totalW + 'px'
    canvas.style.height = totalH + 'px'
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, totalW, totalH)

    indicators.forEach((ind, ci) => {
      const x = ci * cellW
      const val = overallRow[ind]

      // Label
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'center'
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif'
      ctx.fillText(ind, x + cellW / 2, labelH - 8)

      // Cell
      let bg = '#1e293b'
      let textColor = '#64748b'
      if (val != null) {
        const v = Math.max(-1, Math.min(1, val))
        if (v > 0) {
          const a = Math.min(v * 0.85, 0.75)
          bg = `rgba(34, 197, 94, ${a})`
          textColor = a > 0.3 ? '#fff' : '#e2e8f0'
        } else if (v < 0) {
          const a = Math.min(Math.abs(v) * 0.85, 0.75)
          bg = `rgba(239, 68, 68, ${a})`
          textColor = a > 0.3 ? '#fff' : '#e2e8f0'
        }
      }

      ctx.fillStyle = bg
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x + 3, labelH + 2, cellW - 6, cellH - 4, 6)
      } else {
        ctx.rect(x + 3, labelH + 2, cellW - 6, cellH - 4)
      }
      ctx.fill()

      ctx.fillStyle = textColor
      ctx.textAlign = 'center'
      ctx.font = '700 16px "JetBrains Mono", monospace'
      ctx.fillText(val != null ? val.toFixed(2) : '—', x + cellW / 2, labelH + cellH / 2 + 6)
    })
  }, [data, activePeriod, indicators, overallRow, hasOverall])

  if (!data || !data.periods?.length) {
    const msg = data?.message || 'Daily snapshots build correlation data after each market close.'
    return (
      <div className="chart-card heatmap-card">
        <h3>Overall Sentiment vs Market Correlation</h3>
        <p className="correlation-empty">{msg}</p>
      </div>
    )
  }

  const { periods, data_start, total_days } = data
  const days_available = period?.days_available || 0

  return (
    <div className="chart-card heatmap-card">
      <div className="heatmap-header">
        <div>
          <h3>Overall Sentiment vs Market Correlation</h3>
          <p className="heatmap-subtitle">
            {data_start && <>Since <strong>{data_start}</strong> &middot; </>}
            {total_days} day(s) of data
            {days_available > 0 && <> &middot; {days_available} in period</>}
          </p>
        </div>
      </div>

      <div className="heatmap-period-tabs">
        {periods.map((p) => (
          <button
            key={p.key}
            className={`corr-period-tab ${activePeriod === p.key ? 'active' : ''}`}
            onClick={() => setActivePeriod(p.key)}
          >
            {p.label}
            {p.days_available > 0 && <span className="corr-tab-days">{p.days_available}d</span>}
          </button>
        ))}
      </div>

      {hasOverall ? (
        <>
          <div className="heatmap-canvas-wrap">
            <canvas ref={canvasRef} className="heatmap-canvas" />
          </div>
          <div className="heatmap-legend">
            <span className="heatmap-leg-neg">-1.0 (inverse)</span>
            <div className="heatmap-gradient" />
            <span className="heatmap-leg-pos">+1.0 (correlated)</span>
          </div>
        </>
      ) : (
        <p className="correlation-empty corr-no-period-data">Not enough data for this period yet. Need 3+ daily snapshots.</p>
      )}
    </div>
  )
}


export default function App() {
  const [summary, setSummary] = useState(null)
  const [news, setNews] = useState([])
  const [newsPage, setNewsPage] = useState(1)
  const [newsTotal, setNewsTotal] = useState(0)
  const [newsHasMore, setNewsHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [history, setHistory] = useState([])
  const [fearGreed, setFearGreed] = useState(null)
  const [wallStreetFearGreed, setWallStreetFearGreed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [apiConnected, setApiConnected] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const markets = useMarkets()

  const fetchWithTimeout = (url, ms = 8000) => {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), ms)
    return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t))
  }

  const fetchData = async () => {
    const healthRes = await fetch(`${API}/health`)
    if (!healthRes.ok) throw new Error('Health check failed')
    setApiConnected(true)
    setError(null)

    const results = await Promise.allSettled([
      fetch(`${API}/news?page=1&per_page=30`, { cache: 'no-store' }),
      fetch(`${API}/sentiment-summary`),
      fetch(`${API}/sentiment-history`),
      fetchWithTimeout(`${API}/fear-greed`, 6000).catch(() => ({ ok: false })),
      fetchWithTimeout(`${API}/wall-street-fear-greed`, 6000).catch(() => ({ ok: false })),
    ])
    const [newsRes, sumRes, histRes, fgRes, wsFgRes] = results.map((r) => r.status === 'fulfilled' ? r.value : null)
    const newsData = newsRes?.ok ? await newsRes.json() : { news: [] }
    const sum = sumRes?.ok ? await sumRes.json() : {}
    const histData = histRes?.ok ? await histRes.json() : { history: [] }
    const fgData = fgRes?.ok ? await fgRes.json() : {}
    const wsFgData = wsFgRes?.ok ? await wsFgRes.json() : {}
    setNews(newsData.news || [])
    setNewsPage(1)
    setNewsTotal(newsData.total || 0)
    setNewsHasMore(newsData.has_more || false)
    setSummary(sum)
    setHistory(histData.history || [])
    setFearGreed(fgData)
    setWallStreetFearGreed(wsFgData)
    setLastUpdated(new Date())
  }

  const loadMoreNews = async () => {
    const nextPage = newsPage + 1
    setLoadingMore(true)
    try {
      const res = await fetch(`${API}/news?page=${nextPage}&per_page=30`)
      const data = await res.json()
      setNews((prev) => [...prev, ...(data.news || [])])
      setNewsPage(nextPage)
      setNewsTotal(data.total || 0)
      setNewsHasMore(data.has_more || false)
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false)
    }
  }

  const runPipeline = async () => {
    setLoading(true)
    setError(null)
    const isDeployed = !window.location.hostname.match(/^localhost|127\.0\.0\.1$/)
    const controller = new AbortController()
    const timeoutId = isDeployed ? setTimeout(() => controller.abort(), 100000) : null
    try {
      const res = await fetch(`${API}/pipeline/run`, { method: 'POST', signal: controller.signal })
      if (timeoutId) clearTimeout(timeoutId)
      const data = await res.json()
      if (data.error) {
        setError(data.error === 'no_news' ? 'No news fetched. RSS feeds may be temporarily unavailable.' : data.message || data.error)
      } else {
        setSummary(data)
        await fetchData()
      }
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId)
      if (e.name === 'AbortError') {
        setError(isDeployed ? 'Request timed out. The pipeline may still be running—wait a moment and Retry.' : 'Pipeline took too long. Try again.')
      } else {
        setError(isDeployed ? 'Service unavailable. If it just spun up, wait ~1 min and Retry. Otherwise check Render logs.' : 'Could not run pipeline. Is the Flask server running?')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const tryConnect = async (attempt = 0) => {
      if (cancelled) return
      const isDeployed = !window.location.hostname.match(/^localhost|127\.0\.0\.1$/)
      const maxAttempts = isDeployed ? 24 : 3
      try {
        await fetchData()
        if (cancelled) return
        return
      } catch (e) {
        if (cancelled) return
        setApiConnected(false)
        if (attempt < maxAttempts - 1) {
          setError(isDeployed
            ? `Starting up... retrying in a few seconds (${attempt + 1}/${maxAttempts})`
            : 'Could not reach API. Start the backend.')
          setTimeout(() => tryConnect(attempt + 1), 5000)
        } else {
          setError(isDeployed
            ? 'Service unavailable. Click Retry or check Render dashboard logs.'
            : 'Could not reach API. Start the backend: ./start.sh or run python api/app.py')
        }
      }
    }
    tryConnect()
    return () => { cancelled = true }
  }, [])

  // Auto-run pipeline only when feed is empty after fetchData completes (user can also click Fetch)
  const hasTriedPipeline = useRef(false)
  useEffect(() => {
    if (!apiConnected || loading || error || news.length > 0 || hasTriedPipeline.current) return
    const t = setTimeout(() => {
      hasTriedPipeline.current = true
      runPipeline()
    }, 3000)
    return () => clearTimeout(t)
  }, [apiConnected, news.length, loading, error])

  // Fear & Greed auto-refresh every 15 min (market charts already poll via useMarkets)
  useEffect(() => {
    const refreshFG = async () => {
      try {
        const [fgRes, wsFgRes] = await Promise.allSettled([
          fetchWithTimeout(`${API}/fear-greed`, 6000),
          fetchWithTimeout(`${API}/wall-street-fear-greed`, 6000),
        ])
        const fg = fgRes.status === 'fulfilled' && fgRes.value?.ok ? await fgRes.value.json() : null
        const wsFg = wsFgRes.status === 'fulfilled' && wsFgRes.value?.ok ? await wsFgRes.value.json() : null
        if (fg) setFearGreed(fg)
        if (wsFg) setWallStreetFearGreed(wsFg)
      } catch (_) {}
    }
    const id = setInterval(refreshFG, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // News auto-refresh: trigger pipeline + reload data every hour
  useEffect(() => {
    const refresh = async () => {
      try {
        await fetch(`${API}/pipeline/run`, { method: 'POST' })
      } catch (_) {}
      fetchData().catch(() => {})
    }
    const id = setInterval(refresh, 60 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Retry connection when disconnected
  useEffect(() => {
    if (!apiConnected && !loading) {
      const id = setInterval(() => fetchData().catch(() => {}), 5000)
      return () => clearInterval(id)
    }
  }, [apiConnected, loading])

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>News & Market Sentiment Analysis</h1>
          <p className="subtitle">Financial market sentiment from news</p>
        </div>
        <div className="header-right">
          <div className={`api-status ${apiConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot" />
            {apiConnected ? 'API connected' : 'API disconnected'}
          </div>
          <button
            className="run-btn"
            onClick={runPipeline}
            disabled={loading}
          >
            {loading ? 'Fetching & analyzing…' : 'Fetch Latest News'}
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          {error}
          <div className="error-actions">
            <button
              className="retry-btn"
              onClick={async () => {
                setError(null)
                try {
                  await fetchData()
                } catch {
                  setApiConnected(false)
                  setError('Still unavailable. Check Render logs or try again later.')
                }
              }}
            >
              Retry
            </button>
            {!window.location.hostname.match(/^localhost|127\.0\.0\.1$/) && (
              <a href={`${API.replace(/\/api$/, '')}/api/health`} target="_blank" rel="noopener noreferrer" className="test-api-link">
                Test API
              </a>
            )}
          </div>
        </div>
      )}

      <main className="main">
        <section className="summary-section">
          <SentimentGauge summary={summary} />
          {summary && !summary.error && (
            <div className="trend-card">
              <h3>Trend</h3>
              <TrendBadge trend={summary.trend} />
              <p className="article-count">{summary.article_count} articles analyzed</p>
            </div>
          )}
        </section>

        <SentimentYesterdayVsToday history={history} />

        <section className="correlation-section">
          <div className="fear-greed-row">
            <FearGreedCard fearGreed={fearGreed} title="Crypto Fear & Greed" source="Alternative.me · Crypto" />
            <FearGreedCard fearGreed={wallStreetFearGreed} title="Wall Street Fear & Greed" source="CNN Fear & Greed Index" />
          </div>
          <div className="fear-greed-btc-row">
            <BtcTrackerCard btcData={markets.btc_data} />
          </div>
          <p className="refresh-hint">Trackers refresh every 15 min · News every 1 hr</p>
          <div className="charts-row charts-row-3">
            <Sp500Chart data={markets.sp500_data} />
            <GoldChart data={markets.gold_data} />
            <VixChart data={markets.vix_data} />
          </div>
        </section>

        <section className="correlation-matrix-section">
          <OverallCorrelation apiBase={API} />
        </section>

        <section className="news-section">
          <h2>Latest News {newsTotal > 0 && <span className="news-count">({newsTotal} articles)</span>}</h2>
          <NewsList
            news={news}
            hasMore={newsHasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMoreNews}
            total={newsTotal}
          />
        </section>
      </main>

      <footer className="footer">
        {lastUpdated && (
          <p className="last-updated">Last Updated: {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
        )}
        <p className="developer-credit">
          Built by{' '}
          <a href="https://imshaon.com" target="_blank" rel="noopener noreferrer" className="developer-link">
            Shaon Biswas
          </a>
        </p>
      </footer>
    </div>
  )
}
