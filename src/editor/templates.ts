import type { DataGroup } from '@s-flex/xfw-ui';
import type { JSONRecord } from '@s-flex/xfw-data';
import type { EditorState } from './types';

type Template = {
  id: string;
  label: string;
  state: EditorState;
};

const flowBoardDataGroup = {
  widget_id: 'editor-preview',
  src: 'mock',
  layout: 'flow-board',
  field_config: {
    state: {
      ui: {
        i18n: { en: { title: 'State' }, nl: { title: 'Status' } },
        order: 1,
        control: 'badge',
      },
    },
    order_id: {
      ui: {
        i18n: { en: { title: 'Order' }, nl: { title: 'Order' } },
        order: 2,
        class_name: 'col-span-2',
      },
    },
    sqm: {
      ui: {
        i18n: { en: { title: 'm²' }, nl: { title: 'm²' } },
        order: 3,
        class_name: 'col-span-2',
      },
      scale: 0,
    },
    customer: {
      ui: {
        i18n: { en: { title: 'Customer' }, nl: { title: 'Klant' } },
        order: 4,
        class_name: 'col-span-3',
      },
    },
  },
  flow_board_config: {
    layout: 'flow-grid',
    children: {
      layout: 'flow-container',
      group_by: ['order_location'],
      children: {
        layout: 'flow-cards',
        row_options: { colexp: false, checkable: true, selectable: true },
        field_config: {
          class_name: 'grid grid-cols-6 gap-1',
        },
      },
    },
    row_options: { colexp: false, checkable: false, selectable: false },
  },
} as unknown as DataGroup;

const flowBoardMockRows: JSONRecord[] = [
  { order_id: 'O-1001', state: 'pending', sqm: 12.5, customer: 'Acme Co', order_location: 'NL' },
  { order_id: 'O-1002', state: 'printing', sqm: 8.2, customer: 'Globex', order_location: 'NL' },
  { order_id: 'O-1003', state: 'done', sqm: 22.0, customer: 'Initech', order_location: 'NL' },
  { order_id: 'O-1004', state: 'pending', sqm: 5.5, customer: 'Soylent', order_location: 'BE' },
  { order_id: 'O-1005', state: 'printing', sqm: 17.8, customer: 'Umbrella', order_location: 'BE' },
];

const cardsDataGroup = {
  widget_id: 'editor-preview',
  src: 'mock',
  layout: 'cards',
  field_config: {
    name: { ui: { i18n: { en: { title: 'Name' } }, order: 1, class_name: 'col-span-3' } },
    state: { ui: { i18n: { en: { title: 'State' } }, order: 2, control: 'badge' } },
    progress: { ui: { i18n: { en: { title: 'Progress' } }, order: 3, control: 'percent' } },
  },
} as unknown as DataGroup;

const cardsMockRows: JSONRecord[] = [
  { name: 'Line 1', state: 'running', progress: 72 },
  { name: 'Line 2', state: 'idle', progress: 0 },
  { name: 'Line 3', state: 'running', progress: 31 },
];

const tableDataGroup = {
  widget_id: 'editor-preview',
  src: 'mock',
  layout: 'table',
  field_config: {
    sku: { ui: { i18n: { en: { title: 'SKU' } }, order: 1 } },
    qty: { ui: { i18n: { en: { title: 'Qty' } }, order: 2 }, scale: 0 },
    price: { ui: { i18n: { en: { title: 'Price' } }, order: 3 }, scale: 2 },
  },
} as unknown as DataGroup;

const tableMockRows: JSONRecord[] = [
  { sku: 'A-1', qty: 12, price: 9.95 },
  { sku: 'A-2', qty: 4, price: 19.5 },
  { sku: 'B-7', qty: 30, price: 1.25 },
];

export const TEMPLATES: Template[] = [
  { id: 'flow-board', label: 'Flow-Board (starter)', state: { dataGroup: flowBoardDataGroup, mockRows: flowBoardMockRows } },
  { id: 'cards', label: 'Cards (starter)', state: { dataGroup: cardsDataGroup, mockRows: cardsMockRows } },
  { id: 'table', label: 'Table (starter)', state: { dataGroup: tableDataGroup, mockRows: tableMockRows } },
];

export function blankTemplate(layout: string): EditorState {
  const dg = {
    widget_id: 'editor-preview',
    src: 'mock',
    layout,
    field_config: {
      field_a: { ui: { i18n: { en: { title: 'Field A' } }, order: 1 } },
    },
  } as unknown as DataGroup;
  const rows: JSONRecord[] = [{ field_a: 'value 1' }, { field_a: 'value 2' }];
  return { dataGroup: dg, mockRows: rows };
}

export const DEFAULT_TEMPLATE = TEMPLATES[0];
