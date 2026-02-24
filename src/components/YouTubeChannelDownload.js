import { useState } from 'react';
import './YouTubeChannelDownload.css';

export default function YouTubeChannelDownload() {
  const [channelUrl, setChannelUrl] = useState('');
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [downloadData, setDownloadData] = useState(null);

  const handleDownload = async (e) => {
    e.preventDefault();
    setError('');
    setDownloadData(null);
    const trimmed = channelUrl.trim();
    if (!trimmed) {
      setError('Please enter a YouTube channel URL.');
      return;
    }
    const max = Math.min(Math.max(Number(maxVideos) || 10, 1), 100);
    setLoading(true);
    setProgress(10);
    try {
      const res = await fetch('/api/youtube/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: trimmed, maxVideos: max }),
      });
      setProgress(60);
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || res.statusText);
      }
      const data = text ? JSON.parse(text) : null;
      setDownloadData(data);
      setProgress(100);
    } catch (err) {
      setError(err.message || 'Failed to download channel data.');
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJson = () => {
    if (!downloadData) return;
    const blob = new Blob([JSON.stringify(downloadData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const title = downloadData.channel_title || 'channel';
    a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_videos.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="yt-download">
      <h2 className="yt-download-title">YouTube Channel Download</h2>
      <p className="yt-download-subtitle">
        Enter a YouTube channel URL (for example, https://www.youtube.com/@veritasium) and
        download a JSON file with video metadata for analysis in chat.
      </p>
      <form className="yt-download-form" onSubmit={handleDownload}>
        <label className="yt-field">
          <span>Channel URL</span>
          <input
            type="url"
            placeholder="https://www.youtube.com/@veritasium"
            value={channelUrl}
            onChange={(e) => setChannelUrl(e.target.value)}
            required
          />
        </label>
        <label className="yt-field-inline">
          <span>Max videos (1–100)</span>
          <input
            type="number"
            min={1}
            max={100}
            value={maxVideos}
            onChange={(e) => setMaxVideos(e.target.value)}
          />
        </label>
        <button type="submit" disabled={loading} className="yt-download-btn">
          {loading ? 'Downloading…' : 'Download Channel Data'}
        </button>
      </form>
      {loading && (
        <div className="yt-progress">
          <div className="yt-progress-bar">
            <div className="yt-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="yt-progress-label">Fetching channel videos…</span>
        </div>
      )}
      {error && <p className="yt-error">{error}</p>}
      {downloadData && (
        <div className="yt-result">
          <p>
            Downloaded{' '}
            <strong>{Array.isArray(downloadData.videos) ? downloadData.videos.length : 0}</strong>{' '}
            videos from <strong>{downloadData.channel_title || 'channel'}</strong>.
          </p>
          <button type="button" onClick={handleSaveJson} className="yt-save-json-btn">
            Save JSON file
          </button>
        </div>
      )}
      <div className="yt-note">
        Tip: Once you have the JSON file, drag it into the chat window to load it into the AI’s
        context for analysis.
      </div>
    </div>
  );
}

