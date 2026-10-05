import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { isSupabaseConfigured } from './lib/supabase';
import { MissingConfig } from './screens/MissingConfig';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isSupabaseConfigured ? <App /> : <MissingConfig />}</StrictMode>,
);
