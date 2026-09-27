import { Component, type ErrorInfo, type ReactNode } from 'react';
import { LifeBuoy, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RescueShip ErrorBoundary] Uncaught render exception:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReturnHome = () => {
    window.location.href = '/dashboard';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails } = this.state;

      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'var(--bg-void, #050508)',
            color: 'var(--text-1, #f3f4f6)',
            fontFamily: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: 'var(--bg-card, #0d0e15)',
              border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
              borderRadius: '16px',
              padding: '36px 32px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Maritime signal stripe */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, var(--rose, #f43f5e) 0%, var(--amber, #f59e0b) 50%, var(--indigo, #6366f1) 100%)',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(244, 63, 94, 0.12)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--rose, #f43f5e)',
                  flexShrink: 0,
                }}
              >
                <LifeBuoy size={26} />
              </div>
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: 'var(--rose, #f43f5e)',
                    display: 'block',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  Distress Signal · Navigation Error
                </span>
                <h2
                  style={{
                    fontSize: '1.45rem',
                    fontWeight: 700,
                    margin: '4px 0 0',
                    color: 'var(--text-1, #f3f4f6)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Vessel Encountered Rough Seas
                </h2>
              </div>
            </div>

            <p
              style={{
                color: 'var(--text-2, #9ca3af)',
                fontSize: '0.92rem',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              RescueShip encountered an unexpected runtime exception while rendering this sector.
              Automated telemetry has captured the telemetry event. You may re-anchor this view or navigate back to the command deck.
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--indigo, #6366f1)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
              >
                <RefreshCw size={15} />
                Re-anchor Vessel (Reload)
              </button>
              <button
                onClick={this.handleReturnHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-2, #9ca3af)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  border: '1px solid var(--border, rgba(255, 255, 255, 0.12))',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
              >
                <Home size={15} />
                Command Deck
              </button>
            </div>

            {/* Diagnostic Details Accordion */}
            {error && (
              <div
                style={{
                  marginTop: '16px',
                  borderTop: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
                  paddingTop: '16px',
                }}
              >
                <button
                  onClick={this.toggleDetails}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-3, #6b7280)',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    padding: '4px 0',
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  <span>DIAGNOSTIC TELEMETRY LOG</span>
                  {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showDetails && (
                  <pre
                    style={{
                      marginTop: '10px',
                      padding: '12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: '8px',
                      fontSize: '0.74rem',
                      color: 'var(--rose, #f43f5e)',
                      overflowX: 'auto',
                      maxHeight: '180px',
                      lineHeight: 1.5,
                      fontFamily: 'var(--font-mono, monospace)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {error.name}: {error.message}
                    {errorInfo?.componentStack && `\n${errorInfo.componentStack}`}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
