import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

const isMetaMaskConnectionNoise = (value) => {
  const message = value?.message || value?.reason?.message || String(value || '');
  const stack = value?.stack || value?.reason?.stack || '';
  const source = value?.filename || value?.reason?.filename || '';

  const hasMetaMaskMessage = /Failed to connect to MetaMask|MetaMask/i.test(message);
  const hasMetaMaskStack = /chrome-extension:\/\/nkbihfbeogaeaoehlefnkodbefgpgknn\/scripts\/inpage\.js/i.test(stack);
  const hasMetaMaskSource = /chrome-extension:\/\/nkbihfbeogaeaoehlefnkodbefgpgknn\/scripts\/inpage\.js/i.test(source);

  return hasMetaMaskMessage || hasMetaMaskStack || hasMetaMaskSource;
};

window.addEventListener('unhandledrejection', (event) => {
  if (isMetaMaskConnectionNoise(event?.reason)) {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    console.warn('MetaMask connection warning suppressed:', event.reason);
  }
}, true);

window.addEventListener('error', (event) => {
  const errorPayload = {
    message: event?.message,
    filename: event?.filename,
    stack: event?.error?.stack,
    error: event?.error,
  };

  if (isMetaMaskConnectionNoise(errorPayload)) {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    console.warn('MetaMask runtime warning suppressed:', event.error || event.message);
  }
}, true);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
