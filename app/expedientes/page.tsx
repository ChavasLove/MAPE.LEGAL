'use client';

import { useEffect, useState } from 'react';
import type { Expediente } from '@/modules/types';

export default function ExpedientesPage() {
  const [data, setData] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/expedientes')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <h1>Expedientes</h1>
      <ul>
        {data.map((e) => (
          <li key={e.id}>
            {e.name} — {e.phase?.name ?? 'Sin fase'}
          </li>
        ))}
      </ul>
    </div>
  );
}
