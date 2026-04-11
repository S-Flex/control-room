import type { JSONValue } from '@s-flex/xfw-data';
import type { ResolvedField } from '@s-flex/xfw-ui';
import { resolveI18nLabel, formatValue } from '../widgets/flow/utils';
import { IconMap } from './IconMap';
import { Chip } from './Chip';
import { Badge } from './Badge';

type FieldProps = {
  field: ResolvedField & { aggregate?: string };
  value: JSONValue;
  showLabel?: boolean;
};

export function Field({ field, value, showLabel }: FieldProps) {
  const { control, input_data, aggregate } = field;
  const label = resolveI18nLabel(field.i18n, field.key);

  if (control === 'icon-map' && input_data) {
    return <IconMap value={value} inputData={input_data} />;
  }
  if (control === 'badge') {
    return <Badge value={value} inputData={input_data} />;
  }
  if (aggregate) {
    return <Chip label={label} value={value as string | number} />;
  }

  const formatted = formatValue(value, control);

  if (showLabel) {
    return (
      <div className="field-with-label">
        <span className="field-label">{label}</span>
        <span className="field-value">{formatted}</span>
      </div>
    );
  }

  return <span title={label}>{formatted}</span>;
}
