import { BookOpenText, Database, Github, KeyRound } from 'lucide-react'

export function SetupPage() {
  return (
    <div className="setup-page">
      <section className="setup-card">
        <span className="setup-card__icon"><BookOpenText size={30} /></span>
        <span className="eyebrow">One-time setup</span>
        <h1>Campaign Compendium is ready to connect.</h1>
        <p>
          The site was built successfully, but this deployment does not have its Supabase project
          details yet. Follow <strong>SETUP.md</strong> in the repository, then add these GitHub
          Actions secrets:
        </p>
        <div className="setup-steps">
          <div><Database size={19} /><span>Run the included database migration and spell seed.</span></div>
          <div><KeyRound size={19} /><span>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.</span></div>
          <div><Github size={19} /><span>Re-run the GitHub Pages deployment.</span></div>
        </div>
      </section>
    </div>
  )
}
