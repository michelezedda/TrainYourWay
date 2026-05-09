import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const root = document.getElementById('root')!

if (!import.meta.env.VITE_INSTANTDB_APP_ID || !import.meta.env.VITE_GROQ_API_KEY) {
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center">
      <div style="max-width:420px">
        <div style="font-size:3rem;margin-bottom:12px">⚙️</div>
        <h1 style="color:white;font-size:1.2rem;font-weight:700;margin-bottom:8px">Missing environment variables</h1>
        <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;line-height:1.6;margin-bottom:16px">
          Add the following in your Vercel project under <strong style="color:white">Settings &rarr; Environment Variables</strong>, then trigger a new deployment:
        </p>
        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;text-align:left">
          <code style="color:#A855F7;font-size:0.8rem;display:block;margin-bottom:6px">VITE_GROQ_API_KEY</code>
          <code style="color:#A855F7;font-size:0.8rem;display:block">VITE_INSTANTDB_APP_ID</code>
        </div>
      </div>
    </div>`
} else {
  import('./App.tsx').then(({ default: App }) => {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
