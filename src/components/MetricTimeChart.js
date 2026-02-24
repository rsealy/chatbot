import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useRef, useState } from 'react';

function MetricTimeChartInner({ data, metricField }) {
  if (!data?.length) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(15,23,42,0.95)',
            borderRadius: 10,
            border: '1px solid rgba(148,163,184,0.4)',
            fontSize: 12,
          }}
          labelStyle={{ color: '#e5e7eb', fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={metricField}
          stroke="#38bdf8"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function MetricTimeChart({ payload }) {
  const [expanded, setExpanded] = useState(false);
  const chartRef = useRef(null);

  const handleDownload = () => {
    const svg = chartRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metric_vs_time_${payload.metricField || 'metric'}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="metric-time-chart-inner" ref={chartRef}>
      <p className="metric-chart-label">
        {payload.metricField} vs time ({payload.data.length} videos)
      </p>
      <MetricTimeChartInner data={payload.data} metricField={payload.metricField} />
    </div>
  );

  return (
    <>
      <div className="metric-time-chart" onClick={() => setExpanded(true)}>
        {content}
      </div>
      {expanded && (
        <div className="metric-time-chart-overlay" onClick={() => setExpanded(false)}>
          <div
            className="metric-time-chart-modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {content}
            <button className="chart-download-btn" type="button" onClick={handleDownload}>
              Download SVG
            </button>
          </div>
        </div>
      )}
    </>
  );
}

