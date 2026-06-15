import React from 'react';
import ReactDOM from 'react-dom/client';
import { api } from './api';
import App from './App';
import './index.css';

// Shim: expose fetch-based API as window.electronAPI
// so all desktop components (Sidebar, RequestBuilder, etc.) work unchanged.
window.electronAPI = api;

// Load built-in plugins (Swagger + Database)
import('@desktop/plugins/loadBuiltins');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
