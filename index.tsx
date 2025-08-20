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
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch sheet with GID: ${gid}`);
        }
        return response.text();
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
          <h4>AI Features</h4>
          <div className="toggle-switch">
              <input
                  type="checkbox"
                  id="chat-toggle"
                  checked={settings.isChatEnabled}
                  onChange={e => setSettings({ ...settings, isChatEnabled: e.target.checked })}
              />
              <label htmlFor="chat-toggle" className="slider"></label>
              <span className="toggle-label">Enable AI Chat Assistant</span>
          </div>
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

const RoadStatusDashboard = ({ allData, filteredData, searchTerm, setSearchTerm, statusFilter, setStatusFilter, loading, error }) => {
    return (
        <>
            <div className="mb-4">
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by name..." className="p-2 border rounded w-full"/>
            </div>
            <div className="mb-4 flex gap-2">
                <button onClick={() => setStatusFilter('blocked')} className={`filterBtn p-2 rounded ${statusFilter === 'blocked' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>Blocked</button>
                <button onClick={() => setStatusFilter('one-lane')} className={`filterBtn p-2 rounded ${statusFilter === 'one-lane' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>One-lane</button>
                <button onClick={() => setStatusFilter('resumed')} className={`filterBtn p-2 rounded ${statusFilter === 'resumed' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>Resumed</button>
                <button onClick={() => setStatusFilter('all')} className={`filterBtn p-2 rounded ${statusFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}>All</button>
            </div>
            <div id="content" className="border p-4 rounded bg-white dark:bg-gray-900">
                {loading ? <p>Loading live data from Google Sheets...</p> : 
                 error ? <p className="error-message">{error}</p> : (
                    <table className="w-full table-auto border-collapse border">
                        <thead>
                        <tr className="bg-gray-200 dark:bg-gray-700">
                            <th className="border p-2">Type</th>
                            <th className="border p-2">Name</th>
                            <th className="border p-2">Section / Location</th>
                            <th className="border p-2">Status</th>
                            <th className="border p-2">Cause</th>
                            <th className="border p-2">Contact</th>
                        </tr>
                        </thead>
                        <tbody>
                            {filteredData.map(r => (
                                <tr key={r.uniqueId}>
                                    <td className="border p-2 text-center">
                                      <span className={`type-badge type-${r.type.toLowerCase()}`}>{r.type}</span>
                                    </td>
                                    <td className="border p-2">{r.name}</td>
                                    <td className="border p-2">{r.location}</td>
                                    <td className="border p-2">{r.Status}</td>
                                    <td className="border p-2">{r.Cause}</td>
                                    <td className="border p-2">{r.Contact}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
};

const UserManagementDashboard = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            setError(null);
            const response = await GoogleSheetAPI.getAdminAndUserData();
            if (response.success) {
                setUsers(response.data);
            } else {
                setError(response.error);
            }
            setLoading(false);
        };
        fetchUsers();
    }, []);

    return (
         <div id="content" className="border p-4 rounded bg-white dark:bg-gray-900">
            {loading ? <p>Loading users from Google Sheets...</p> : 
             error ? <p className="error-message">{error}</p> : (
                <table className="w-full table-auto border-collapse border">
                    <thead>
                    <tr className="bg-gray-200 dark:bg-gray-700">
                        <th className="border p-2">Email</th>
                        <th className="border p-2">Role</th>
                        <th className="border p-2">Status</th>
                    </tr>
                    </thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.uniqueId}>
                                <td className="border p-2">{u.email}</td>
                                <td className="border p-2 text-center">
                                    <span className={`role-badge role-${u.role.toLowerCase().replace(/\s+/g, '-')}`}>{u.role}</span>
                                </td>
                                <td className="border p-2">{u.status || 'Active'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};


const DashboardPage = ({ role, isChatEnabled }) => {
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [activeTab, setActiveTab] = useState('status');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            const response = await GoogleSheetAPI.getRoadAndBridgeData();
            if (response.success) {
                setAllData(response.data);
                setFilteredData(response.data);
            } else {
                setError(response.error);
            }
            setLoading(false);
        };
        fetchData();
    }, []);
    
    useEffect(() => {
        let data = allData;
        if (statusFilter !== 'all') {
            data = data.filter(r => r.Status && r.Status.toLowerCase() === statusFilter);
        }
        if (searchTerm) {
            data = data.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        setFilteredData(data);
    }, [searchTerm, statusFilter, allData]);


    return (
        <main className="main-content dashboard">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Dashboard</h2>
                <div className="flex gap-2">
                    <button className="p-2 bg-green-500 text-white rounded">Print</button>
                    <button className="p-2 bg-yellow-500 text-white rounded">Share</button>
                </div>
            </div>
             
             {role === 'superadmin' && (
                <div className="dashboard-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
                        onClick={() => setActiveTab('status')}
                    >
                        Road/Bridge Status
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        User Management
                    </button>
                </div>
             )}

            {activeTab === 'status' && (
                <RoadStatusDashboard 
                    allData={allData}
                    filteredData={filteredData}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    loading={loading}
                    error={error}
                />
            )}
            
            {activeTab === 'users' && role === 'superadmin' && (
                <UserManagementDashboard />
            )}

            <Chatbot roadData={allData} isEnabled={isChatEnabled} />
        </main>
    );
};


const App = ({ role, userEmail, onLogout }) => {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
      backgroundColor: '#FFFFFF', // Changed default to white for dashboard
      apiKeys: [] as ApiKey[],
      sheetIds: [] as SheetId[],
      isChatEnabled: true
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

      <DashboardPage role={role} isChatEnabled={settings.isChatEnabled} />

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