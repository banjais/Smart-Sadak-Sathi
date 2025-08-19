/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

type UserRole = 'guest' | 'admin' | 'superadmin';
type AuthStatus = {
  loggedIn: boolean;
  role: UserRole | null;
  userEmail: string | null;
};
type ApiKey = { id: number; name: string; value: string };
type SheetId = { id: number; name: string; value: string };
type LoginView = 'login' | 'forgot' | 'otp';

// --- SVG Icons ---
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0 2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CloseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);

// --- Settings Panel Components ---
const SuperAdminSettings = ({ settings, setSettings }) => {
  const [newApiKey, setNewApiKey] = useState({ name: '', value: '' });
  const [newSheetId, setNewSheetId] = useState({ name: '', value: '' });

  const handleAddApiKey = () => {
    if (!newApiKey.name || !newApiKey.value) return;
    const newKey: ApiKey = { ...newApiKey, id: Date.now() };
    setSettings({ ...settings, apiKeys: [...settings.apiKeys, newKey] });
    setNewApiKey({ name: '', value: '' });
  };
  
  const handleRemoveApiKey = (id: number) => {
    setSettings({ ...settings, apiKeys: settings.apiKeys.filter(key => key.id !== id) });
  };

  const handleAddSheetId = () => {
    if (!newSheetId.name || !newSheetId.value) return;
    const newId: SheetId = { ...newSheetId, id: Date.now() };
    setSettings({ ...settings, sheetIds: [...settings.sheetIds, newId] });
    setNewSheetId({ name: '', value: '' });
  };

  const handleRemoveSheetId = (id: number) => {
    setSettings({ ...settings, sheetIds: settings.sheetIds.filter(sheet => sheet.id !== id) });
  };

  return (
    <div>
      <h3>Super Admin Controls</h3>
      <div className="setting-group">
        <h4>UI Customization</h4>
        <label htmlFor="bgColor">Background Color</label>
        <input 
          type="color" 
          id="bgColor" 
          value={settings.backgroundColor} 
          onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
        />
      </div>
      <div className="setting-group">
        <h4>API Key Management</h4>
        <div className="warning-box">
          <strong>Security Warning:</strong> Never expose API keys on the frontend. This UI is for demonstration only. Use a secure backend to store and use keys.
        </div>
        <div className="credential-list">
            {settings.apiKeys.map((key) => (
                <div key={key.id} className="credential-item">
                    <span>{key.name}</span>
                    <input type="password" value={key.value} readOnly disabled />
                    <button onClick={() => handleRemoveApiKey(key.id)}>Remove</button>
                </div>
            ))}
        </div>
        <div className="add-credential-form">
            <input type="text" placeholder="API Name (e.g., Gemini)" value={newApiKey.name} onChange={(e) => setNewApiKey({...newApiKey, name: e.target.value})}/>
            <input type="password" placeholder="API Key Value" value={newApiKey.value} onChange={(e) => setNewApiKey({...newApiKey, value: e.target.value})}/>
            <button onClick={handleAddApiKey} className="add-btn">Add Key</button>
        </div>
      </div>
      <div className="setting-group">
        <h4>Google Sheet IDs</h4>
        <div className="credential-list">
            {settings.sheetIds.map((sheet) => (
                <div key={sheet.id} className="credential-item">
                    <span>{sheet.name}</span>
                    <input type="text" value={sheet.value} readOnly disabled />
                    <button onClick={() => handleRemoveSheetId(sheet.id)}>Remove</button>
                </div>
            ))}
        </div>
        <div className="add-credential-form">
            <input type="text" placeholder="Sheet Name (e.g., Main Data)" value={newSheetId.name} onChange={(e) => setNewSheetId({...newSheetId, name: e.target.value})}/>
            <input type="text" placeholder="Sheet ID Value" value={newSheetId.value} onChange={(e) => setNewSheetId({...newSheetId, value: e.target.value})}/>
            <button onClick={handleAddSheetId} className="add-btn">Add Sheet ID</button>
        </div>
      </div>
    </div>
  );
};

const AdminSettings = () => (
  <div>
    <h3>Admin Settings</h3>
    <div className="setting-group">
        <p>You have limited administrative access.</p>
        <p>View reports and manage user-submitted content.</p>
    </div>
  </div>
);

const SettingsPanel = ({ isOpen, onClose, role, settings, setSettings, onLogout }) => {
  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-btn" aria-label="Close settings">
            <CloseIcon />
        </button>
        <div className="settings-content">
          {role === 'superadmin' && <SuperAdminSettings settings={settings} setSettings={setSettings} />}
          {role === 'admin' && <AdminSettings />}
        </div>
        <div className="settings-panel-footer">
          <p>Logged in as: <strong>{role}</strong></p>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---
const App = ({ role, userEmail, onLogout }) => {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
      backgroundColor: '#F3F4F6',
      apiKeys: [] as ApiKey[],
      sheetIds: [] as SheetId[]
  });

  const canShowSettings = useMemo(() => role === 'admin' || role === 'superadmin', [role]);
  
  // Apply dynamic styles
  document.body.style.backgroundColor = settings.backgroundColor;

  return (
    <>
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        role={role}
        settings={settings}
        setSettings={setSettings}
        onLogout={onLogout}
      />
      
      <header className="app-header">
        <h1>Sadak Sathi</h1>
        {canShowSettings && (
            <div className="header-user-info">
                <span className="user-email">{userEmail}</span>
                <button className="settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
                    <SettingsIcon />
                </button>
            </div>
        )}
      </header>

      <main className="main-content">
        <div className="welcome-card">
          <h2>Your Road Companion</h2>
          <p>
            Report incidents, check road conditions, and travel safer. Ready to start your journey?
          </p>
        </div>
      </main>
    </>
  );
};

// --- Authentication Components ---
const LoginScreen = ({ onLoginSuccess }) => {
  const [view, setView] = useState<LoginView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    // --- SIMULATED LOGIN ---
    if (email === 'superadmin@app.com' && password === 'password123') {
      onLoginSuccess({ loggedIn: true, role: 'superadmin', userEmail: email });
    } else if (email === 'admin@app.com' && password === 'password123') {
      onLoginSuccess({ loggedIn: true, role: 'admin', userEmail: email });
    } else {
      setError('Invalid email or password.');
    }
  };

  const handlePasswordReset = (e) => {
    e.preventDefault();
    // In a real app, this would trigger a backend API call
    console.log(`Password reset requested for ${email}`);
    setView('otp');
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    // In a real app, this would verify the OTP and new password
    console.log(`Password has been reset.`);
    setView('login');
  }

  return (
    <div className="login-container">
      <div className="login-card">
        {view === 'login' && (
          <form onSubmit={handleLogin}>
            <h2>Welcome Back</h2>
            <p>Login to manage Sadak Sathi.</p>
            {error && <p className="error-message">{error}</p>}
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="login-btn">Login</button>
            <p className="form-link" onClick={() => setView('forgot')}>Forgot Password?</p>
            <div className="info-box">
              <p><strong>Demo Credentials:</strong></p>
              <p>Super Admin: <code>superadmin@app.com</code></p>
              <p>Admin: <code>admin@app.com</code></p>
              <p>Password: <code>password123</code></p>
            </div>
          </form>
        )}
        {view === 'forgot' && (
          <form onSubmit={handlePasswordReset}>
            <h2>Reset Password</h2>
            <p>Enter your email to receive a one-time password (OTP).</p>
            <div className="form-group">
              <label htmlFor="reset-email">Email</label>
              <input type="email" id="reset-email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className="login-btn">Send OTP</button>
            <p className="form-link" onClick={() => setView('login')}>Back to Login</p>
          </form>
        )}
        {view === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <h2>Enter OTP</h2>
            <p>Check your email for the OTP code.</p>
            <div className="form-group">
              <label htmlFor="otp">OTP Code</label>
              <input type="text" id="otp" required />
            </div>
             <div className="form-group">
              <label htmlFor="new-password">New Password</label>
              <input type="password" id="new-password" required />
            </div>
            <button type="submit" className="login-btn">Reset Password</button>
            <p className="form-link" onClick={() => setView('login')}>Back to Login</p>
          </form>
        )}
      </div>
    </div>
  );
};

// --- Auth Flow Manager ---
const AuthFlow = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    loggedIn: true,
    role: 'admin',
    userEmail: 'admin@app.com',
  });

  const handleLogout = () => {
    setAuthStatus({ loggedIn: false, role: null, userEmail: null });
  };
  
  if (!authStatus.loggedIn) {
    return <LoginScreen onLoginSuccess={setAuthStatus} />;
  }

  return <App role={authStatus.role} userEmail={authStatus.userEmail} onLogout={handleLogout} />;
};


const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <AuthFlow />
  </React.StrictMode>
);