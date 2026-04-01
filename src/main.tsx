// Suppress THREE.Clock deprecation warning from @react-three/fiber (fixed in a future r3f release)
const _warn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return;
  _warn.apply(console, args);
};

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  QueryParamProvider,
  NavigationProvider,
  AriaRouterProvider,
  SidebarProvider,
  MainRoutes,
  AuxRouteProvider,
} from '@s-flex/xfw-url';
import { HomePage } from './HomePage';
import { ControlRoomPage } from './ControlRoomPage';
import { LayoutPage } from './LayoutPage';
import { ProductionLinesPage } from './ProductionLinesPage';
import { DataGroupPage } from './DataGroupPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Root() {
  return (
    <MainRoutes>
      <Route path="/control-room" element={<ControlRoomPage />} />
      <Route path="/production-lines" element={<ProductionLinesPage />} />
      <Route path="/layout" element={<LayoutPage />} />
      <Route path="/data" element={<DataGroupPage />} />
      <Route path="*" element={<HomePage />} />
    </MainRoutes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>

    <QueryClientProvider client={queryClient}>
      <QueryParamProvider>
        <BrowserRouter>
          <AuxRouteProvider>
            <NavigationProvider>
              <AriaRouterProvider>
                <SidebarProvider>
                  <Root />
                </SidebarProvider>
              </AriaRouterProvider>
            </NavigationProvider>
          </AuxRouteProvider>
        </BrowserRouter>
      </QueryParamProvider>
    </QueryClientProvider>
  </StrictMode>
);
