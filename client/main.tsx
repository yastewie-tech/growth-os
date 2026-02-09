import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App.tsx'; // Подключаем наш App
import './src/index.css'; // Подключаем стили

// Находим элемент 'root' в HTML и запускаем в нем React
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);