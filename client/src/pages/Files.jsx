import FileShare from '../components/FileShare'

// The Files space — its own world, separate from watching and messaging.
// Transfer state lives in TransfersContext (app-level), so a transfer keeps
// running and stays in the sidebar even if you navigate away from here.
export default function Files() {
  return (
    <div className="max-w-[760px] mx-auto px-5 sm:px-8 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Send a <span className="text-gradient">file</span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Files stream directly browser-to-browser — nothing is stored on a server, and interrupted transfers pick up where they left off.
        </p>
      </header>
      <FileShare />
    </div>
  )
}
