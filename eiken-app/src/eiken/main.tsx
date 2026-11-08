import '../utils/polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { EikenApp } from './EikenApp';
import '../index.css';
import '../styles/world.css';
import '../styles/perf-lite.css';
import { installDevicePerf } from '../utils/devicePerf';

// No original App entry, advertising, analytics, background sync or service-worker registration.
installDevicePerf();
createRoot(document.getElementById('root')!).render(<React.StrictMode><EikenApp /></React.StrictMode>);
