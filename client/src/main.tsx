import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Находим элемент 'root' в HTML и запускаем в нем React
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);