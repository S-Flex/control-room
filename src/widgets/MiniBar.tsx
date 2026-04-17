export type MiniBarSegment = {
  value: number;
  color: string;
};

export function MiniBar({ segments, height = 6 }: {
  segments: MiniBarSegment[];
  height?: number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="minibar" style={{ height }}>
      {segments.map((s, i) => (
        <div
          key={i}
          className="minibar-segment"
          style={{ flex: s.value, backgroundColor: s.color }}
        />
      ))}
    </div>
  );
}
