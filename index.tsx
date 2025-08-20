/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat } from "@google/genai";


type UserRole = 'guest' | 'admin' | 'superadmin' | 'user';
type AuthStatus = {
  loggedIn: boolean;
  role: UserRole | null;
  userEmail: string | null;
};
type ApiKey = { id: number; name: string; value: string };
type SheetId = { id: number; name: string; value: string };
type LoginView = 'login' | 'forgot' | 'otp' | 'reset_success';
type Message = { id: number; text: string; sender: 'user' | 'ai' };
type ActivityLog = { id: number; timestamp: string; message: string; };
type AppView = 'dashboard' | 'users' | 'analytics' | 'logs' | 'route-planner';

// --- SIMULATED BACKEND API ---
// This object mimics a secure backend server for user authentication.
// It is NOT connected to the Google Sheet to prevent exposing sensitive user data.
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
  
  async changePassword(email, currentPassword, newPassword) {
    await new Promise(res => setTimeout(res, 500));
    const userIndex = this._users.findIndex(u => u.email === email);
    if (userIndex === -1) {
        return { success: false, error: 'User not found.' };
    }
    if (this._users[userIndex].password !== currentPassword) {
        return { success: false, error: 'Incorrect current password.' };
    }
    this._users[userIndex].password = newPassword;
    return { success: true };
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


// --- LIVE GOOGLE SHEET API ---
const GoogleSheetAPI = {
    _sheetId: '1gfbACf6IkjNhrC_xUDuiFPUyOmgqsuU8mqKVED7Gook',
    _roadSheetGid: '1775100935',
    _bridgeSheetGid: '0',
    _superAdminSheetGid: '143241838', // GID for "SuperAdmin" sheet
    _adminSheetGid: '105429813', // Correct GID for "Admin" sheet
    _userSheetGid: '1471371842', // Correct GID for "User" sheet

    _csvToJson(csv: string) {
        if (!csv) return [];
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const obj = {};
            // Basic CSV parsing, may need improvement for complex cases
            const currentLine = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
            if (currentLine.length < headers.length) continue;
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentLine[j];
            }
            result.push(obj);
        }
        return result;
    },

    async _fetchSheetData(gid: string) {
        const url = `https://docs.google.com/spreadsheets/d/${this._sheetId}/export?format=csv&gid=${gid}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        } catch (error) {
            console.error("Error fetching sheet with GID:", gid, error);
            throw new Error(`Failed to fetch sheet with GID: ${gid}`);
        }
    },

    async getRoadAndBridgeData() {
        try {
            const [roadCsv, bridgeCsv] = await Promise.all([
                this._fetchSheetData(this._roadSheetGid),
                this._fetchSheetData(this._bridgeSheetGid)
            ]);
            
            const roadJson = this._csvToJson(roadCsv).map((r, index) => ({ ...r, type: 'Road', name: r.HighwayName, location: r.Section, uniqueId: `road-${r.id || index}` }));
            const bridgeJson = this._csvToJson(bridgeCsv).map((b, index) => ({ ...b, type: 'Bridge', name: b.BridgeName, location: b.Location, uniqueId: `bridge-${b.id || index}`}));
            
            const combinedData = [...roadJson, ...bridgeJson];
            return { success: true, data: combinedData };
        } catch (error) {
            console.error("Error fetching road/bridge data:", error);
            return { success: false, error: 'Could not load road/bridge data. Please check the connection and sheet permissions.' };
        }
    },
    
    async getAdminAndUserData() {
        try {
            const [superAdminCsv, adminCsv, userCsv] = await Promise.all([
                this._fetchSheetData(this._superAdminSheetGid),
                this._fetchSheetData(this._adminSheetGid),
                this._fetchSheetData(this._userSheetGid)
            ]);
            
            // NOTE: Password field is intentionally not used for login to maintain security.
            const superAdminJson = this._csvToJson(superAdminCsv).map((sa, index) => ({ ...sa, role: 'Super Admin', uniqueId: `superadmin-${sa.id || index}` }));
            const adminJson = this._csvToJson(adminCsv).map((a, index) => ({ ...a, role: 'Admin', uniqueId: `admin-${a.id || index}` }));
            const userJson = this._csvToJson(userCsv).map((u, index) => ({ ...u, role: 'User', uniqueId: `user-${u.id || index}` }));
            
            return { success: true, data: [...superAdminJson, ...adminJson, ...userJson] };

        } catch (error) {
            console.error("Error fetching admin/user data:", error);
            return { success: false, error: 'Could not load user data. Please verify the GIDs in the code and check sheet permissions.' };
        }
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

const ChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

const DashboardIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>);
const UsersIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>);
const AnalyticsIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>);
const LogIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>);
const RouteIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="19" r="3"></circle><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H13"></path><circle cx="18" cy="5" r="3"></circle></svg>);
const LogoutIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>);
const ChevronLeftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>);


// --- Settings Panel Components ---
const SuperAdminSettings = ({ settings, setSettings, userEmail, logActivity }) => {
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: '', text: '' });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    
    const result = await SimulatedUserAPI.changePassword(userEmail, passwordForm.currentPassword, passwordForm.newPassword);
    
    if (result.success) {
      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      logActivity(`SuperAdmin password changed.`);
    } else {
      setPasswordMessage({ type: 'error', text: result.error });
    }
  };

  return (
    <div>
      <h3>Super Admin Controls</h3>
      <div className="setting-group">
        <h4>UI Customization</h4>
        <label htmlFor="bgColor">Background Color</label>
        <input type="color" id="bgColor" value={settings.backgroundColor} onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })} />
        <label htmlFor="primaryColor">Primary Color</label>
        <input type="color" id="primaryColor" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} />
        <label htmlFor="textColor">Text Color</label>
        <input type="color" id="textColor" value={settings.textColor} onChange={(e) => setSettings({ ...settings, textColor: e.target.value })} />
      </div>

       <div className="setting-group">
        <h4>Password Management</h4>
        <form className="password-change-form" onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label htmlFor="current-password">Current Password</label>
            <input type="password" id="current-password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} required/>
          </div>
          <div className="form-group">
            <label htmlFor="new-password">New Password</label>
            <input type="password" id="new-password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} required/>
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">Confirm New Password</label>
            <input type="password" id="confirm-password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} required/>
          </div>
          {passwordMessage.text && <p className={`${passwordMessage.type}-message`}>{passwordMessage.text}</p>}
          <button type="submit" className="add-btn">Change Password</button>
        </form>
      </div>

      <div className="setting-group">
          <h4>AI Features</h4>
          <div className="toggle-switch">
              <input type="checkbox" id="chat-toggle" checked={settings.isChatEnabled} onChange={e => setSettings({ ...settings, isChatEnabled: e.target.checked })} />
              <label htmlFor="chat-toggle" className="slider"></label>
              <span className="toggle-label">Enable AI Chat Assistant</span>
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

const SettingsPanel = ({ isOpen, onClose, role, settings, setSettings, onLogout, userEmail, logActivity }) => {
  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-btn" aria-label="Close settings">
            <CloseIcon />
        </button>
        <div className="settings-content">
          {role === 'superadmin' && <SuperAdminSettings settings={settings} setSettings={setSettings} userEmail={userEmail} logActivity={logActivity} />}
          {role === 'admin' && <AdminSettings />}
        </div>
      </div>
    </div>
  );
};

// --- AI Chatbot Component ---
const Chatbot = ({ roadData, isEnabled }) => {
    const [isOpen, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, text: "Hello! I'm Sadak Sathi's AI assistant. Ask me about the current road and bridge conditions.", sender: 'ai' }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    useEffect(() => {
        if (!roadData || roadData.length === 0) return;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const systemInstruction = `You are 'Sadak Sathi AI', a helpful assistant for road conditions in Nepal. Your knowledge is strictly limited to the data provided below about roads and bridges. Do not invent information or use external knowledge. If the user asks about something not in the data, state that you don't have information on it. Keep your answers friendly and concise.\n\nCURRENT ROAD & BRIDGE DATA:\n${JSON.stringify(roadData, null, 2)}`;
            
            chatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction },
            });
        } catch(e) {
            console.error("Failed to initialize Gemini AI:", e);
             setMessages(prev => [...prev, {id: Date.now(), text: "Sorry, the AI assistant could not be initialized.", sender: 'ai'}]);
        }

    }, [roadData]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading || !chatRef.current) return;

        const newUserMessage: Message = { id: Date.now(), text: userInput, sender: 'user' };
        setMessages(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsLoading(true);

        try {
            const response = await chatRef.current.sendMessage({ message: userInput });
            const aiMessage: Message = { id: Date.now() + 1, text: response.text, sender: 'ai' };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            console.error("Gemini API error:", error);
            const errorMessage: Message = { id: Date.now() + 1, text: "Sorry, I encountered an error. Please try again.", sender: 'ai' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isEnabled) return null;

    return (
        <>
            <button className="chat-fab" onClick={() => setOpen(!isOpen)} aria-label="Open chat assistant">
                {isOpen ? <CloseIcon /> : <ChatIcon />}
            </button>
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <h3>AI Assistant</h3>
                        <button onClick={() => setOpen(false)} aria-label="Close chat">
                            <CloseIcon/>
                        </button>
                    </div>
                    <div className="chat-messages">
                        {messages.map(msg => (
                            <div key={msg.id} className={`chat-message ${msg.sender}-message`}>
                                {msg.text}
                            </div>
                        ))}
                        {isLoading && (
                           <div className="chat-message ai-message">
                               <div className="typing-indicator">
                                   <span></span><span></span><span></span>
                               </div>
                           </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Ask about roads..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || !userInput.trim()}>
                            <SendIcon/>
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};


// --- Main App Components ---

const RoadStatusDashboard = ({ filteredData, searchTerm, setSearchTerm, statusFilter, setStatusFilter, loading, error }) => {
    return (
        <>
            <div className="dashboard-controls">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name..." className="search-input"/>
                <div className="filter-group">
                    <button onClick={() => setStatusFilter('blocked')} className={`filter-btn ${statusFilter === 'blocked' ? 'active' : ''}`}>Blocked</button>
                    <button onClick={() => setStatusFilter('one-lane')} className={`filter-btn ${statusFilter === 'one-lane' ? 'active' : ''}`}>One-lane</button>
                    <button onClick={() => setStatusFilter('resumed')} className={`filter-btn ${statusFilter === 'resumed' ? 'active' : ''}`}>Resumed</button>
                    <button onClick={() => setStatusFilter('all')} className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}>All</button>
                </div>
            </div>
            <div id="content" className="content-panel">
                {loading ? <p>Loading live data from Google Sheets...</p> : 
                 error ? <p className="error-message">{error}</p> : (
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Type</th>
                            <th>Name</th>
                            <th>Section / Location</th>
                            <th>Status</th>
                            <th>Cause</th>
                            <th>Contact</th>
                        </tr>
                        </thead>
                        <tbody>
                            {filteredData.map(r => (
                                <tr key={r.uniqueId}>
                                    <td className="text-center">
                                      <span className={`type-badge type-${r.type.toLowerCase()}`}>{r.type}</span>
                                    </td>
                                    <td>{r.name}</td>
                                    <td>{r.location}</td>
                                    <td>{r.Status}</td>
                                    <td>{r.Cause}</td>
                                    <td>{r.Contact}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
};

const UserManagementDashboard = ({ logActivity }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newUser, setNewUser] = useState({ email: '', role: 'user', status: 'Active' });

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            setError(null);
            const response = await GoogleSheetAPI.getAdminAndUserData();
            if (response.success) {
                setUsers(response.data);
                logActivity("Fetched user data from Google Sheet.");
            } else {
                setError(response.error);
                logActivity(`Error fetching user data: ${response.error}`);
            }
            setLoading(false);
        };
        fetchUsers();
    }, [logActivity]);

    const handleAddUser = (e) => {
        e.preventDefault();
        if (!newUser.email) return;
        const userExists = users.some(u => u.email === newUser.email);
        if (userExists) {
            alert('User with this email already exists.');
            return;
        }
        const userToAdd = {
            ...newUser,
            uniqueId: `local-${Date.now()}`
        };
        setUsers([...users, userToAdd]);
        logActivity(`Simulated add for user: ${newUser.email}`);
        setNewUser({ email: '', role: 'user', status: 'Active' });
    };

    const handleRemoveUser = (uniqueId, email) => {
        if (window.confirm(`Are you sure you want to remove ${email}?`)) {
            setUsers(users.filter(u => u.uniqueId !== uniqueId));
            logActivity(`Simulated remove for user: ${email}`);
        }
    };


    return (
         <div id="content" className="content-panel">
            <div className="add-user-form-container">
                <h4>Add New User</h4>
                <form onSubmit={handleAddUser} className="add-user-form">
                    <input type="email" placeholder="Email Address" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} required />
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="add-btn">Add User</button>
                </form>
                 <p className="form-note">Note: This is a frontend simulation. Adding/removing users here will not update your Google Sheet.</p>
            </div>
            {loading ? <p>Loading users from Google Sheets...</p> : 
             error ? <p className="error-message">{error}</p> : (
                <table className="data-table">
                    <thead>
                    <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.uniqueId}>
                                <td>{u.email}</td>
                                <td className="text-center">
                                    <span className={`role-badge role-${u.role.toLowerCase().replace(/\s+/g, '-')}`}>{u.role}</span>
                                </td>
                                <td>{u.status || 'Active'}</td>
                                <td className="text-center">
                                    <button onClick={() => handleRemoveUser(u.uniqueId, u.email)} className="remove-btn">Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

const AnalyticsDashboard = () => {
    return (
        <div className="content-panel">
            <div className="analytics-grid">
                <div className="stat-card">
                    <h4>Total Users</h4>
                    <p className="stat-number">1,254</p>
                </div>
                <div className="stat-card">
                    <h4>Active Incidents</h4>
                    <p className="stat-number">32</p>
                </div>
                <div className="stat-card">
                    <h4>Reports Today</h4>
                    <p className="stat-number">112</p>
                </div>
                <div className="stat-card">
                    <h4>AI Queries</h4>
                    <p className="stat-number">486</p>
                </div>
            </div>
            <div className="chart-placeholder">
                <p>User Activity Over Time (Chart)</p>
            </div>
            <div className="chart-placeholder">
                 <p>Incident Reports by Type (Chart)</p>
            </div>
        </div>
    );
};

const ActivityLogDashboard = ({ logs }) => {
    return (
        <div className="content-panel">
            <div className="activity-log-container">
                {logs.length === 0 ? <p>No activity recorded in this session yet.</p> : 
                    logs.map(log => (
                        <div key={log.id} className="log-entry">
                            <span className="log-timestamp">{log.timestamp}</span>
                            <p className="log-message">{log.message}</p>
                        </div>
                    ))
                }
            </div>
        </div>
    );
};

const RoutePlanner = ({ roadData, logActivity }) => {
    const [startPoint, setStartPoint] = useState('');
    const [endPoint, setEndPoint] = useState('');
    const [route, setRoute] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const findRoute = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startPoint.trim() || !endPoint.trim()) {
            setError("Please enter both a start and end location.");
            return;
        }

        setLoading(true);
        setError('');
        setRoute('');
        logActivity(`Route requested from ${startPoint} to ${endPoint}`);
        
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are a helpful route planning assistant for Nepal. Your primary goal is to provide a clear, step-by-step driving route from a starting point to a destination.

You MUST use the provided real-time road and bridge data to inform your route. If any part of the suggested route is affected by a known issue (like 'blocked' or 'one-lane'), you MUST explicitly warn the user about it in your response.

**User Request:**
Start: ${startPoint}
End: ${endPoint}

**Real-time Road & Bridge Data:**
${JSON.stringify(roadData, null, 2)}

Provide the route as a clear, step-by-step list. If you identify any issues on the route from the data, add a "Warning" section. Do not use any external knowledge. If you cannot determine a route, say so.`;

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            });

            setRoute(response.text);
            logActivity(`Route successfully generated.`);

        } catch (err) {
            console.error("Gemini API error in Route Planner:", err);
            setError("Sorry, the AI route planner encountered an error. Please try again.");
            logActivity(`Route generation failed.`);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div className="content-panel route-planner-container">
            <form onSubmit={findRoute} className="route-planner-form">
                <div className="route-inputs">
                    <input type="text" value={startPoint} onChange={e => setStartPoint(e.target.value)} placeholder="Enter start location" />
                    <input type="text" value={endPoint} onChange={e => setEndPoint(e.target.value)} placeholder="Enter end location" />
                </div>
                <button type="submit" className="find-route-btn" disabled={loading}>
                    {loading ? 'Finding...' : 'Find Route'}
                </button>
            </form>

            {error && <p className="error-message">{error}</p>}
            
            <div className="route-results">
                {loading && (
                    <div className="loading-spinner">
                        <div></div><div></div><div></div><div></div>
                    </div>
                )}
                {route && (
                    <div className="route-output" dangerouslySetInnerHTML={{ __html: route.replace(/\n/g, '<br />') }}></div>
                )}
            </div>
        </div>
    );
};


const DashboardPage = ({ role, logActivity, activityLog, isChatEnabled, activeView }) => {
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            logActivity("Fetching road and bridge data...");
            const response = await GoogleSheetAPI.getRoadAndBridgeData();
            if (response.success) {
                setAllData(response.data);
                setFilteredData(response.data);
                logActivity("Successfully fetched road and bridge data.");
            } else {
                setError(response.error);
                logActivity(`Error fetching road/bridge data: ${response.error}`);
            }
            setLoading(false);
        };
        fetchData();
    }, [logActivity]);
    
    useEffect(() => {
        let data = allData;
        if (statusFilter !== 'all') {
            data = data.filter(r => r.Status && r.Status.toLowerCase().replace(/ /g, '-') === statusFilter);
        }
        if (searchTerm) {
            data = data.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        setFilteredData(data);
    }, [searchTerm, statusFilter, allData]);
    
    const viewTitles = {
      'dashboard': 'Road/Bridge Status',
      'users': 'User Management',
      'analytics': 'Analytics',
      'logs': 'Activity Log',
      'route-planner': 'AI Route Planner',
    };

    const renderContent = () => {
        switch(activeView) {
            case 'dashboard':
                return <RoadStatusDashboard 
                    filteredData={filteredData}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    loading={loading}
                    error={error}
                />;
            case 'users': return role === 'superadmin' ? <UserManagementDashboard logActivity={logActivity}/> : null;
            case 'analytics': return role === 'superadmin' ? <AnalyticsDashboard /> : null;
            case 'logs': return role === 'superadmin' ? <ActivityLogDashboard logs={activityLog} /> : null;
            case 'route-planner': return <RoutePlanner roadData={allData} logActivity={logActivity} />;
            default: return null;
        }
    };

    return (
        <main className="main-content dashboard">
             <div className="page-header">
                <h2 className="page-title">{viewTitles[activeView] || 'Dashboard'}</h2>
                <div className="page-actions">
                    <button className="action-btn print-btn">Print</button>
                    <button className="action-btn share-btn">Share</button>
                </div>
            </div>
             
             {renderContent()}

            <Chatbot roadData={allData} isEnabled={isChatEnabled} />
        </main>
    );
};

const Sidebar = ({ isOpen, setIsOpen, activeView, setActiveView, onLogout, userEmail, role, onSettingsClick }) => {
  const superAdminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'route-planner', label: 'Route Planner', icon: <RouteIcon /> },
    { id: 'users', label: 'Users', icon: <UsersIcon /> },
    { id: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
    { id: 'logs', label: 'Activity Log', icon: <LogIcon /> },
  ];

  // Modify this array to easily add/remove features
  const getNavItemsForRole = (role) => {
    switch(role) {
      case 'superadmin':
        return superAdminNavItems;
      case 'admin':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
        ];
      case 'user':
      default:
        return [
          { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
          { id: 'route-planner', label: 'Route Planner', icon: <RouteIcon /> },
        ];
    }
  };
  
  const navItems = getNavItemsForRole(role);

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
         {isOpen && <span className="logo-text">Sadak Sathi</span>}
         <button className="sidebar-toggle" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle sidebar">
            <ChevronLeftIcon />
         </button>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <a
            key={item.id}
            href="#"
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setActiveView(item.id); }}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-text">{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-info">
            <span className="user-email-text">{userEmail}</span>
            <span className="user-role-text">{role}</span>
          </div>
          {(role === 'admin' || role === 'superadmin') && (
            <button className="footer-btn" onClick={onSettingsClick} title="Settings">
              <SettingsIcon />
            </button>
          )}
          <button className="footer-btn" onClick={onLogout} title="Logout">
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
};


const App = ({ role, userEmail, onLogout }) => {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [settings, setSettings] = useState({
      backgroundColor: '#F3F4F6',
      primaryColor: '#3B82F6',
      textColor: '#1F2937',
      isChatEnabled: true
  });
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  
  const logActivity = (message: string) => {
    const newLog: ActivityLog = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message: message
    };
    setActivityLog(prev => [newLog, ...prev]);
  };

  useEffect(() => {
    logActivity(`User ${userEmail} logged in with role: ${role}.`);
  }, [userEmail, role]);

  // Apply dynamic styles
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--background-color', settings.backgroundColor);
    root.style.setProperty('--primary-color', settings.primaryColor);
    root.style.setProperty('--text-color', settings.textColor);
    logActivity(`UI theme updated.`);
  }, [settings.backgroundColor, settings.primaryColor, settings.textColor]);

  return (
    <div className="app-layout">
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        role={role}
        settings={settings}
        setSettings={setSettings}
        onLogout={onLogout}
        userEmail={userEmail}
        logActivity={logActivity}
      />

      <Sidebar 
          isOpen={isSidebarOpen}
          setIsOpen={setSidebarOpen}
          activeView={activeView}
          setActiveView={setActiveView}
          onLogout={onLogout}
          userEmail={userEmail}
          role={role}
          onSettingsClick={() => setSettingsOpen(true)}
      />
      
      <div className="content-wrapper">
         <DashboardPage 
            role={role} 
            isChatEnabled={settings.isChatEnabled} 
            logActivity={logActivity} 
            activityLog={activityLog} 
            activeView={activeView}
         />
      </div>
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
                  <label htmlFor="confirm-password">Confirm New Password</label>
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
