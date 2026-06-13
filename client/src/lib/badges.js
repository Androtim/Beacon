// "Constellation" badges — derived purely from a user's stats, so they light up
// automatically as activity accrues. Order is roughly by how hard each is.
const CATALOG = [
  { id: 'first-light',    label: 'First Light',      hint: 'Sent your first message',     test: (s) => s.messagesSent >= 1 },
  { id: 'conversational', label: 'Conversationalist', hint: '50 messages sent',            test: (s) => s.messagesSent >= 50 },
  { id: 'chatterbox',     label: 'Chatterbox',        hint: '250 messages sent',           test: (s) => s.messagesSent >= 250 },
  { id: 'host',           label: 'Host',              hint: 'Started a watch party',       test: (s) => s.partiesStarted >= 1 },
  { id: 'impresario',     label: 'Impresario',        hint: 'Started 10 watch parties',    test: (s) => s.partiesStarted >= 10 },
  { id: 'settling-in',    label: 'Settling In',       hint: '30 minutes watched together', test: (s) => s.watchSeconds >= 1800 },
  { id: 'marathoner',     label: 'Marathoner',        hint: '5 hours watched together',    test: (s) => s.watchSeconds >= 18000 },
]

export function earnedBadges(stats) {
  const s = { messagesSent: 0, partiesStarted: 0, watchSeconds: 0, ...stats }
  return CATALOG.map((b) => ({ ...b, earned: b.test(s) }))
}

export function formatWatchTime(seconds) {
  if (!seconds) return '0m'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${seconds}s`
}
