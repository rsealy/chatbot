require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;
const MEMORY_MODE = !URI;

function createMemoryDb() {
  const users = [];
  const sessions = [];

  const matches = (doc, query) => {
    if (!query) return true;
    return Object.entries(query).every(([k, v]) => doc?.[k] === v);
  };

  const collection = (name) => {
    const arr = name === 'users' ? users : name === 'sessions' ? sessions : null;
    if (!arr) throw new Error(`Unknown collection: ${name}`);

    return {
      async countDocuments(query = {}) {
        return arr.filter((d) => matches(d, query)).length;
      },

      async findOne(query = {}) {
        return arr.find((d) => matches(d, query)) || null;
      },

      async insertOne(doc) {
        const _id = crypto.randomUUID();
        const newDoc = { _id, ...doc };
        arr.push(newDoc);
        return { insertedId: _id };
      },

      find(query = {}) {
        const results = arr.filter((d) => matches(d, query));
        let sortSpec = null;
        return {
          sort(spec) {
            sortSpec = spec;
            return this;
          },
          async toArray() {
            if (sortSpec) {
              const [[field, dir]] = Object.entries(sortSpec);
              results.sort((a, b) => {
                const av = a?.[field];
                const bv = b?.[field];
                if (av === bv) return 0;
                return dir < 0 ? (av > bv ? -1 : 1) : av > bv ? 1 : -1;
              });
            }
            return results;
          },
        };
      },

      async deleteOne(query = {}) {
        const idx = arr.findIndex((d) => matches(d, query));
        if (idx >= 0) arr.splice(idx, 1);
        return { ok: true };
      },

      async updateOne(query = {}, update = {}) {
        const doc = arr.find((d) => matches(d, query));
        if (!doc) return { matchedCount: 0, modifiedCount: 0 };

        if (update.$set) {
          Object.assign(doc, update.$set);
        }
        if (update.$push) {
          for (const [k, v] of Object.entries(update.$push)) {
            if (!Array.isArray(doc[k])) doc[k] = [];
            doc[k].push(v);
          }
        }
        return { matchedCount: 1, modifiedCount: 1 };
      },
    };
  };

  return { collection };
}

const toId = (id) => (MEMORY_MODE ? String(id) : new ObjectId(id));

async function connect() {
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log('MongoDB connected');
}

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:2rem;background:#00356b;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
        <div style="text-align:center">
          <h1>Chat API Server</h1>
          <p>Backend is running. Use the React app at <a href="http://localhost:3000" style="color:#ffd700">localhost:3000</a></p>
          <p><a href="/api/status" style="color:#ffd700">Check DB status</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount, memoryMode: MEMORY_MODE });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = String(username).trim().toLowerCase();
    const existing = await db.collection('users').findOne({ username: name });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username: name,
      password: hashed,
      email: email ? String(email).trim().toLowerCase() : null,
      firstName: firstName ? String(firstName).trim() : null,
      lastName: lastName ? String(lastName).trim() : null,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    res.json({
      ok: true,
      username: name,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      email: user.email || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: toId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: toId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
    };
    await db.collection('sessions').updateOne(
      { _id: toId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: toId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube Channel Download (yt-dlp, no API key needed) ─────────────────────

const { spawn } = require('child_process');

async function fetchTranscriptFromCaptions(videoData) {
  const captions =
    videoData.subtitles?.en ||
    videoData.automatic_captions?.en ||
    videoData.subtitles?.['en-orig'] ||
    [];
  const json3 = captions.find((c) => c.ext === 'json3');
  if (!json3?.url) return null;
  try {
    const resp = await fetch(json3.url);
    if (!resp.ok) return null;
    const sub = await resp.json();
    const text = (sub.events || [])
      .filter((e) => e.segs)
      .map((e) => e.segs.map((s) => s.utf8 || '').join(''))
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

app.post('/api/youtube/channel', (req, res) => {
  const { channelUrl, maxVideos = 10 } = req.body || {};
  if (!channelUrl) {
    return res.status(400).json({ error: 'channelUrl is required' });
  }

  const max = Math.min(Math.max(parseInt(maxVideos, 10) || 10, 1), 100);

  let url = channelUrl.trim().replace(/\/$/, '');
  if (!url.includes('/videos') && !url.includes('/channel/')) {
    url += '/videos';
  }

  const args = [
    '--dump-json',
    '--playlist-end', String(max),
    '--no-warnings',
    '--ignore-errors',
    '--skip-download',
    url,
  ];

  const proc = spawn('yt-dlp', args, { timeout: 600000 });
  let output = '';
  let stderr = '';

  proc.stdout.on('data', (data) => { output += data.toString(); });
  proc.stderr.on('data', (data) => { stderr += data.toString(); });

  proc.on('close', async (code) => {
    if (code !== 0 && !output.trim()) {
      return res.status(500).json({ error: `yt-dlp failed (code ${code}): ${stderr.slice(0, 500)}` });
    }

    const lines = output.trim().split('\n').filter(Boolean);
    const videos = [];
    let channelTitle = '';

    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        if (!channelTitle) {
          channelTitle = d.channel || d.uploader || '';
        }

        const uploadDate = d.upload_date;
        const publishedAt = uploadDate
          ? `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`
          : null;

        const thumbs = d.thumbnails || [];
        const thumbnail =
          d.thumbnail ||
          (thumbs.length ? thumbs[thumbs.length - 1].url : null);

        let transcript = null;
        try {
          transcript = await fetchTranscriptFromCaptions(d);
        } catch {
          // transcript not available
        }

        videos.push({
          video_id: d.id,
          title: d.title || '',
          description: d.description || '',
          transcript,
          duration_seconds: d.duration || null,
          published_at: publishedAt,
          view_count: d.view_count ?? null,
          like_count: d.like_count ?? null,
          comment_count: d.comment_count ?? null,
          video_url: d.webpage_url || `https://www.youtube.com/watch?v=${d.id}`,
          thumbnail_url: thumbnail,
        });
      } catch {
        // skip malformed line
      }
    }

    res.json({
      channel_title: channelTitle,
      channel_url: channelUrl,
      downloaded_at: new Date().toISOString(),
      videos,
    });
  });

  proc.on('error', (err) => {
    res.status(500).json({ error: `Failed to run yt-dlp: ${err.message}` });
  });

  setTimeout(() => {
    try { proc.kill(); } catch {}
  }, 600000);
});
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

if (MEMORY_MODE) {
  db = createMemoryDb();
  console.warn(
    '[server] No MongoDB URI provided. Running in MEMORY_MODE (data will not persist). ' +
      'Set REACT_APP_MONGODB_URI or MONGODB_URI in server env to enable persistence.'
  );
  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
} else {
  connect()
    .then(() => {
      app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    });
}
