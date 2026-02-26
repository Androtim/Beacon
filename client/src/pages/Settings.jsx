import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './index.css';

const Settings = () => {
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.com");
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  return (
    <div className="container">
      <header className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}>
        <Link to="/" className="btn" style={{ fontSize: '1.25rem', padding: '0.25rem', color: 'var(--text-secondary)' }}>&larr;</Link>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Settings</h2>
        <div style={{ width: '2rem' }}></div>
      </header>

      <main>
        <section className="card">
          <h3 style={{ marginBottom: '1rem' }}>Profile</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label className="input-field" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Your Name"
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label className="input-field" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email</label>
            <input 
              type="email" 
              className="input-field" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="your@email.com"
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }}>
            Update Profile
          </button>
        </section>

        <section className="card">
          <h3 style={{ marginBottom: '1rem' }}>Preferences</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span>Push Notifications</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={notifications} 
                onChange={() => setNotifications(!notifications)} 
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span>Dark Mode</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={() => setDarkMode(!darkMode)} 
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
            </label>
          </div>
        </section>

        <button 
          className="btn" 
          style={{ width: '100%', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', marginTop: '1rem' }}
        >
          Sign Out
        </button>
      </main>
    </div>
  );
};

export default Settings;
