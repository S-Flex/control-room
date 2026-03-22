import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  QueryParamProvider,
  NavigationProvider,
  AriaRouterProvider,
  SidebarProvider,
} from 'xfw-url';
import { App } from './App';
import { LayoutPage } from './LayoutPage';
import { PlanningPage } from './PlanningPage';

const queryClient = new QueryClient();
const page = new URLSearchParams(window.location.search).get('page');

function Root() {
  switch (page) {
    case 'layout': return <LayoutPage />;
    case 'planning': return <PlanningPage />;
    default: return <App />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <QueryParamProvider>
        <BrowserRouter>
          <NavigationProvider>
            <AriaRouterProvider>
              <SidebarProvider>
                <Root />
              </SidebarProvider>
            </AriaRouterProvider>
          </NavigationProvider>
        </BrowserRouter>
      </QueryParamProvider>
    </QueryClientProvider>
  </StrictMode>
);
