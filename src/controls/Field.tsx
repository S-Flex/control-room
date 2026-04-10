import type { JSONValue } from '@s-flex/xfw-data';
import type { ResolvedField } from '@s-flex/xfw-ui';
import { resolveI18nLabel, formatValue } from '../widgets/flow/utils';
import { IconMap } from './IconMap';
import { Chip } from './Chip';
import { Badge } from './Badge';

type FieldProps = {
  field: ResolvedField & { aggregate?: string };
  value: JSONValue;
};

export function Field({ field, value }: FieldProps) {
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
  
  return <>{formatValue(value, control)}</>;
}
