import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// ★ Error boundary wrapper
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', whiteSpace: 'pre-wrap', background: '#fff', minHeight: '100vh' }}>
          <h2 style={{ color: '#e74c3c' }}>❌ Render Error</h2>
          <div style={{ background: '#fdf0ef', padding: 16, borderRadius: 8, border: '1px solid #e74c3c', marginBottom: 16 }}>
            <strong>{this.state.error.name}:</strong> {this.state.error.message}
          </div>
          <pre style={{ fontSize: 12, color: '#555', maxHeight: '80vh', overflow: 'auto' }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
