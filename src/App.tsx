import { useEffect, useRef, useState } from 'react'
import './App.css'

interface TextTrackInfo {
  id: string;
  kind: string;
  label: string;
  language: string;
  mode: string;
}

interface MediaInfo {
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string;
  container: string;
  fileSize: string;
}

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
  // Media information
  textTracks: TextTrackInfo[];
  mediaInfo: MediaInfo;
  codecSupport: { [key: string]: string };
  mediaCapabilitiesSupported: boolean;
  // Additional iOS-specific info
  playsinline: boolean;
  autoplay: boolean;
  crossOrigin: string | null;
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [src, setSrc] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo>({} as DiagnosticInfo);

  const betaEndpoint = 'https://43o11i55ok.execute-api.ap-southeast-2.amazonaws.com/beta';
  const sessionId = '0b68bd16-c620-43da-942f-9b244ee222d7';

  // Test codec support
  const testCodecSupport = (video: HTMLVideoElement | null): { [key: string]: string } => {
    if (!video) return {};

    const codecs = {
      'H.264 Baseline': 'video/mp4; codecs="avc1.42E01E"',
      'H.264 Main': 'video/mp4; codecs="avc1.4D401F"', 
      'H.264 High': 'video/mp4; codecs="avc1.64001F"',
      'HEVC/H.265': 'video/mp4; codecs="hvc1.1.6.L93.B0"',
      'VP8': 'video/webm; codecs="vp8"',
      'VP9': 'video/webm; codecs="vp9"',
      'AAC Audio': 'audio/mp4; codecs="mp4a.40.2"',
      'MP3 Audio': 'audio/mpeg',
      'Opus Audio': 'audio/webm; codecs="opus"',
      'WebM': 'video/webm',
      'MP4': 'video/mp4',
      'HLS': 'application/vnd.apple.mpegurl'
    };

    const support: { [key: string]: string } = {};
    Object.entries(codecs).forEach(([name, codec]) => {
      support[name] = video.canPlayType(codec) || 'no';
    });

    return support;
  };

  // Get text track information (these actually work on iOS)
  const getTextTrackInfo = (video: HTMLVideoElement | null): TextTrackInfo[] => {
    if (!video?.textTracks) return [];

    const textTracks: TextTrackInfo[] = [];
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      textTracks.push({
        id: track.id || `track-${i}`,
        kind: track.kind || 'subtitles',
        label: track.label || 'Unknown',
        language: track.language || 'unknown',
        mode: track.mode || 'disabled'
      });
    }
    return textTracks;
  };

  // Get media information from the video element
  const getMediaInfo = (video: HTMLVideoElement | null): MediaInfo => {
    if (!video) {
      return {
        hasVideo: false,
        hasAudio: false,
        videoCodec: 'Unknown',
        audioCodec: 'Unknown',
        container: 'Unknown',
        fileSize: 'Unknown'
      };
    }

    // Try to extract codec info from src URL or other means
    const src = video.currentSrc || video.src || '';
    const container = src.includes('.mp4') ? 'MP4' : 
                     src.includes('.webm') ? 'WebM' : 
                     src.includes('.m3u8') ? 'HLS' :
                     src.includes('.mov') ? 'QuickTime' : 'Unknown';

    return {
      hasVideo: video.videoWidth > 0 && video.videoHeight > 0,
      hasAudio: !video.muted && video.volume > 0, // Rough estimation
      videoCodec: container === 'MP4' ? 'Likely H.264' : container === 'WebM' ? 'Likely VP8/VP9' : 'Unknown',
      audioCodec: container === 'MP4' ? 'Likely AAC' : container === 'WebM' ? 'Likely Opus/Vorbis' : 'Unknown',
      container: container,
      fileSize: 'Not available via DOM'
    };
  };

  // Update diagnostics
  const updateDiagnostics = () => {
    const video = videoRef.current;
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    
    const textTracks = getTextTrackInfo(video);
    const mediaInfo = getMediaInfo(video);
    const codecSupport = testCodecSupport(video);
    const mediaCapabilitiesSupported = 'mediaCapabilities' in navigator;
    
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
      
      // Media Information
      textTracks,
      mediaInfo,
      codecSupport,
      mediaCapabilitiesSupported,
      
      // iOS-specific attributes
      playsinline: video?.hasAttribute('playsinline') || false,
      autoplay: video?.hasAttribute('autoplay') || false,
      crossOrigin: video?.getAttribute('crossorigin') || null,
      
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

      const videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

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
          <h3>Codec Support</h3>
          <div className="diagnostic-grid">
            {Object.entries(diagnostics.codecSupport || {}).map(([codec, support]) => (
              <div key={codec}>
                <strong>{codec}:</strong> 
                <span className={`codec-support codec-${support}`}>
                  {support === 'probably' ? '✅ Probably' : 
                   support === 'maybe' ? '⚠️ Maybe' : 
                   support === '' || support === 'no' ? '❌ No' : support}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>
            <strong>MediaCapabilities API:</strong> {diagnostics.mediaCapabilitiesSupported ? '✅ Supported' : '❌ Not Supported'}
          </div>
        </div>

        <div className="diagnostic-section">
          <h3>Media Information</h3>
          <div className="diagnostic-grid">
            <div><strong>Container:</strong> {diagnostics.mediaInfo?.container || 'Unknown'}</div>
            <div><strong>Video Codec:</strong> {diagnostics.mediaInfo?.videoCodec || 'Unknown'}</div>
            <div><strong>Audio Codec:</strong> {diagnostics.mediaInfo?.audioCodec || 'Unknown'}</div>
            <div><strong>Has Video:</strong> {diagnostics.mediaInfo?.hasVideo ? '✅ Yes' : '❌ No'}</div>
            <div><strong>Has Audio:</strong> {diagnostics.mediaInfo?.hasAudio ? '✅ Yes' : '❌ No'}</div>
            <div><strong>File Size:</strong> {diagnostics.mediaInfo?.fileSize || 'Unknown'}</div>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff3cd', borderRadius: '6px', fontSize: '0.85rem' }}>
            <strong>Note:</strong> iOS Safari doesn't expose direct video/audio track APIs for regular video files. 
            Track information is only available for Media Source Extensions (MSE) or HLS streams with multiple variants.
          </div>
        </div>

        <div className="diagnostic-section">
          <h3>Text Tracks (Subtitles/Captions)</h3>
          {diagnostics.textTracks && diagnostics.textTracks.length > 0 ? (
            <div className="track-list">
              {diagnostics.textTracks.map((track, index) => (
                <div key={track.id} className="track-item">
                  <strong>Track {index + 1}:</strong> {track.label} 
                  <br />
                  <small>
                    ID: {track.id}, Kind: {track.kind}, Language: {track.language}, 
                    Mode: {track.mode}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-tracks">No text tracks detected</div>
          )}
        </div>

        <div className="diagnostic-section">
          <h3>iOS-Specific Attributes</h3>
          <div className="diagnostic-grid">
            <div><strong>Plays Inline:</strong> {diagnostics.playsinline ? '✅ Yes' : '❌ No'}</div>
            <div><strong>Autoplay:</strong> {diagnostics.autoplay ? '✅ Yes' : '❌ No'}</div>
            <div><strong>Cross Origin:</strong> {diagnostics.crossOrigin || 'Not set'}</div>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#d1ecf1', borderRadius: '6px', fontSize: '0.85rem' }}>
            <strong>iOS Requirements:</strong> 
            • <code>playsinline</code> prevents fullscreen on iPhone
            • <code>crossorigin</code> needed for signed URLs
            • Autoplay requires muted videos
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
