import { useState, useEffect } from 'react';

function Profile({ onBack }: { onBack: () => void }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  type User = {
    id: string;
    email: string;
    createdAt: string;
    updatedAt: string;
    isChirpyRed: boolean;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Please login to view your profile');
      return;
    }
  }, []);

  async function fetchUser() {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Please login to view your profile');
      return;
    }
    try {
      const res = await fetch('/api/users/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch user');
      }
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="page profile-page">
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="page profile-page">
        <h1>Profile</h1>
        <p>{error ?? 'Please log in to view your profile.'}</p>
        <button onClick={onBack} className="btn-primary">
          Back to Sign In
        </button>
      </div>
    );
  }

  // Only render user details when user exists
  return (
    <div className="page profile-page">
      <h1>Profile</h1>
      <div className="profile-info">
        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p>
          <strong>Member since:</strong> {formatDate(user.createdAt)}
        </p>
        <p>
          <strong>Chirpy Red:</strong> {user.isChirpyRed ? 'Yes' : 'No'}
        </p>
      </div>
      <button onClick={onBack} className="btn-primary">
        Back
      </button>
    </div>
  );
}

export default Profile;
