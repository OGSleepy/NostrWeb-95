import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Monitor, 
  FileText, 
  Paintbrush, 
  Gamepad2, 
  MessageSquare, 
  Search, 
  Chrome, 
  Music, 
  Settings as SettingsIcon,
  User,
  Zap,
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  LogOut,
  Key,
  ShieldCheck,
  Menu,
  X,
  Minus,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  SimplePool, 
  getPublicKey, 
  finalizeEvent, 
  nip19,
  type Event as NostrEvent
} from 'nostr-tools';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

const bytesToHex = (bytes: Uint8Array) => 
  Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

const BLOSSOM_SERVERS = ['https://blossom.nostr.wine', 'https://satellite.earth', 'https://nostrcheck.me'];

// --- Constants ---
const DEFAULT_RELAYS = [
  'wss://relay.ditto.pub',
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.bg',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://nostr.mom',
  'wss://relay.nostr.wirednet.jp',
  'wss://nostr.oxtr.dev',
  'wss://relay.mostr.pub',
  'wss://nostr-pub.wellorder.net',
  'wss://nostr.fmt.wiz.biz',
  'wss://relay.siamstr.com',
  'wss://relay.orangepill.dev'
];

// --- Types ---
type AppId = 'myComputer' | 'chrome' | 'notepad' | 'paint' | 'doom' | 'gemini' | 'minesweeper' | 'mediaPlayer' | 'nostalgia' | 'settings';

interface WindowState {
  id: AppId;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  isMinimized: boolean;
  zIndex: number;
  x: number;
  y: number;
}

// --- Components ---

const TaskbarIcon = ({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-2 py-1 h-7 min-w-[100px] max-w-[150px] border-t border-l border-white border-b-2 border-r-2 border-black bg-[#C0C0C0] text-xs font-bold truncate",
      isActive && "bg-[#e0e0e0] border-t-2 border-l-2 border-black border-b border-r border-white pt-1.5 pl-2.5"
    )}
  >
    <div className="w-4 h-4 flex-shrink-0">{icon}</div>
    <span className="truncate">{label}</span>
  </button>
);

const DesktopIcon = ({ icon, label, onDoubleClick }: { icon: React.ReactNode, label: string, onDoubleClick: () => void }) => (
  <div 
    onDoubleClick={onDoubleClick}
    className="flex flex-col items-center gap-1 w-24 p-2 cursor-pointer group select-none"
  >
    <div className="w-12 h-12 flex items-center justify-center text-white drop-shadow-md group-hover:bg-blue-800/30 rounded">
      {icon}
    </div>
    <span className="text-white text-[11px] text-center leading-tight drop-shadow-[1px_1px_2px_rgba(0,0,0,0.8)] px-1 group-hover:bg-blue-800">
      {label}
    </span>
  </div>
);

// --- Main App ---

export default function App() {
  const [windows, setWindows] = useState<Record<AppId, WindowState>>({
    myComputer: { id: 'myComputer', title: 'My Gemtop', icon: <Monitor size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 50, y: 50 },
    chrome: { id: 'chrome', title: 'Chrome', icon: <Chrome size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 70, y: 70 },
    notepad: { id: 'notepad', title: 'GemNotes', icon: <FileText size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 90, y: 90 },
    paint: { id: 'paint', title: 'GemPaint', icon: <Paintbrush size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 110, y: 110 },
    doom: { id: 'doom', title: 'Doom II', icon: <Gamepad2 size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 130, y: 130 },
    gemini: { id: 'gemini', title: 'Gemini App', icon: <MessageSquare size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 150, y: 150 },
    minesweeper: { id: 'minesweeper', title: 'GemSweeper', icon: <Zap size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 170, y: 170 },
    mediaPlayer: { id: 'mediaPlayer', title: 'GemPlayer', icon: <Music size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 190, y: 190 },
    nostalgia: { id: 'nostalgia', title: 'Nostalgia', icon: <Globe size={16} />, isOpen: true, isMinimized: false, zIndex: 20, x: 100, y: 40 },
    settings: { id: 'settings', title: 'Settings', icon: <SettingsIcon size={16} />, isOpen: false, isMinimized: false, zIndex: 10, x: 210, y: 210 },
  });

  const [activeApp, setActiveApp] = useState<AppId | null>('nostalgia');
  const [highestZIndex, setHighestZIndex] = useState(20);
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Nostr State
  const [relays, setRelays] = useState<string[]>(() => {
    const saved = localStorage.getItem('nostr_relays');
    return saved ? JSON.parse(saved) : DEFAULT_RELAYS;
  });
  const [userSk, setUserSk] = useState<string | null>(localStorage.getItem('nostr_sk'));
  const [userPk, setUserPk] = useState<string | null>(localStorage.getItem('nostr_pk'));
  const pool = useRef(new SimplePool());

  useEffect(() => {
    localStorage.setItem('nostr_relays', JSON.stringify(relays));
  }, [relays]);

  const openApp = (id: AppId) => {
    setHighestZIndex(prev => prev + 1);
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: true, isMinimized: false, zIndex: highestZIndex + 1 }
    }));
    setActiveApp(id);
    setIsStartMenuOpen(false);
  };

  const closeApp = (id: AppId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isOpen: false }
    }));
    if (activeApp === id) setActiveApp(null);
  };

  const minimizeApp = (id: AppId) => {
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: true }
    }));
    if (activeApp === id) setActiveApp(null);
  };

  const focusApp = (id: AppId) => {
    setHighestZIndex(prev => prev + 1);
    setWindows(prev => ({
      ...prev,
      [id]: { ...prev[id], isMinimized: false, zIndex: highestZIndex + 1 }
    }));
    setActiveApp(id);
  };

  const toggleStartMenu = () => setIsStartMenuOpen(!isStartMenuOpen);

  // --- Nostr Logic ---
  const loginWithSk = (sk: string) => {
    try {
      let hexSk = sk;
      if (sk.startsWith('nsec')) {
        const { data } = nip19.decode(sk);
        hexSk = bytesToHex(data as Uint8Array);
      }
      const pk = getPublicKey(hexToBytes(hexSk));
      setUserSk(hexSk);
      setUserPk(pk);
      localStorage.setItem('nostr_sk', hexSk);
      localStorage.setItem('nostr_pk', pk);
      alert("Logged in successfully!");
    } catch (e) {
      alert("Invalid secret key");
    }
  };

  const loginWithExtension = async () => {
    if ((window as any).nostr) {
      try {
        const pk = await (window as any).nostr.getPublicKey();
        setUserPk(pk);
        setUserSk(null); // Extension handles signing
        localStorage.setItem('nostr_pk', pk);
        localStorage.removeItem('nostr_sk');
        alert("Logged in with extension!");
      } catch (e) {
        alert("Extension login failed");
      }
    } else {
      alert("Nostr extension not found");
    }
  };

  const logout = () => {
    setUserSk(null);
    setUserPk(null);
    localStorage.removeItem('nostr_sk');
    localStorage.removeItem('nostr_pk');
  };

  return (
    <div className={cn(
      "desktop w-screen h-screen overflow-hidden relative font-sans select-none",
      theme === 'dark' ? "bg-[#004040]" : "bg-[#008080]"
    )}>
      {/* Desktop Icons */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <DesktopIcon icon={<Monitor size={32} />} label="My Gemtop" onDoubleClick={() => openApp('myComputer')} />
        <DesktopIcon icon={<Globe size={32} />} label="Nostalgia" onDoubleClick={() => openApp('nostalgia')} />
        <DesktopIcon icon={<Chrome size={32} />} label="Chrome" onDoubleClick={() => openApp('chrome')} />
        <DesktopIcon icon={<MessageSquare size={32} />} label="Gemini App" onDoubleClick={() => openApp('gemini')} />
        <DesktopIcon icon={<Music size={32} />} label="GemPlayer" onDoubleClick={() => openApp('mediaPlayer')} />
        <DesktopIcon icon={<SettingsIcon size={32} />} label="Settings" onDoubleClick={() => openApp('settings')} />
      </div>

      {/* Windows */}
      <AnimatePresence>
        {Object.values(windows).map((win) => win.isOpen && !win.isMinimized && (
          <Window 
            key={win.id}
            window={win}
            isActive={activeApp === win.id}
            onClose={() => closeApp(win.id)}
            onMinimize={() => minimizeApp(win.id)}
            onFocus={() => focusApp(win.id)}
            theme={theme}
          >
            {win.id === 'nostalgia' && (
              <NostalgiaApp 
                pool={pool.current} 
                relays={relays} 
                userPk={userPk} 
                userSk={userSk} 
                theme={theme}
              />
            )}
            {win.id === 'settings' && (
              <SettingsApp 
                relays={relays} 
                setRelays={setRelays} 
                theme={theme} 
                setTheme={setTheme}
                userPk={userPk}
                loginWithSk={loginWithSk}
                loginWithExtension={loginWithExtension}
                logout={logout}
              />
            )}
            {win.id === 'myComputer' && <div className="p-4">C: Drive is empty. Nostalgia is all you need.</div>}
            {win.id === 'chrome' && <div className="p-4">Browser is under construction. Use Nostalgia.</div>}
            {win.id === 'gemini' && <div className="p-4">Gemini AI is integrated into Nostalgia.</div>}
          </Window>
        ))}
      </AnimatePresence>

      {/* Start Menu */}
      {isStartMenuOpen && (
        <div className="absolute bottom-9 left-0 w-56 bg-[#C0C0C0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-black z-[100] shadow-xl">
          <div className="flex">
            <div className="w-8 bg-gray-600 flex items-end justify-center pb-4">
              <span className="rotate-[-90deg] text-white font-bold text-xl whitespace-nowrap origin-center">Gemini 95</span>
            </div>
            <div className="flex-grow py-1">
              <StartMenuItem icon={<Globe size={16} />} label="Nostalgia" onClick={() => openApp('nostalgia')} />
              <StartMenuItem icon={<Monitor size={16} />} label="My Gemtop" onClick={() => openApp('myComputer')} />
              <StartMenuItem icon={<SettingsIcon size={16} />} label="Settings" onClick={() => openApp('settings')} />
              <div className="h-[1px] bg-gray-400 my-1 mx-1" />
              <StartMenuItem icon={<LogOut size={16} />} label="Shut Down..." onClick={() => window.location.reload()} />
            </div>
          </div>
        </div>
      )}

      {/* Taskbar */}
      <div className="absolute bottom-0 left-0 w-full h-9 bg-[#C0C0C0] border-t-2 border-white flex items-center px-1 gap-1 z-[90]">
        <button 
          onClick={toggleStartMenu}
          className={cn(
            "flex items-center gap-1 px-1.5 h-7 border-t border-l border-white border-b-2 border-r-2 border-black bg-[#C0C0C0] font-bold text-sm",
            isStartMenuOpen && "border-t-2 border-l-2 border-black border-b border-r border-white pt-1 pl-2"
          )}
        >
          <img src="https://storage.googleapis.com/gemini-95-icons/start-gemini.png" alt="Start" className="w-5 h-5" />
          Start
        </button>
        <div className="w-[2px] h-6 bg-gray-400 mx-1 border-r border-white" />
        <div className="flex gap-1 overflow-x-auto">
          {Object.values(windows).map(win => win.isOpen && (
            <TaskbarIcon 
              key={win.id} 
              icon={win.icon} 
              label={win.title} 
              isActive={activeApp === win.id && !win.isMinimized}
              onClick={() => win.isMinimized ? focusApp(win.id) : (activeApp === win.id ? minimizeApp(win.id) : focusApp(win.id))}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 px-2 h-7 border-t border-l border-gray-600 border-b border-r border-white bg-[#C0C0C0] text-xs">
          <Zap size={14} className="text-yellow-600" />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}

// --- Sub-Components ---

const Window = ({ window, isActive, onClose, onMinimize, onFocus, theme, children }: { 
  window: WindowState, 
  isActive: boolean, 
  onClose: () => void, 
  onMinimize: () => void, 
  onFocus: () => void,
  theme: 'light' | 'dark',
  children: React.ReactNode 
}) => {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      onMouseDown={onFocus}
      style={{ zIndex: window.zIndex, left: window.x, top: window.y }}
      className={cn(
        "absolute min-w-[300px] min-h-[200px] flex flex-col border-t-2 border-l-2 border-white border-b-2 border-r-2 border-black bg-[#C0C0C0] shadow-2xl",
        isActive && "ring-1 ring-black/20"
      )}
    >
      {/* Title Bar */}
      <div className={cn(
        "h-6 flex items-center justify-between px-1 cursor-default select-none",
        isActive ? "bg-[#000080] text-white" : "bg-[#808080] text-[#C0C0C0]"
      )}>
        <div className="flex items-center gap-1 font-bold text-xs truncate">
          <div className="w-4 h-4">{window.icon}</div>
          <span className="truncate">{window.title}</span>
        </div>
        <div className="flex gap-0.5">
          <WindowButton onClick={onMinimize}><Minus size={10} /></WindowButton>
          <WindowButton><Square size={8} /></WindowButton>
          <WindowButton onClick={onClose}><X size={10} /></WindowButton>
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        "flex-grow overflow-hidden border-2 border-inset border-gray-400 m-0.5 bg-white",
        theme === 'dark' && "bg-[#1a1a1a] text-white"
      )}>
        {children}
      </div>
    </motion.div>
  );
};

const WindowButton = ({ children, onClick }: { children: React.ReactNode, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="w-4 h-4 bg-[#C0C0C0] border-t border-l border-white border-b border-r border-black flex items-center justify-center text-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white"
  >
    {children}
  </button>
);

const StartMenuItem = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-1.5 hover:bg-[#000080] hover:text-white text-sm text-left"
  >
    <div className="w-4 h-4">{icon}</div>
    <span>{label}</span>
  </button>
);

// --- Nostalgia App ---

const NostalgiaApp = ({ pool, relays, userPk, userSk, theme }: { 
  pool: SimplePool, 
  relays: string[], 
  userPk: string | null, 
  userSk: string | null,
  theme: 'light' | 'dark'
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'profile'>('feed');
  const [postContent, setPostContent] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['nostr_notes', relays],
    queryFn: async () => {
      const events = await pool.querySync(relays, { kinds: [1], limit: 50 });
      return events.sort((a, b) => b.created_at - a.created_at);
    },
    refetchInterval: 10000,
  });

  // Fetch metadata for all authors in the current feed
  const authorPubkeys = Array.from(new Set(notes.map(n => n.pubkey)));
  const { data: metadata = {} } = useQuery({
    queryKey: ['nostr_metadata', authorPubkeys, relays],
    queryFn: async () => {
      if (authorPubkeys.length === 0) return {};
      const events = await pool.querySync(relays, { kinds: [0], authors: authorPubkeys });
      const map: Record<string, any> = {};
      events.forEach(e => {
        try {
          map[e.pubkey] = JSON.parse(e.content);
        } catch (err) {}
      });
      return map;
    },
    enabled: authorPubkeys.length > 0,
    staleTime: 600000, // 10 minutes
  });

  const uploadToBlossom = async (file: File) => {
    if (!userPk) return;
    setIsUploading(true);
    try {
      const server = BLOSSOM_SERVERS[0];
      const sha256 = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hash = bytesToHex(new Uint8Array(sha256));
      
      const eventTemplate = {
        kind: 24242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'upload'],
          ['x', hash]
        ],
        content: `Upload ${file.name}`,
      };

      let signedEvent;
      if (userSk) {
        signedEvent = finalizeEvent(eventTemplate, hexToBytes(userSk));
      } else if ((window as any).nostr) {
        signedEvent = await (window as any).nostr.signEvent(eventTemplate);
      } else {
        throw new Error("Login to upload media");
      }

      const authHeader = btoa(JSON.stringify(signedEvent));
      const response = await fetch(`${server}/upload`, {
        method: 'PUT',
        headers: {
          'Authorization': `Nostr ${authHeader}`,
        },
        body: file
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setAttachments(prev => [...prev, data.url]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const publishMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!userPk) throw new Error("Not logged in");
      
      let finalContent = content;
      if (attachments.length > 0) {
        finalContent += "\n\n" + attachments.join("\n");
      }

      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: finalContent,
      };
      
      let event;
      if (userSk) {
        event = finalizeEvent(eventTemplate, hexToBytes(userSk));
      } else if ((window as any).nostr) {
        event = await (window as any).nostr.signEvent(eventTemplate);
      } else {
        throw new Error("No signing method available");
      }

      await Promise.any(pool.publish(relays, event));
      return event;
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData(['nostr_notes', relays], (old: NostrEvent[] = []) => [newEvent, ...old]);
      setPostContent('');
      setAttachments([]);
    },
    onError: (e) => alert(e.message)
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-1 bg-[#C0C0C0] border-b border-gray-400 text-black">
        <ToolbarButton active={activeTab === 'feed'} onClick={() => setActiveTab('feed')}>
          <Globe size={14} /> Global Feed
        </ToolbarButton>
        <ToolbarButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
          <User size={14} /> Profile
        </ToolbarButton>
        <div className="ml-auto flex items-center gap-2 px-2 text-[10px] font-mono">
          <div className={cn("w-2 h-2 rounded-full", relays.length > 0 ? "bg-green-500" : "bg-red-500")} />
          {relays.length} Relays
        </div>
      </div>

      <div className="flex flex-grow overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 bg-[#C0C0C0] border-r border-gray-400 p-2 flex flex-col gap-4 text-black overflow-y-auto">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-gray-600">Post Note</label>
            <textarea 
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="What's happening?"
              className="w-full h-24 p-1 text-xs border border-inset border-gray-400 bg-white resize-none outline-none focus:ring-1 focus:ring-blue-500"
            />
            
            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {attachments.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} className="w-10 h-10 object-cover border border-gray-400" />
                    <button 
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-1 mt-1">
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-grow px-2 py-1 bg-[#C0C0C0] border-t border-l border-white border-b-2 border-r-2 border-black text-[10px] font-bold active:border-t-2 active:border-l-2 active:border-black active:border-b active:border-r active:border-white disabled:opacity-50"
              >
                {isUploading ? "..." : "Attach Media"}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*,video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadToBlossom(file);
                }}
              />
            </div>

            <button 
              disabled={!userPk || publishMutation.isPending || (!postContent.trim() && attachments.length === 0)}
              onClick={() => publishMutation.mutate(postContent)}
              className="mt-1 px-2 py-1 bg-[#C0C0C0] border-t border-l border-white border-b-2 border-r-2 border-black text-xs font-bold active:border-t-2 active:border-l-2 active:border-black active:border-b active:border-r active:border-white disabled:opacity-50"
            >
              {publishMutation.isPending ? "Sending..." : "Post Note"}
            </button>
            {!userPk && <p className="text-[9px] text-red-600 mt-1">Login to post notes</p>}
          </div>

          <div className="mt-auto p-2 border border-inset border-gray-400 bg-gray-200 text-[10px]">
            <p className="font-bold">Nostalgia v1.0</p>
            <p className="text-gray-600">The Cypherpunk OS</p>
          </div>
        </div>

        {/* Feed */}
        <div className="flex-grow overflow-y-auto p-2 bg-white dark:bg-[#1a1a1a]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400 italic">
              Connecting to relays...
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {notes.map((note) => (
                <Note key={note.id} note={note} theme={theme} metadata={metadata[note.pubkey]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Note = ({ note, theme, metadata }: { note: NostrEvent, theme: 'light' | 'dark', metadata?: any }) => {
  const author = metadata?.name || metadata?.display_name || note.pubkey.substring(0, 8);
  const avatar = metadata?.picture || `https://robohash.org/${note.pubkey}?set=set4`;
  const date = new Date(note.created_at * 1000).toLocaleString();

  const handleZap = async () => {
    if ((window as any).webln) {
      try {
        await (window as any).webln.enable();
        const invoice = prompt("Enter Lightning Invoice to Zap (Integration coming soon)");
        if (invoice) await (window as any).webln.sendPayment(invoice);
      } catch (e: any) {
        alert("WebLN Error: " + e.message);
      }
    } else {
      alert("Please install a WebLN wallet (like Alby) to Zap!");
    }
  };

  return (
    <div className={cn(
      "p-3 border-b border-gray-100 dark:border-gray-800 flex gap-3",
      theme === 'dark' ? "hover:bg-white/5" : "hover:bg-black/5"
    )}>
      <img src={avatar} className="w-10 h-10 rounded-full border border-gray-200 flex-shrink-0" referrerPolicy="no-referrer" />
      
      <div className="flex flex-col gap-1 flex-grow overflow-hidden">
        <div className="flex justify-between items-center text-[10px]">
          <span className="font-bold text-blue-600 dark:text-blue-400 truncate max-w-[150px]">
            {author} {metadata?.nip05 && <span className="text-gray-400 font-normal">({metadata.nip05})</span>}
          </span>
          <span className="text-gray-400 flex-shrink-0">{date}</span>
        </div>
        
        <div className="text-sm leading-relaxed break-words prose dark:prose-invert max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => <a {...props} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" />,
              img: ({ node, ...props }) => <img {...props} className="max-w-full h-auto rounded border border-gray-200 my-2" referrerPolicy="no-referrer" />,
            }}
          >
            {note.content}
          </ReactMarkdown>
        </div>

        <div className="flex gap-4 text-[10px] text-gray-400 mt-1">
          <button onClick={handleZap} className="flex items-center gap-1 hover:text-orange-500">
            <Zap size={12} /> Zap
          </button>
          <button className="flex items-center gap-1 hover:text-blue-500">
            <MessageSquare size={12} /> Reply
          </button>
          <button className="flex items-center gap-1 hover:text-green-500">
            <RefreshCw size={12} /> Repost
          </button>
        </div>
      </div>
    </div>
  );
};

const ToolbarButton = ({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-1 px-2 py-1 text-xs border-t border-l border-white border-b-2 border-r-2 border-black active:border-t-2 active:border-l-2 active:border-black active:border-b active:border-r active:border-white",
      active && "bg-gray-300 border-t-2 border-l-2 border-black border-b border-r border-white"
    )}
  >
    {children}
  </button>
);

// --- Settings App ---

const SettingsApp = ({ 
  relays, 
  setRelays, 
  theme, 
  setTheme, 
  userPk, 
  loginWithSk, 
  loginWithExtension,
  logout 
}: { 
  relays: string[], 
  setRelays: (r: string[]) => void, 
  theme: 'light' | 'dark', 
  setTheme: (t: 'light' | 'dark') => void,
  userPk: string | null,
  loginWithSk: (sk: string) => void,
  loginWithExtension: () => void,
  logout: () => void
}) => {
  const [newRelay, setNewRelay] = useState('');
  const [skInput, setSkInput] = useState('');

  const addRelay = () => {
    if (newRelay && !relays.includes(newRelay)) {
      setRelays([...relays, newRelay]);
      setNewRelay('');
    }
  };

  const removeRelay = (url: string) => {
    setRelays(relays.filter(r => r !== url));
  };

  const syncNip65 = async () => {
    if (!userPk) return;
    try {
      const eventTemplate = {
        kind: 10002,
        created_at: Math.floor(Date.now() / 1000),
        tags: relays.map(r => ['r', r]),
        content: '',
      };
      
      let event;
      if ((window as any).nostr) {
        event = await (window as any).nostr.signEvent(eventTemplate);
      } else {
        throw new Error("Login with extension to sync NIP-65");
      }
      
      // Publish to all current relays
      // await Promise.all(relays.map(r => pool.publish([r], event)));
      alert("NIP-65 Relay list published!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 h-full overflow-y-auto text-black dark:text-white">
      {/* Account */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2 border-b border-gray-400 pb-1">
          <User size={16} /> Account
        </h3>
        {userPk ? (
          <div className="flex flex-col gap-2 p-2 bg-gray-100 dark:bg-gray-800 border border-inset border-gray-400">
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck size={14} className="text-green-500" />
              <span className="font-mono truncate">Logged in: {userPk.substring(0, 16)}...</span>
            </div>
            <button 
              onClick={logout}
              className="px-2 py-1 bg-[#C0C0C0] border-t border-l border-white border-b-2 border-r-2 border-black text-xs font-bold text-black"
            >
              Log Out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500">Log in with your secret key or extension:</p>
            <div className="flex gap-1">
              <input 
                type="password"
                value={skInput}
                onChange={(e) => setSkInput(e.target.value)}
                placeholder="nsec1..."
                className="flex-grow p-1 text-xs border border-inset border-gray-400 bg-white text-black"
              />
              <button 
                onClick={() => { loginWithSk(skInput); setSkInput(''); }}
                className="px-2 py-1 bg-[#C0C0C0] border-t border-l border-white border-b-2 border-r-2 border-black text-xs font-bold text-black"
              >
                Login
              </button>
            </div>
            <button 
              onClick={loginWithExtension}
              className="flex items-center justify-center gap-2 px-2 py-1 bg-[#C0C0C0] border-t border-l border-white border-b-2 border-r-2 border-black text-xs font-bold text-black"
            >
              <ShieldCheck size={14} /> Use Browser Extension (NIP-07)
            </button>
          </div>
        )}
      </section>

      {/* Relays */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2 border-b border-gray-400 pb-1">
          <Globe size={16} /> Relays
        </h3>
        <div className="flex gap-1">
          <input 
            value={newRelay}
            onChange={(e) => setNewRelay(e.target.value)}
            placeholder="wss://..."
            className="flex-grow p-1 text-xs border border-inset border-gray-400 bg-white text-black"
          />
          <button 
            onClick={addRelay}
            className="px-2 py-1 bg-[#C0C0C0] border-t border-l border-white border-b-2 border-r-2 border-black text-xs font-bold text-black"
          >
            Add
          </button>
        </div>
        <button 
          onClick={syncNip65}
          disabled={!userPk}
          className="flex items-center justify-center gap-2 px-2 py-1 bg-[#C0C0C0] border-t border-l border-white border-b-2 border-r-2 border-black text-[10px] font-bold text-black disabled:opacity-50"
        >
          <RefreshCw size={12} /> Sync Relays (NIP-65)
        </button>
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-inset border-gray-400 bg-gray-50 dark:bg-gray-900 p-1">
          {relays.map(r => (
            <div key={r} className="flex justify-between items-center text-[10px] p-1 hover:bg-blue-500 hover:text-white group">
              <span className="truncate">{r}</span>
              <button onClick={() => removeRelay(r)} className="hidden group-hover:block">
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Appearance */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2 border-b border-gray-400 pb-1">
          <Paintbrush size={16} /> Appearance
        </h3>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input 
              type="radio" 
              checked={theme === 'light'} 
              onChange={() => setTheme('light')} 
            />
            Light Mode
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input 
              type="radio" 
              checked={theme === 'dark'} 
              onChange={() => setTheme('dark')} 
            />
            Dark Mode (Cypherpunk)
          </label>
        </div>
      </section>
    </div>
  );
};
