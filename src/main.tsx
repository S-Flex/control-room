// Suppress THREE.Clock deprecation warning from @react-three/fiber (fixed in a future r3f release)
const _warn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('THREE.Clock')) return;
  _warn.apply(console, args);
};

import './tailwind.css';
import './app.css';
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
import { InflowPage } from './InflowPage';
import { DataGroupPage } from './DataGroupPage';
import { configureClient } from '@s-flex/xfw-data';
import { ThemeProvider, SidebarProvider as UiSidebarProvider } from '@s-flex/xfw-ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

configureClient({
  baseUrl: import.meta.env.VITE_HUB_URL ?? 'http://probo-hub.hub.probo',
  getToken: () => null,
});

function Root() {
  return (
    <MainRoutes>
      <Route path="/control-room" element={<ControlRoomPage />} />
      <Route path="/production-lines" element={<ProductionLinesPage />} />
      <Route path="/inflow-manual" element={<InflowPage />} />
      <Route path="/inflow-auto" element={<InflowPage />} />
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
                  <UiSidebarProvider>
                    <ThemeProvider darkModeClass="dark" defaultTheme="system">
                      <Root />
                    </ThemeProvider>
                  </UiSidebarProvider>
                </SidebarProvider>
              </AriaRouterProvider>
            </NavigationProvider>
          </AuxRouteProvider>
        </BrowserRouter>
      </QueryParamProvider>
    </QueryClientProvider>
  </StrictMode>
);
