'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('twm_token');
    const user = localStorage.getItem('twm_user');

    if (token && user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === 'MASTER') {
          router.push('/master/dashboard');
        } else if (userData.prefix) {
          router.push(`/${userData.prefix}/dashboard`);
        } else {
          router.push('/master/login');
        }
      } catch {
        router.push('/master/login');
      }
    } else {
      router.push('/master/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}
