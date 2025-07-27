import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app.jsx'
import './index.css' // This imports your Tailwind CSS entry point

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)