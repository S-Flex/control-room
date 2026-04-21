type ToggleProps = {
  isSelected?: boolean;
  onChange?: (isSelected: boolean) => void;
  label?: string;
  isDisabled?: boolean;
};

export function Toggle({ isSelected = false, onChange, label, isDisabled }: ToggleProps) {
  return (
    <label className="planning-toggle">
      <input
        type="checkbox"
        checked={isSelected}
        disabled={isDisabled}
        onChange={e => onChange?.(e.target.checked)}
      />
      <span className="planning-toggle-slider" />
      {label && <span className="planning-toggle-label">{label}</span>}
    </label>
  );
}
