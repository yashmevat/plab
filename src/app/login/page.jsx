// app/login/page.jsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, checkAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(formData);
      console.log('FULL RESULT:', result);

      if (result.success) {
        // ✅ Direct property access - safe और reliable
        const user = result.user;
        const token = result.token;

        console.log('user:', user);
        console.log('token:', token);

        // role_id = 3 → send token in URL with `/`
        if (user.role_id === 3 && token) {
          router.push(`/`);
          return;
        }

        // normal cookie-based flow for others
        await checkAuth();

        if (user.role_id === 1) {
          router.push('/dashboard/authors');
        } else if (user.role_id === 2) {
          router.push('/author/books');
        } else {
          router.push('/');
        }

        router.refresh();
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Login</h1>
      <p>PlabCoach</p>

      <form onSubmit={handleSubmit}>
        {error && <p>{error}</p>}

        <div>
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p>
        Don't have an account? <Link href="/register">Register here</Link>
      </p>
    </div>
  );
}
