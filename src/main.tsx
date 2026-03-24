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
} from 'xfw-url';
import { App } from './App';
import { LayoutPage } from './LayoutPage';
import { PlanningPage } from './PlanningPage';

const queryClient = new QueryClient();

function Root() {
  return (
    <MainRoutes>
      <Route path="/layout" element={<LayoutPage />} />
      <Route path="/planning" element={<PlanningPage />} />
      <Route path="*" element={<App />} />
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
