import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export default function App() {
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    fetch(`${API_BASE_URL}/status`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.mongo.connected ? 'Connected' : 'Disconnected');
      })
      .catch(() => {
        setStatus('Unavailable');
      });
  }, []);

  return (
    <main className="container">
      <h1>Hello Movies</h1>
      <p>MongoDB status: <strong>{status}</strong></p>
    </main>
  );
}
