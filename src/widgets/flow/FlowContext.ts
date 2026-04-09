import { createContext, useContext } from 'react';
import type { FlowContextValue } from './types';

const FlowContext = createContext<FlowContextValue | null>(null);

export const FlowProvider = FlowContext.Provider;

export function useFlowContext(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useFlowContext must be used within a FlowProvider');
  return ctx;
}
