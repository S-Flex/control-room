export function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="chip">
      {label}: {value}
    </span>
  );
}
