/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

type UserRole = 'guest' | 'admin' | 'superadmin' | 'user';
type AuthStatus = {
  loggedIn: boolean;
  role: UserRole | null;
  userEmail: string | null;
};
type ApiKey = { id: number; name: string; value: string };
type SheetId = { id: number; name: string; value: string };
type LoginView = 'login' | 'forgot' | 'otp' | 'reset_success';

// --- SIMULATED BACKEND API ---
// This object mimics a secure backend server. In a real application,
// these functions would make network requests (e.g., using fetch) to your server.

const SimulatedUserAPI = {
  _users: [
    { email: 'superadmin@app.com', password: 'password123', role: 'superadmin' as UserRole },
    { email: 'admin@app.com', password: 'password123', role: 'admin' as UserRole },
    { email: 'user@app.com', password: 'password123', role: 'user' as UserRole },
  ],

  async login(email, password) {
    await new Promise(res => setTimeout(res, 500)); // Simulate network delay
    const user = this._users.find(u => u.email === email && u.password === password);
    if (user) {
      return { success: true, user: { email: user.email, role: user.role } };
    }
    return { success: false, error: 'Invalid email or password.' };
  },

  async findUserByEmail(email) {
    await new Promise(res => setTimeout(res, 500));
    const userExists = this._users.some(u => u.email === email);
    if (userExists) {
      return { success: true };
    }
    return { success: false, error: 'No account found with that email address.' };
  },

  async resetPassword(email, newPassword) {
    await new Promise(res => setTimeout(res, 500));
    const userIndex = this._users.findIndex(u => u.email === email);
    if (userIndex > -1) {
      this._users[userIndex].password = newPassword;
      return { success: true };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
};


const SimulatedDataAPI = {
    _roadData: [
        { id: 1, HighwayName: 'Araniko Highway', Section: 'Kathmandu - Kodari', Status: 'Blocked', Cause: 'Landslide', Contact: '123-456-7890', Lat: 27.7172, Lng: 85.3240 },
        { id: 2, HighwayName: 'Prithvi Highway', Section: 'Naubise - Mugling', Status: 'One-lane', Cause: 'Road work', Contact: '123-456-7891', Lat: 27.8389, Lng: 84.8525 },
        { id: 3, HighwayName: 'Siddhartha Highway', Section: 'Butwal - Palpa', Status: 'Resumed', Cause: 'Cleared', Contact: '123-456-7892', Lat: 27.8643, Lng: 83.5516 },
        { id: 4, HighwayName: 'Karnali Highway', Section: 'Surkhet - Jumla', Status: 'Blocked', Cause: 'Heavy Snow', Contact: '123-456-7893', Lat: 28.5633, Lng: 82.2858 },
    ],

    async getRoadData() {
        await new Promise(res => setTimeout(res, 800)); // Simulate network delay
        return { success: true, data: this._roadData };
    }
};


// --- SVG Icons ---
const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0 2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
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

// --- Main App Components ---

const DashboardPage = () => {
    const [allRoads, setAllRoads] = useState([]);
    const [filteredRoads, setFilteredRoads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const response = await SimulatedDataAPI.getRoadData();
            if (response.success) {
                setAllRoads(response.data);
                setFilteredRoads(response.data);
            }
            setLoading(false);
        };
        fetchData();
    }, []);
    
    useEffect(() => {
        let roads = allRoads;
        if (statusFilter !== 'all') {
            roads = roads.filter(r => r.Status.toLowerCase() === statusFilter);
        }
        if (searchTerm) {
            roads = roads.filter(r => r.HighwayName.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        setFilteredRoads(roads);
    }, [searchTerm, statusFilter, allRoads]);

    const summaryData = useMemo(() => {
        return allRoads.reduce((acc, road) => {
            acc[road.Status] = (acc[road.Status] || 0) + 1;
            return acc;
        }, {});
    }, [allRoads]);

    return (
        <main className="main-content dashboard">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Dashboard</h2>
                <div className="flex gap-2">
                    <button className="p-2 bg-green-500 text-white rounded">Print</button>
                    <button className="p-2 bg-yellow-500 text-white rounded">Share</button>
                </div>
            </div>
             <div className="mb-4">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search roads..." className="p-2 border rounded w-full"/>
             </div>
             <div className="mb-4 flex gap-2">
                <button onClick={() => setStatusFilter('blocked')} className={`filterBtn p-2 rounded ${statusFilter === 'blocked' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>Blocked</button>
                <button onClick={() => setStatusFilter('one-lane')} className={`filterBtn p-2 rounded ${statusFilter === 'one-lane' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>One-lane</button>
                <button onClick={() => setStatusFilter('resumed')} className={`filterBtn p-2 rounded ${statusFilter === 'resumed' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>Resumed</button>
                <button onClick={() => setStatusFilter('all')} className={`filterBtn p-2 rounded ${statusFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>All</button>
            </div>

            <div id="content" className="border p-4 rounded bg-white dark:bg-gray-900">
                {loading ? <p>Loading road data...</p> : (
                    <table className="w-full table-auto border-collapse border">
                        <thead>
                        <tr className="bg-gray-200 dark:bg-gray-700">
                            <th className="border p-2">Highway/Bridge</th>
                            <th className="border p-2">Section</th>
                            <th className="border p-2">Status</th>
                            <th className="border p-2">Cause</th>
                            <th className="border p-2">Contact</th>
                        </tr>
                        </thead>
                        <tbody>
                            {filteredRoads.map(r => (
                                <tr key={r.id}>
                                    <td className="border p-2">{r.HighwayName}</td>
                                    <td className="border p-2">{r.Section}</td>
                                    <td className="border p-2">{r.Status}</td>
                                    <td className="border p-2">{r.Cause}</td>
                                    <td className="border p-2">{r.Contact}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </main>
    );
};


const App = ({ role, userEmail, onLogout }) => {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
      backgroundColor: '#FFFFFF', // Changed default to white for dashboard
      apiKeys: [] as ApiKey[],
      sheetIds: [] as SheetId[]
  });

  const canShowSettings = useMemo(() => role === 'admin' || role === 'superadmin', [role]);
  
  // Apply dynamic styles
  useEffect(() => {
    document.body.style.backgroundColor = settings.backgroundColor;
  }, [settings.backgroundColor]);

  return (
    <div className="app-container">
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
        <div className="header-user-info">
            <span className="user-email">{userEmail}</span>
            {canShowSettings && (
                <button className="settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Open settings">
                    <SettingsIcon />
                </button>
            )}
        </div>
      </header>

      <DashboardPage />

    </div>
  );
};

// --- Authentication Components ---
const LoginScreen = ({ onLoginSuccess }) => {
  const [view, setView] = useState<LoginView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await SimulatedUserAPI.login(email, password);

    if (result.success) {
      onLoginSuccess({ loggedIn: true, role: result.user.role, userEmail: result.user.email });
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handlePasswordResetRequest = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await SimulatedUserAPI.findUserByEmail(email);
    if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
    }
    console.log(`Password reset requested for ${email}`);
    setIsOtpVerified(false);
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setView('otp');
    setLoading(false);
  };

  const handleOtpVerification = (e) => {
    e.preventDefault();
    setError('');
    if (otp === '123456') {
      setIsOtpVerified(true);
      setError('');
    } else {
      setError('Invalid OTP code. Please use 123456 for this demo.');
    }
  };

  const handleFinalPasswordReset = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    
    await SimulatedUserAPI.resetPassword(email, newPassword);

    console.log(`Password has been successfully reset for ${email}.`);
    setView('reset_success');
    setLoading(false);
  };

  const backToLogin = () => {
    setEmail('');
    setPassword('');
    setOtp('');
    setIsOtpVerified(false);
    setError('');
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
            <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
            <p className="form-link" onClick={() => { setError(''); setView('forgot'); }}>
                Forgot Password?
            </p>
            <div className="info-box">
              <p><strong>Demo Credentials:</strong></p>
              <p>Super Admin: <code>superadmin@app.com</code></p>
              <p>Admin: <code>admin@app.com</code></p>
              <p>User: <code>user@app.com</code></p>
              <p>Initial Password: <code>password123</code></p>
            </div>
          </form>
        )}
        {view === 'forgot' && (
          <form onSubmit={handlePasswordResetRequest}>
            <h2>Reset Password</h2>
            <p>Enter your email to receive a one-time password (OTP).</p>
            {error && <p className="error-message">{error}</p>}
            <div className="form-group">
              <label htmlFor="reset-email">Email</label>
              <input type="email" id="reset-email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Sending...' : 'Send OTP'}</button>
            <p className="form-link" onClick={backToLogin}>Back to Login</p>
          </form>
        )}
        {view === 'otp' && (
          <form onSubmit={isOtpVerified ? handleFinalPasswordReset : handleOtpVerification}>
            <h2>Reset Password</h2>
            {error && <p className="error-message">{error}</p>}
            
            {!isOtpVerified ? (
              <>
                <p>An OTP has been sent to your email. For this demo, please use the code below.</p>
                <div className="otp-info">
                  <p>Demo OTP Code: <code>123456</code></p>
                </div>
                <div className="form-group">
                  <label htmlFor="otp">OTP Code</label>
                  <input type="text" id="otp" value={otp} onChange={e => setOtp(e.target.value)} required />
                </div>
                <button type="submit" className="login-btn">Verify OTP</button>
              </>
            ) : (
              <>
                <p className="success-message">OTP Verified. Please set your new password.</p>
                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>
                  <input type="password" id="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <input type="password" id="confirm-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
                <button type="submit" className="login-btn" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
              </>
            )}
            
            <p className="form-link" onClick={backToLogin}>Back to Login</p>
          </form>
        )}
        {view === 'reset_success' && (
            <div>
                <h2 className="success-heading">Password Reset Successful!</h2>
                <p>Your password has been changed. You can now log in with your new password.</p>
                <button onClick={backToLogin} className="login-btn">Back to Login</button>
            </div>
        )}
      </div>
    </div>
  );
};

// --- Auth Flow Manager ---
const AuthFlow = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    loggedIn: false,
    role: null,
    userEmail: null,
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
