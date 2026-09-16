import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { ensureOutboxWorker, processOutbox } from './services/offline';
import './index.css';

ensureOutboxWorker();
window.addEventListener('online', () => void processOutbox());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
