// Tools for working with YouTube channel JSON in the chat.
// Channel JSON shape (per downloader and assignment):
// {
//   channel_title: string,
//   channel_url: string,
//   downloaded_at: string,
//   videos: [
//     {
//       video_id: string,
//       title: string,
//       description: string,
//       transcript?: string | null,
//       duration_seconds: number,
//       published_at: string | null,
//       view_count: number | null,
//       like_count: number | null,
//       comment_count: number | null,
//       video_url: string,
//       thumbnail_url?: string
//     }
//   ]
// }

export const YOUTUBE_TOOL_DECLARATIONS = [
  {
    name: 'generateImage',
    description:
      'Generate a thumbnail-style image for the user based on a text prompt and (optionally) an anchor image they dragged into the chat. ' +
      'Use this to create YouTube thumbnail drafts, concept art, or channel imagery grounded in their existing style.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description:
            'Short description of the image to generate, e.g. "bright, high-contrast thumbnail showing a jet engine melting".',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description:
      'Plot any numeric field (views, likes, comments, duration, etc.) versus time for the channel videos currently loaded from JSON. ' +
      'Use this when the user asks for trends, growth over time, or how a metric evolves across uploads.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metric: {
          type: 'STRING',
          description:
            'Name of the numeric field from the channel JSON videos to plot on the y-axis. Examples: "view_count", "like_count", "comment_count", "duration_seconds".',
        },
      },
      required: ['metric'],
    },
  },
  {
    name: 'play_video',
    description:
      'Select a single YouTube video from the loaded channel JSON so the UI can show a clickable card with title and thumbnail that opens the video in a new tab. ' +
      'Use this when the user asks to play or open a video by title, by ordinal (first, second, etc.), or by most viewed.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description:
            'Optional. Exact or partial title of the video to play, e.g. "asbestos" or "Why don\'t jet engines melt?". ' +
            'Use this when the user specifies the video by name.',
        },
        ordinal: {
          type: 'NUMBER',
          description:
            'Optional. 1-based index into the current channel video list (1 = first, 2 = second, etc.). Use this when the user says things like "play the first video".',
        },
        most_viewed: {
          type: 'BOOLEAN',
          description:
            'Optional. If true, ignore title and ordinal and select the most viewed video in the loaded channel JSON. ' +
            'Use this when the user says "play the most viewed video".',
        },
      },
    },
  },
  {
    name: 'compute_stats_json',
    description:
      'Compute mean, median, standard deviation, min, and max for any numeric field in the loaded YouTube channel JSON (e.g. view_count, like_count, comment_count, duration_seconds). ' +
      'Use this when the user asks for averages, distributions, or summary statistics over a metric for the channel videos.',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: {
          type: 'STRING',
          description:
            'Name of the numeric field in each video object to summarize, such as "view_count", "like_count", "comment_count", or "duration_seconds".',
        },
      },
      required: ['field'],
    },
  },
];

const numericFromVideos = (videos, field) =>
  videos
    .map((v) => (v && v[field] !== undefined && v[field] !== null ? Number(v[field]) : NaN))
    .filter((v) => !Number.isNaN(v));

const median = (sorted) =>
  sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

const fmt = (n) => (Number.isFinite(n) ? +n.toFixed(4) : null);

export const buildChannelSummary = (channelJson) => {
  if (!channelJson || !Array.isArray(channelJson.videos) || !channelJson.videos.length) return '';
  const { channel_title: title, videos } = channelJson;
  const sample = videos[0] || {};
  const numericFields = Object.keys(sample).filter((k) =>
    typeof sample[k] === 'number' || k.endsWith('_count') || k === 'duration_seconds'
  );

  const lines = [
    `**YouTube channel dataset**`,
    `Channel: ${title || 'Unknown'} · ${videos.length} videos`,
  ];

  if (numericFields.length) {
    lines.push('\n**Numeric fields available in JSON (use these exact names):**');
    numericFields.forEach((field) => {
      const vals = numericFromVideos(videos, field);
      if (!vals.length) return;
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      lines.push(`  • \`${field}\`: approx mean=${fmt(mean)} (n=${vals.length})`);
    });
  }

  return lines.join('\n');
};

// Execute a YouTube JSON tool call on the client.
// anchorImage: optional { data, mimeType, name } from the image the user dragged in.
// Returns a Promise for tools that need async work (e.g. generateImage with anchor).
export const executeYoutubeTool = async (toolName, args, channelJson, anchorImage) => {
  const videos = channelJson?.videos || [];
  switch (toolName) {
    case 'compute_stats_json': {
      const field = args.field;
      const vals = numericFromVideos(videos, field);
      if (!vals.length) {
        return {
          error: `No numeric values found for field "${field}". Make sure it exists on each video in the JSON.`,
        };
      }
      const sorted = [...vals].sort((a, b) => a - b);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
      return {
        field,
        count: vals.length,
        mean: fmt(mean),
        median: fmt(median(sorted)),
        std: fmt(Math.sqrt(variance)),
        min: Math.min(...vals),
        max: Math.max(...vals),
      };
    }

    case 'plot_metric_vs_time': {
      const field = args.metric;
      const pts = videos
        .map((v) => {
          if (!v) return null;
          const value = v[field];
          if (value === undefined || value === null) return null;
          const t = v.published_at || null;
          const date = t ? new Date(t) : null;
          const label = date ? date.toISOString().slice(0, 10) : 'unknown';
          return {
            dateLabel: label,
            value: Number(value),
            title: v.title || '',
          };
        })
        .filter((p) => p && Number.isFinite(p.value))
        .sort((a, b) => (a.dateLabel > b.dateLabel ? 1 : a.dateLabel < b.dateLabel ? -1 : 0));

      if (!pts.length) {
        return {
          error: `Could not build a time series for "${field}". Check that this field exists and is numeric across videos.`,
        };
      }

      return {
        _chartType: 'metric_vs_time',
        metricField: field,
        data: pts,
      };
    }

    case 'play_video': {
      if (!videos.length) {
        return { error: 'No videos loaded in the current channel JSON.' };
      }
      const { title, ordinal, most_viewed } = args;
      let video = null;
      let reason = '';

      if (most_viewed) {
        video = [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
        reason = 'most viewed video';
      } else if (typeof ordinal === 'number' && ordinal >= 1) {
        const idx = Math.min(Math.floor(ordinal) - 1, videos.length - 1);
        video = videos[idx];
        reason = `video #${ordinal} in the loaded list`;
      } else if (title) {
        const lower = String(title).toLowerCase();
        video =
          videos.find((v) => String(v.title || '').toLowerCase() === lower) ||
          videos.find((v) => String(v.title || '').toLowerCase().includes(lower));
        reason = `title match for "${title}"`;
      }

      if (!video) {
        return { error: 'Could not find a matching video to play in the loaded JSON.' };
      }

      return {
        _chartType: 'video_card',
        title: video.title,
        thumbnailUrl: video.thumbnail_url || null,
        videoUrl: video.video_url,
        reason,
      };
    }

    case 'generateImage': {
      const prompt = args.prompt || '';
      try {
        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size;
        canvas.height = size * 9 / 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas unsupported');

        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#1d4ed8');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (anchorImage?.data && anchorImage?.mimeType) {
          await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              const w = canvas.width * 0.4;
              const h = (img.height / img.width) * w;
              const x = canvas.width - w - 20;
              const y = canvas.height - h - 20;
              ctx.drawImage(img, x, y, w, h);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = `data:${anchorImage.mimeType};base64,${anchorImage.data}`;
          });
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
        const textLines = wrapText(ctx, prompt || 'Generated thumbnail', canvas.width - 40);
        textLines.forEach((line, i) => {
          ctx.fillText(line, 20, 40 + i * 34);
        });

        const dataUrl = canvas.toDataURL('image/png');
        return {
          _chartType: 'generated_image',
          prompt,
          hasAnchor: !!anchorImage,
          dataUrl,
        };
      } catch (err) {
        return { error: `Image generation failed: ${err.message}` };
      }
    }

    default:
      return { error: `Unknown YouTube tool: ${toolName}` };
  }
};

const wrapText = (ctx, text, maxWidth) => {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = ctx.measureText(test).width;
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
};

