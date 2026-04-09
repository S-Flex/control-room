export function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="chip" title={`${label}: ${value}`}>
      <span className="chip-label">{label}: </span>{value}
    </span>
  );
}
