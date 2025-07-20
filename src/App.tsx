import { useEffect, useRef, useState } from 'react'
import './App.css'

interface DiagnosticInfo {
  userAgent: string;
  isIOS: boolean;
  isSafari: boolean;
  deviceMemory: number | string;
  connection: string;
  videoReady: number;
  videoNetworkState: number;
  videoDuration: number;
  videoCurrentTime: number;
  videoBuffered: number;
  videoPaused: boolean;
  videoMuted: boolean;
  videoVolume: number;
  videoWidth: number;
  videoHeight: number;
  currentSrc: string;
  srcState: string;
  lastUpdate: string;
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo>({} as DiagnosticInfo);

  const betaEndpoint = 'https://43o11i55ok.execute-api.ap-southeast-2.amazonaws.com/beta';
  const sessionId = '0b68bd16-c620-43da-942f-9b244ee222d7';

  // Update diagnostics
  const updateDiagnostics = () => {
    const video = videoRef.current;
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    setDiagnostics({
      // Device/Browser Info
      userAgent,
      isIOS,
      isSafari,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 'unknown',
      connection: (navigator as Navigator & { connection?: { effectiveType: string } }).connection?.effectiveType || 'unknown',
      
      // Video Element State
      videoReady: video?.readyState || 0,
      videoNetworkState: video?.networkState || 0,
      videoDuration: video?.duration || 0,
      videoCurrentTime: video?.currentTime || 0,
      videoBuffered: video?.buffered?.length || 0,
      videoPaused: video?.paused || false,
      videoMuted: video?.muted || false,
      videoVolume: video?.volume || 0,
      videoWidth: video?.videoWidth || 0,
      videoHeight: video?.videoHeight || 0,
      
      // URLs
      currentSrc: video?.currentSrc || '',
      srcState: src,
      
      // Timestamps
      lastUpdate: new Date().toISOString()
    });
  };

  async function loadPublicVideo() {
    try {
      setLoading(true);
      setError(null);

      // Step 1: Fetch temp token
      const tokenRes = await fetch(`${betaEndpoint}/get-temp-token`);
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to get token');

      const tempToken = tokenData.token;

      // Step 2: Fetch signed video URL
      const videoRes = await fetch(`${betaEndpoint}/video/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tempToken}`,
        },
      });

      const videoData = await videoRes.json();
      if (!videoRes.ok) throw new Error(videoData.error || 'Failed to get video URL');

      const videoUrl = videoData.videoUrl;

      // Step 3: Set video src via state
      setSrc(videoUrl);
      if (videoRef.current) {
        videoRef.current.setAttribute('crossorigin', 'anonymous');
        videoRef.current.load();
      }

      console.log('Loaded video URL:', videoUrl);
      setLoading(false);
      
      // Update diagnostics after loading
      setTimeout(updateDiagnostics, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Error:', errorMessage);
      setError(errorMessage);
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPublicVideo();
  }, []);

  // Add video event listeners for diagnostics
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const events = [
      'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
      'error', 'stalled', 'waiting', 'playing', 'pause', 'ended'
    ];

    const handleVideoEvent = (e: Event) => {
      console.log(`Video event: ${e.type}`, e);
      updateDiagnostics();
    };

    events.forEach(event => {
      video.addEventListener(event, handleVideoEvent);
    });

    // Initial diagnostics update
    updateDiagnostics();

    return () => {
      events.forEach(event => {
        video.removeEventListener(event, handleVideoEvent);
      });
    };
  }, [src]);

  return (
    <div className="video-container">
      <h1>Video Player</h1>
      
      {loading && (
        <div className="loading">
          <p>Loading video...</p>
        </div>
      )}
      
      {error && (
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={loadPublicVideo}>Retry</button>
        </div>
      )}
      
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        crossOrigin="anonymous"
        style={{
          width: '100%',
          maxWidth: '800px',
          height: 'auto',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
      >
        Your browser does not support the video tag.
      </video>

      {/* Diagnostic Information */}
      <div className="diagnostics">
        <h2>Diagnostic Information</h2>
        <button onClick={updateDiagnostics} className="refresh-btn">
          Refresh Diagnostics
        </button>
        
        <div className="diagnostic-section">
          <h3>Device & Browser</h3>
          <div className="diagnostic-grid">
            <div><strong>iOS Device:</strong> {diagnostics.isIOS ? 'Yes' : 'No'}</div>
            <div><strong>Safari Browser:</strong> {diagnostics.isSafari ? 'Yes' : 'No'}</div>
            <div><strong>Device Memory:</strong> {diagnostics.deviceMemory}</div>
            <div><strong>Connection:</strong> {diagnostics.connection}</div>
          </div>
        </div>

        <div className="diagnostic-section">
          <h3>Video State</h3>
          <div className="diagnostic-grid">
            <div><strong>Ready State:</strong> {diagnostics.videoReady} {diagnostics.videoReady === 4 ? '(HAVE_ENOUGH_DATA)' : diagnostics.videoReady === 3 ? '(HAVE_FUTURE_DATA)' : diagnostics.videoReady === 2 ? '(HAVE_CURRENT_DATA)' : diagnostics.videoReady === 1 ? '(HAVE_METADATA)' : '(HAVE_NOTHING)'}</div>
            <div><strong>Network State:</strong> {diagnostics.videoNetworkState} {diagnostics.videoNetworkState === 3 ? '(NO_SOURCE)' : diagnostics.videoNetworkState === 2 ? '(LOADING)' : diagnostics.videoNetworkState === 1 ? '(IDLE)' : '(EMPTY)'}</div>
            <div><strong>Duration:</strong> {diagnostics.videoDuration}</div>
            <div><strong>Current Time:</strong> {diagnostics.videoCurrentTime}</div>
            <div><strong>Buffered Ranges:</strong> {diagnostics.videoBuffered}</div>
            <div><strong>Paused:</strong> {diagnostics.videoPaused ? 'Yes' : 'No'}</div>
            <div><strong>Muted:</strong> {diagnostics.videoMuted ? 'Yes' : 'No'}</div>
            <div><strong>Volume:</strong> {diagnostics.videoVolume}</div>
          </div>
        </div>

        <div className="diagnostic-section">
          <h3>Video Properties</h3>
          <div className="diagnostic-grid">
            <div><strong>Video Width:</strong> {diagnostics.videoWidth}px</div>
            <div><strong>Video Height:</strong> {diagnostics.videoHeight}px</div>
            <div><strong>Has Source:</strong> {src ? 'Yes' : 'No'}</div>
            <div><strong>Source Length:</strong> {src.length} chars</div>
          </div>
        </div>

        <div className="diagnostic-section">
          <h3>URLs & Sources</h3>
          <div className="url-info">
            <div><strong>State Src:</strong></div>
            <div className="url-text">{src || 'Not set'}</div>
            <div><strong>Current Src:</strong></div>
            <div className="url-text">{diagnostics.currentSrc || 'Not set'}</div>
          </div>
        </div>

        <div className="diagnostic-section">
          <h3>User Agent</h3>
          <div className="url-text">{diagnostics.userAgent}</div>
        </div>

        <div className="diagnostic-section">
          <small><strong>Last Updated:</strong> {diagnostics.lastUpdate}</small>
        </div>
      </div>
    </div>
  )
}

export default App
