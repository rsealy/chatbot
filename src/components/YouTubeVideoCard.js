export default function YouTubeVideoCard({ payload }) {
  if (!payload?.videoUrl) return null;
  const handleClick = () => {
    window.open(payload.videoUrl, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="youtube-video-card" onClick={handleClick}>
      {payload.thumbnailUrl && (
        <img
          src={payload.thumbnailUrl}
          alt={payload.title || 'YouTube video'}
          className="youtube-video-thumb"
        />
      )}
      <div className="youtube-video-info">
        <h4 className="youtube-video-title">{payload.title}</h4>
        {payload.reason && <p className="youtube-video-reason">{payload.reason}</p>}
      </div>
    </div>
  );
}

