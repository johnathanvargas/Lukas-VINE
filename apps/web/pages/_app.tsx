import type { AppProps } from 'next/app';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🌿 Lukas-VINE</h1>
        <nav>
          <a href="/">Today</a>
          <a href="/projects">Projects</a>
          <a href="/requests">Requests</a>
          <a href="/diagnostics">Diagnostics</a>
        </nav>
      </header>
      <main className="app-main">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
