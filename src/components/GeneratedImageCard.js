import { useState } from 'react';

export default function GeneratedImageCard({ payload }) {
  const [expanded, setExpanded] = useState(false);

  if (!payload?.dataUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = payload.dataUrl;
    a.download = 'generated-image.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const image = (
    <img
      src={payload.dataUrl}
      alt={payload.prompt || 'Generated image'}
      className="generated-image-thumb"
    />
  );

  return (
    <>
      <div className="generated-image-card" onClick={() => setExpanded(true)}>
        {image}
        {payload.prompt && <p className="generated-image-caption">{payload.prompt}</p>}
      </div>
      {expanded && (
        <div className="generated-image-overlay" onClick={() => setExpanded(false)}>
          <div
            className="generated-image-modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <img
              src={payload.dataUrl}
              alt={payload.prompt || 'Generated image'}
              className="generated-image-large"
            />
            <div className="generated-image-modal-footer">
              {payload.prompt && (
                <p className="generated-image-caption-large">{payload.prompt}</p>
              )}
              <button type="button" className="image-download-btn" onClick={handleDownload}>
                Download image
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

