import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CornerUpLeft,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Pencil,
  Phone,
  Search,
  Send,
  Trash2,
  User as UserIcon,
  Users,
  Video,
  X,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen.tsx';
import { Avatar, GroupAvatar } from './components/Avatar.tsx';
import { CallBubble } from './components/CallBubble.tsx';
import { CallOverlay, type ActiveCallSession } from './components/CallOverlay.tsx';
import { ContactProfileDrawer } from './components/ContactProfileDrawer.tsx';
import { CreateGroupModal } from './components/CreateGroupModal.tsx';
import {
  GroupCallOverlay,
  type ActiveGroupCallSession,
  type GroupPeerMedia,
} from './components/GroupCallOverlay.tsx';
import { GroupInfoDrawer } from './components/GroupInfoDrawer.tsx';
import { MyProfileModal } from './components/MyProfileModal.tsx';
import { OfflineBanner } from './components/OfflineBanner.tsx';
import { PWAInstallButton } from './components/PWAInstallButton.tsx';
import { VoicePlayer } from './components/VoicePlayer.tsx';
import { TRANSLATIONS, type Lang } from './i18n.ts';
import type {
  CallType,
  ChatSummary,
  GroupCallEventPayload,
  GroupCallSignalPayload,
  MessageRecord,
  PublicGroup,
  PublicGroupCallRoom,
  PublicUser,
  SignalEventPayload,
  TypingEventPayload,
} from './types.ts';
import {
  blobToDataUrl,
  formatDateLabel,
  formatLastMessagePreview,
  formatLastSeen,
  formatSystemMessage,
  formatTime,
  formatTimerMMSS,
  fullName,
  resizeChatImage,
  startRingtone,
} from './utils/format.ts';

const STORAGE_AUTH_KEY = 'freesim_auth_key';
const STORAGE_USER_CACHE = 'freesim_user_cache';
const STORAGE_LANG_KEY = 'freesim_lang';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🔥', '🙏'];

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

type ActiveChat =
  | { kind: 'dm'; user: PublicUser }
  | { kind: 'group'; group: PublicGroup };

interface GroupPeerState {
  user: PublicUser;
  pc: RTCPeerConnection;
  stream: MediaStream;
  iceRestarted: boolean;
}

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_LANG_KEY);
    if (saved === 'ru' || saved === 'en' || saved === 'uz') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'ru';
}

function chatKey(kind: 'dm' | 'group', id: string): string {
  return `${kind}:${id}`;
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const t = TRANSLATIONS[lang];

  const [authKey, setAuthKey] = useState<string | null>(null);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(STORAGE_AUTH_KEY));
    } catch {
      return false;
    }
  });

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<PublicUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);

  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');

  // Enhanced chat states
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [typingUsers, setTypingUsers] = useState<
    Record<string, Record<string, { name: string; expiresAt: number }>>
  >({});
  const [replyToMsg, setReplyToMsg] = useState<MessageRecord | null>(null);
  const [editingMsg, setEditingMsg] = useState<MessageRecord | null>(null);
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Voice recording states
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);

  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // 1-on-1 WebRTC call state
  const [callSession, setCallSession] = useState<ActiveCallSession | null>(null);
  const [callElapsedSec, setCallElapsedSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Group WebRTC call state
  const [groupCallSession, setGroupCallSession] = useState<ActiveGroupCallSession | null>(null);
  const [groupCallPeers, setGroupCallPeers] = useState<GroupPeerMedia[]>([]);
  const [groupCallElapsedSec, setGroupCallElapsedSec] = useState(0);
  const [groupLocalStream, setGroupLocalStream] = useState<MediaStream | null>(null);
  const [groupMuted, setGroupMuted] = useState(false);
  const [groupCameraOff, setGroupCameraOff] = useState(false);
  const [activeGroupCallByGroupId, setActiveGroupCallByGroupId] = useState<
    Record<string, PublicGroupCallRoom>
  >({});
  const [groupIncomingInvite, setGroupIncomingInvite] = useState<{
    group: PublicGroup;
    room: PublicGroupCallRoom;
    actor?: PublicUser;
  } | null>(null);

  // Refs for 1-on-1 calls
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<{ offer: RTCSessionDescriptionInit; callId: string } | null>(null);
  const earlyIceMapRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingLocalIceRef = useRef<RTCIceCandidateInit[]>([]);
  const offerReadyCallIdRef = useRef<string | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceRestartedRef = useRef(false);
  const ringStopRef = useRef<(() => void) | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callSessionRef = useRef<ActiveCallSession | null>(null);

  // Refs for group calls
  const groupCallSessionRef = useRef<ActiveGroupCallSession | null>(null);
  const groupLocalStreamRef = useRef<MediaStream | null>(null);
  const groupPeersMapRef = useRef<Map<string, GroupPeerState>>(new Map());
  const groupEarlyIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const groupFacingModeRef = useRef<'user' | 'environment'>('user');
  const groupRingStopRef = useRef<(() => void) | null>(null);

  // Refs for app & media
  const activeChatRef = useRef<ActiveChat | null>(null);
  const meRef = useRef<PublicUser | null>(null);
  const authKeyRef = useRef<string | null>(null);
  const langRef = useRef<Lang>(lang);
  const chatsRef = useRef<ChatSummary[]>(chats);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const lastTypingSentAtRef = useRef<number>(0);

  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordStartRef = useRef<number>(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordDiscardRef = useRef<boolean>(false);

  callSessionRef.current = callSession;
  groupCallSessionRef.current = groupCallSession;
  activeChatRef.current = activeChat;
  meRef.current = me;
  authKeyRef.current = authKey;
  langRef.current = lang;
  chatsRef.current = chats;

  const setLang = useCallback((nextLang: Lang) => {
    setLangState(nextLang);
    try {
      localStorage.setItem(STORAGE_LANG_KEY, nextLang);
    } catch {
      // Ignore storage error
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${TRANSLATIONS[lang].appName} — ${TRANSLATIONS[lang].tagline}`;
  }, [lang]);

  // Restore saved session on mount
  useEffect(() => {
    let savedKey: string | null = null;
    try {
      savedKey = localStorage.getItem(STORAGE_AUTH_KEY);
    } catch {
      savedKey = null;
    }
    if (!savedKey) {
      setIsRestoringSession(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${savedKey}` },
        });
        if (cancelled) return;
        if (res.ok) {
          const user: PublicUser = await res.json();
          setAuthKey(savedKey);
          setMe(user);
          try {
            localStorage.setItem(STORAGE_USER_CACHE, JSON.stringify(user));
          } catch {
            // Ignore
          }
        } else if (res.status === 401) {
          try {
            localStorage.removeItem(STORAGE_AUTH_KEY);
            localStorage.removeItem(STORAGE_USER_CACHE);
          } catch {
            // Ignore
          }
        }
      } catch {
        // If offline on PWA startup, restore from cached user profile
        if (!cancelled) {
          try {
            const rawUser = localStorage.getItem(STORAGE_USER_CACHE);
            if (rawUser) {
              const cachedUser = JSON.parse(rawUser) as PublicUser;
              if (cachedUser?.username) {
                setAuthKey(savedKey);
                setMe(cachedUser);
              }
            }
          } catch {
            // Ignore
          }
        }
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Prune expired typing indicators every second
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [k, users] of Object.entries(prev)) {
          const alive: Record<string, { name: string; expiresAt: number }> = {};
          for (const [uname, entry] of Object.entries(users)) {
            if (entry.expiresAt > now) {
              alive[uname] = entry;
            } else {
              changed = true;
            }
          }
          if (Object.keys(alive).length > 0) {
            next[k] = alive;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const apiFetch = useCallback(async (url: string, init: RequestInit = {}) => {
    const token = authKeyRef.current;
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...init, headers });
  }, []);

  const syncGroupPeersState = useCallback(() => {
    const list: GroupPeerMedia[] = [];
    for (const entry of groupPeersMapRef.current.values()) {
      list.push({ user: entry.user, stream: entry.stream });
    }
    setGroupCallPeers(list);
  }, []);

  const cleanupCallMedia = useCallback(() => {
    if (ringStopRef.current) {
      ringStopRef.current();
      ringStopRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    pendingOfferRef.current = null;
    pendingLocalIceRef.current = [];
    offerReadyCallIdRef.current = null;
    iceRestartedRef.current = false;
    facingModeRef.current = 'user';
    setLocalStream(null);
    setRemoteStream(null);
    setCallSession(null);
    setCallElapsedSec(0);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const cleanupGroupCallMedia = useCallback(() => {
    if (groupRingStopRef.current) {
      groupRingStopRef.current();
      groupRingStopRef.current = null;
    }
    for (const peer of groupPeersMapRef.current.values()) {
      peer.pc.onicecandidate = null;
      peer.pc.ontrack = null;
      peer.pc.oniceconnectionstatechange = null;
      peer.pc.onconnectionstatechange = null;
      peer.pc.close();
    }
    groupPeersMapRef.current.clear();
    groupEarlyIceRef.current.clear();

    if (groupLocalStreamRef.current) {
      for (const track of groupLocalStreamRef.current.getTracks()) {
        track.stop();
      }
      groupLocalStreamRef.current = null;
    }
    groupFacingModeRef.current = 'user';
    setGroupCallPeers([]);
    setGroupLocalStream(null);
    setGroupCallSession(null);
    setGroupCallElapsedSec(0);
    setGroupMuted(false);
    setGroupCameraOff(false);
  }, []);

  const sendSignal = useCallback(
    async (
      to: string,
      type: SignalEventPayload['type'],
      callId: string,
      extra: { callType?: CallType; data?: unknown } = {},
    ) => {
      const res = await apiFetch('/api/signal', {
        method: 'POST',
        body: JSON.stringify({ to, type, callId, ...extra }),
      });
      return res.json();
    },
    [apiFetch],
  );

  const sendGroupCallSignal = useCallback(
    async (
      groupId: string,
      callId: string,
      to: string,
      type: 'offer' | 'answer' | 'ice',
      data: unknown,
    ) => {
      await apiFetch(`/api/groups/${encodeURIComponent(groupId)}/call/signal`, {
        method: 'POST',
        body: JSON.stringify({ to, callId, type, data }),
      }).catch(() => {});
    },
    [apiFetch],
  );

  // Live 1-on-1 call duration ticker
  useEffect(() => {
    if (!callSession || callSession.phase !== 'connected' || !callSession.connectedAt) {
      return;
    }
    const tick = () => {
      setCallElapsedSec(Math.floor((Date.now() - callSession.connectedAt!) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [callSession]);

  // Live group call duration ticker
  useEffect(() => {
    if (!groupCallSession) return;
    const tick = () => {
      setGroupCallElapsedSec(
        Math.max(0, Math.floor((Date.now() - groupCallSession.startedAt) / 1000)),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [groupCallSession]);

  const loadChatsAndDirectory = useCallback(async () => {
    try {
      const [chatsRes, usersRes] = await Promise.all([
        apiFetch('/api/chats'),
        apiFetch('/api/users'),
      ]);
      if (chatsRes.ok) {
        const list: ChatSummary[] = await chatsRes.json();
        setChats(list);
        const activeRooms: Record<string, PublicGroupCallRoom> = {};
        for (const c of list) {
          if (c.kind === 'group' && c.group.activeCall) {
            activeRooms[c.group.id] = c.group.activeCall;
          }
        }
        setActiveGroupCallByGroupId(activeRooms);
      }
      if (usersRes.ok) {
        const users: PublicUser[] = await usersRes.json();
        setDirectoryUsers(users);
      }
    } catch {
      // Ignore transient network errors
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!authKey) return;
    void loadChatsAndDirectory();
    void (async () => {
      try {
        const res = await apiFetch('/api/ice-servers');
        if (res.ok) {
          const data = (await res.json()) as { iceServers?: RTCIceServer[] };
          if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            iceServersRef.current = data.iceServers;
          }
        }
      } catch {
        // Keep default STUN servers
      }
    })();
  }, [authKey, apiFetch, loadChatsAndDirectory]);

  useEffect(() => {
    if (!authKey) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/users?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          setSearchResults(await res.json());
        }
      } catch {
        // Ignore
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [authKey, searchQuery, apiFetch]);

  const resetComposerContext = useCallback(() => {
    setReplyToMsg(null);
    setEditingMsg(null);
    setSelectedMsgId(null);
    setPendingImage(null);
  }, []);

  const openDmChat = useCallback(
    async (peer: PublicUser) => {
      resetComposerContext();
      setUnreadCounts((prev) => {
        const key = chatKey('dm', peer.username);
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setActiveChat({ kind: 'dm', user: peer });
      setLoadingMessages(true);
      try {
        const [msgRes, userRes] = await Promise.all([
          apiFetch(`/api/messages?with=${encodeURIComponent(peer.username)}`),
          apiFetch(`/api/users/${encodeURIComponent(peer.username)}`),
        ]);
        if (msgRes.ok) {
          setMessages(await msgRes.json());
        }
        if (userRes.ok) {
          const freshUser: PublicUser = await userRes.json();
          setActiveChat({ kind: 'dm', user: freshUser });
          setChats((prev) =>
            prev.map((c) =>
              c.kind === 'dm' && c.user.username === freshUser.username
                ? { ...c, user: freshUser }
                : c,
            ),
          );
          setDirectoryUsers((prev) =>
            prev.map((u) => (u.username === freshUser.username ? freshUser : u)),
          );
        }
      } catch {
        showToast(TRANSLATIONS[langRef.current].toastLoadHistoryFailed);
      } finally {
        setLoadingMessages(false);
      }
    },
    [apiFetch, resetComposerContext, showToast],
  );

  const openGroupChat = useCallback(
    async (group: PublicGroup) => {
      resetComposerContext();
      setUnreadCounts((prev) => {
        const key = chatKey('group', group.id);
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setActiveChat({ kind: 'group', group });
      setLoadingMessages(true);
      try {
        const [msgRes, grpRes] = await Promise.all([
          apiFetch(`/api/messages?group=${encodeURIComponent(group.id)}`),
          apiFetch(`/api/groups/${encodeURIComponent(group.id)}`),
        ]);
        if (msgRes.ok) {
          setMessages(await msgRes.json());
        }
        if (grpRes.ok) {
          const freshGroup: PublicGroup = await grpRes.json();
          setActiveChat({ kind: 'group', group: freshGroup });
          if (freshGroup.activeCall) {
            setActiveGroupCallByGroupId((prev) => ({
              ...prev,
              [freshGroup.id]: freshGroup.activeCall!,
            }));
          } else {
            setActiveGroupCallByGroupId((prev) => {
              if (!prev[freshGroup.id]) return prev;
              const next = { ...prev };
              delete next[freshGroup.id];
              return next;
            });
          }
          setChats((prev) =>
            prev.map((c) =>
              c.kind === 'group' && c.group.id === freshGroup.id
                ? { ...c, group: freshGroup }
                : c,
            ),
          );
        }
      } catch {
        showToast(TRANSLATIONS[langRef.current].toastLoadHistoryFailed);
      } finally {
        setLoadingMessages(false);
      }
    },
    [apiFetch, resetComposerContext, showToast],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeChat]);

  const acquireCallMedia = useCallback(
    async (callType: CallType, facing: 'user' | 'environment' = 'user') => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MEDIA_UNAVAILABLE');
      }
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video:
            callType === 'video'
              ? { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } }
              : false,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
      }
    },
    [],
  );

  const unlockAudioGesture = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          void ctx.resume().catch(() => {});
        }
        setTimeout(() => void ctx.close().catch(() => {}), 250);
      }
    } catch {
      // Ignore audio unlock error
    }
  }, []);

  // Create PeerConnection for Group Call Mesh
  const createGroupPeerConnection = useCallback(
    (groupId: string, callId: string, peerUser: PublicUser, local: MediaStream) => {
      const existing = groupPeersMapRef.current.get(peerUser.username);
      if (existing) {
        existing.pc.close();
        groupPeersMapRef.current.delete(peerUser.username);
      }

      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 4,
      });

      for (const track of local.getTracks()) {
        pc.addTrack(track, local);
      }

      const remote = new MediaStream();
      const peerState: GroupPeerState = {
        user: peerUser,
        pc,
        stream: remote,
        iceRestarted: false,
      };
      groupPeersMapRef.current.set(peerUser.username, peerState);
      syncGroupPeersState();

      pc.ontrack = (e) => {
        const incoming = e.streams[0]?.getTracks() ?? [e.track];
        let added = false;
        for (const tr of incoming) {
          if (!peerState.stream.getTracks().some((t) => t.id === tr.id)) {
            peerState.stream.addTrack(tr);
            added = true;
          }
        }
        if (added) {
          peerState.stream = new MediaStream(peerState.stream.getTracks());
          syncGroupPeersState();
        }
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        void sendGroupCallSignal(groupId, callId, peerUser.username, 'ice', e.candidate.toJSON());
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          if (!peerState.iceRestarted && typeof pc.restartIce === 'function') {
            peerState.iceRestarted = true;
            pc.restartIce();
          }
        }
      };

      return peerState;
    },
    [sendGroupCallSignal, syncGroupPeersState],
  );

  const handleGroupCallEvent = useCallback(
    (payload: GroupCallEventPayload) => {
      if (groupRingStopRef.current && payload.event === 'ended') {
        groupRingStopRef.current();
        groupRingStopRef.current = null;
      }

      if (payload.room) {
        const room = payload.room;
        setActiveGroupCallByGroupId((prev) => ({
          ...prev,
          [payload.groupId]: room,
        }));
        setChats((prev) =>
          prev.map((c) =>
            c.kind === 'group' && c.group.id === payload.groupId
              ? { ...c, group: { ...c.group, activeCall: room } }
              : c,
          ),
        );
        setActiveChat((prev) =>
          prev?.kind === 'group' && prev.group.id === payload.groupId
            ? { ...prev, group: { ...prev.group, activeCall: room } }
            : prev,
        );
      } else {
        setActiveGroupCallByGroupId((prev) => {
          if (!prev[payload.groupId]) return prev;
          const next = { ...prev };
          delete next[payload.groupId];
          return next;
        });
        setChats((prev) =>
          prev.map((c) =>
            c.kind === 'group' && c.group.id === payload.groupId
              ? { ...c, group: { ...c.group, activeCall: null } }
              : c,
          ),
        );
        setActiveChat((prev) =>
          prev?.kind === 'group' && prev.group.id === payload.groupId
            ? { ...prev, group: { ...prev.group, activeCall: null } }
            : prev,
        );
      }

      const currentMe = meRef.current;
      const currentSession = groupCallSessionRef.current;

      if (payload.event === 'started' && payload.room) {
        if (
          !currentSession &&
          !callSessionRef.current &&
          payload.actor?.username !== currentMe?.username
        ) {
          const matched = chatsRef.current.find(
            (c) => c.kind === 'group' && c.group.id === payload.groupId,
          );
          const groupObj: PublicGroup =
            matched && matched.kind === 'group'
              ? matched.group
              : {
                  id: payload.groupId,
                  name: payload.groupName || TRANSLATIONS[langRef.current].groupCallTitle,
                  description: '',
                  avatar: '',
                  avatarColor: '#4E8FD9',
                  owner: payload.room.host,
                  members: payload.room.participants,
                  memberCount: payload.room.participants.length,
                  created: Date.now(),
                };
          setGroupIncomingInvite({
            group: groupObj,
            room: payload.room,
            actor: payload.actor,
          });
          if (groupRingStopRef.current) groupRingStopRef.current();
          groupRingStopRef.current = startRingtone('incoming');
          setTimeout(() => {
            if (groupRingStopRef.current) {
              groupRingStopRef.current();
              groupRingStopRef.current = null;
            }
          }, 9000);
        }
      }

      if (payload.event === 'participant-left' && payload.actor) {
        const uname = payload.actor.username;
        const peer = groupPeersMapRef.current.get(uname);
        if (peer && currentSession?.group.id === payload.groupId) {
          peer.pc.close();
          groupPeersMapRef.current.delete(uname);
          syncGroupPeersState();
        }
      }

      if (payload.event === 'ended') {
        setGroupIncomingInvite((prev) =>
          prev?.group.id === payload.groupId ? null : prev,
        );
        if (currentSession?.group.id === payload.groupId) {
          cleanupGroupCallMedia();
        }
      }
    },
    [cleanupGroupCallMedia, syncGroupPeersState],
  );

  const handleGroupCallSignal = useCallback(
    async (payload: GroupCallSignalPayload) => {
      const currentSession = groupCallSessionRef.current;
      const local = groupLocalStreamRef.current;
      if (!currentSession || !local || currentSession.callId !== payload.callId) return;

      const peerUsername = payload.from.username;
      const earlyKey = `${payload.callId}:${peerUsername}`;

      if (payload.type === 'offer') {
        const peerState = createGroupPeerConnection(
          payload.groupId,
          payload.callId,
          payload.from,
          local,
        );
        try {
          await peerState.pc.setRemoteDescription(
            new RTCSessionDescription(payload.data as RTCSessionDescriptionInit),
          );
          const queued = groupEarlyIceRef.current.get(earlyKey) ?? [];
          groupEarlyIceRef.current.delete(earlyKey);
          for (const cand of queued) {
            await peerState.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
          const answer = await peerState.pc.createAnswer();
          await peerState.pc.setLocalDescription(answer);
          await sendGroupCallSignal(
            payload.groupId,
            payload.callId,
            peerUsername,
            'answer',
            peerState.pc.localDescription ?? answer,
          );
        } catch {
          peerState.pc.close();
          groupPeersMapRef.current.delete(peerUsername);
          syncGroupPeersState();
        }
        return;
      }

      const peerState = groupPeersMapRef.current.get(peerUsername);

      if (payload.type === 'answer') {
        if (!peerState || !payload.data) return;
        try {
          await peerState.pc.setRemoteDescription(
            new RTCSessionDescription(payload.data as RTCSessionDescriptionInit),
          );
          const queued = groupEarlyIceRef.current.get(earlyKey) ?? [];
          groupEarlyIceRef.current.delete(earlyKey);
          for (const cand of queued) {
            await peerState.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          }
        } catch {
          // Ignore malformed answer
        }
        return;
      }

      if (payload.type === 'ice') {
        const cand = payload.data as RTCIceCandidateInit | null;
        if (!cand) return;
        if (peerState && peerState.pc.remoteDescription) {
          await peerState.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        } else {
          const queue = groupEarlyIceRef.current.get(earlyKey) ?? [];
          queue.push(cand);
          groupEarlyIceRef.current.set(earlyKey, queue);
        }
      }
    },
    [createGroupPeerConnection, sendGroupCallSignal, syncGroupPeersState],
  );

  const handleSignalEvent = useCallback(
    async (payload: SignalEventPayload) => {
      const currentCall = callSessionRef.current;
      const tr = TRANSLATIONS[langRef.current];

      if (payload.type === 'offer') {
        if (currentCall || groupCallSessionRef.current) {
          void sendSignal(payload.from.username, 'busy', payload.callId);
          return;
        }
        pendingOfferRef.current = {
          offer: payload.data as RTCSessionDescriptionInit,
          callId: payload.callId,
        };
        setCallSession({
          callId: payload.callId,
          peer: payload.from,
          direction: 'incoming',
          callType: payload.callType === 'video' ? 'video' : 'audio',
          phase: 'ringing',
          connectedAt: null,
        });
        ringStopRef.current = startRingtone('incoming');
        return;
      }

      if (payload.type === 'ice') {
        const candidate = payload.data as RTCIceCandidateInit | null;
        if (!candidate || !payload.callId) return;
        const pc = pcRef.current;
        if (
          currentCall &&
          currentCall.callId === payload.callId &&
          pc &&
          pc.remoteDescription
        ) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        } else {
          const queue = earlyIceMapRef.current.get(payload.callId) ?? [];
          queue.push(candidate);
          earlyIceMapRef.current.set(payload.callId, queue);
        }
        return;
      }

      if (!currentCall || currentCall.callId !== payload.callId) {
        if (
          payload.type === 'hangup' ||
          payload.type === 'reject' ||
          payload.type === 'cancel' ||
          payload.type === 'missed'
        ) {
          earlyIceMapRef.current.delete(payload.callId);
        }
        return;
      }

      if (payload.type === 'answer') {
        if (ringStopRef.current) {
          ringStopRef.current();
          ringStopRef.current = null;
        }
        if (ringTimeoutRef.current) {
          clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }
        const pc = pcRef.current;
        if (pc && payload.data) {
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription(payload.data as RTCSessionDescriptionInit),
            );
            const queued = earlyIceMapRef.current.get(payload.callId) ?? [];
            earlyIceMapRef.current.delete(payload.callId);
            for (const candidate of queued) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
            }
          } catch {
            void sendSignal(currentCall.peer.username, 'hangup', payload.callId);
            cleanupCallMedia();
            showToast(tr.toastCallConnectFailed);
            return;
          }
        }
        setCallSession((prev) =>
          prev ? { ...prev, phase: 'connected', connectedAt: Date.now() } : null,
        );
        return;
      }

      if (
        payload.type === 'hangup' ||
        payload.type === 'reject' ||
        payload.type === 'cancel' ||
        payload.type === 'busy' ||
        payload.type === 'missed'
      ) {
        earlyIceMapRef.current.delete(payload.callId);
        if (payload.type === 'reject') showToast(tr.toastCallDeclined);
        if (payload.type === 'busy') showToast(tr.toastUserBusy);
        cleanupCallMedia();
      }
    },
    [cleanupCallMedia, sendSignal, showToast],
  );

  // Authenticated SSE stream
  useEffect(() => {
    if (!authKey) return;
    let cancelled = false;
    let controller: AbortController | null = null;

    const sortChats = (list: ChatSummary[]) =>
      [...list].sort((a, b) => {
        const tsA = a.kind === 'dm' ? a.last.ts : (a.last?.ts ?? a.group.created);
        const tsB = b.kind === 'dm' ? b.last.ts : (b.last?.ts ?? b.group.created);
        return tsB - tsA;
      });

    const connect = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const res = await fetch('/api/stream', {
            headers: { Authorization: `Bearer ${authKey}` },
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error('stream failed');

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!cancelled) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sepIdx = buffer.indexOf('\n\n');
            while (sepIdx !== -1) {
              const rawEvent = buffer.slice(0, sepIdx);
              buffer = buffer.slice(sepIdx + 2);
              sepIdx = buffer.indexOf('\n\n');

              if (!rawEvent.trim() || rawEvent.startsWith(':')) continue;

              let eventName = 'message';
              const dataLines: string[] = [];
              for (const line of rawEvent.split('\n')) {
                if (line.startsWith('event:')) {
                  eventName = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                  dataLines.push(line.slice(5).trim());
                }
              }
              if (dataLines.length === 0) continue;

              try {
                const payload = JSON.parse(dataLines.join('\n'));
                if (eventName === 'message') {
                  const msg = payload.message as MessageRecord;
                  const currentMe = meRef.current;
                  if (!currentMe) continue;

                  if (msg.chatKind === 'group' && msg.groupId) {
                    const grp = payload.group as PublicGroup;
                    setChats((prev) => {
                      const existing = prev.find(
                        (c) => c.kind === 'group' && c.group.id === msg.groupId,
                      );
                      const filtered = prev.filter(
                        (c) => !(c.kind === 'group' && c.group.id === msg.groupId),
                      );
                      const mergedGroup =
                        existing && existing.kind === 'group'
                          ? { ...existing.group, ...grp }
                          : grp;
                      return sortChats([{ kind: 'group', group: mergedGroup, last: msg }, ...filtered]);
                    });

                    const isOpen =
                      activeChatRef.current?.kind === 'group' &&
                      activeChatRef.current.group.id === msg.groupId;

                    if (isOpen) {
                      setMessages((prev) =>
                        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
                      );
                    } else if (msg.from !== currentMe.username) {
                      const k = chatKey('group', msg.groupId);
                      setUnreadCounts((prev) => ({ ...prev, [k]: (prev[k] || 0) + 1 }));
                    }

                    // Clear typing indicator for sender in group
                    const tKey = chatKey('group', msg.groupId);
                    setTypingUsers((prev) => {
                      const cur = prev[tKey];
                      if (!cur?.[msg.from]) return prev;
                      const nextGroup = { ...cur };
                      delete nextGroup[msg.from];
                      return { ...prev, [tKey]: nextGroup };
                    });
                  } else {
                    const peerUser = payload.user as PublicUser;
                    const otherUsername = msg.from === currentMe.username ? msg.to : msg.from;

                    setChats((prev) => {
                      const filtered = prev.filter(
                        (c) => !(c.kind === 'dm' && c.user.username === otherUsername),
                      );
                      return sortChats([{ kind: 'dm', user: peerUser, last: msg }, ...filtered]);
                    });

                    const isOpen =
                      activeChatRef.current?.kind === 'dm' &&
                      activeChatRef.current.user.username === otherUsername;

                    if (isOpen) {
                      setMessages((prev) =>
                        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
                      );
                    } else if (msg.from !== currentMe.username) {
                      const k = chatKey('dm', otherUsername);
                      setUnreadCounts((prev) => ({ ...prev, [k]: (prev[k] || 0) + 1 }));
                    }

                    const tKey = chatKey('dm', otherUsername);
                    setTypingUsers((prev) => {
                      if (!prev[tKey]) return prev;
                      const next = { ...prev };
                      delete next[tKey];
                      return next;
                    });
                  }
                } else if (eventName === 'message:updated') {
                  const updatedMsg = payload.message as MessageRecord;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)),
                  );
                  setChats((prev) =>
                    prev.map((c) => {
                      if (c.kind === 'group' && c.last?.id === updatedMsg.id) {
                        return { ...c, last: updatedMsg };
                      }
                      if (c.kind === 'dm' && c.last.id === updatedMsg.id) {
                        return { ...c, last: updatedMsg };
                      }
                      return c;
                    }),
                  );
                } else if (eventName === 'typing') {
                  const tp = payload as TypingEventPayload;
                  const key =
                    tp.chatKind === 'group' && tp.groupId
                      ? chatKey('group', tp.groupId)
                      : chatKey('dm', tp.from.username);
                  setTypingUsers((prev) => ({
                    ...prev,
                    [key]: {
                      ...(prev[key] ?? {}),
                      [tp.from.username]: {
                        name: tp.from.name,
                        expiresAt: Date.now() + 3600,
                      },
                    },
                  }));
                } else if (eventName === 'group:updated') {
                  const { group, last } = payload as {
                    group: PublicGroup;
                    last?: MessageRecord;
                  };
                  setChats((prev) => {
                    const existing = prev.find(
                      (c) => c.kind === 'group' && c.group.id === group.id,
                    );
                    const filtered = prev.filter(
                      (c) => !(c.kind === 'group' && c.group.id === group.id),
                    );
                    const prevLast =
                      existing && existing.kind === 'group' ? existing.last : null;
                    return sortChats([
                      { kind: 'group', group, last: last ?? prevLast },
                      ...filtered,
                    ]);
                  });
                  setActiveChat((prev) =>
                    prev?.kind === 'group' && prev.group.id === group.id
                      ? { kind: 'group', group }
                      : prev,
                  );
                } else if (eventName === 'group:removed') {
                  const { groupId } = payload as { groupId: string };
                  setChats((prev) =>
                    prev.filter((c) => !(c.kind === 'group' && c.group.id === groupId)),
                  );
                  if (
                    activeChatRef.current?.kind === 'group' &&
                    activeChatRef.current.group.id === groupId
                  ) {
                    setActiveChat(null);
                    setShowRightDrawer(false);
                  }
                  if (groupCallSessionRef.current?.group.id === groupId) {
                    cleanupGroupCallMedia();
                  }
                } else if (eventName === 'group:call') {
                  handleGroupCallEvent(payload as GroupCallEventPayload);
                } else if (eventName === 'group:call:signal') {
                  void handleGroupCallSignal(payload as GroupCallSignalPayload);
                } else if (eventName === 'presence') {
                  const p = payload as { username: string; online: boolean; lastSeen: number };
                  setChats((prev) =>
                    prev.map((c) =>
                      c.kind === 'dm' && c.user.username === p.username
                        ? { ...c, user: { ...c.user, online: p.online, lastSeen: p.lastSeen } }
                        : c,
                    ),
                  );
                  setDirectoryUsers((prev) =>
                    prev.map((u) =>
                      u.username === p.username
                        ? { ...u, online: p.online, lastSeen: p.lastSeen }
                        : u,
                    ),
                  );
                  setActiveChat((prev) => {
                    if (!prev) return null;
                    if (prev.kind === 'dm' && prev.user.username === p.username) {
                      return {
                        kind: 'dm',
                        user: { ...prev.user, online: p.online, lastSeen: p.lastSeen },
                      };
                    }
                    if (prev.kind === 'group' && prev.group.membersInfo) {
                      return {
                        kind: 'group',
                        group: {
                          ...prev.group,
                          membersInfo: prev.group.membersInfo.map((m) =>
                            m.username === p.username
                              ? { ...m, online: p.online, lastSeen: p.lastSeen }
                              : m,
                          ),
                        },
                      };
                    }
                    return prev;
                  });
                } else if (eventName === 'profile') {
                  const { user: updatedUser, previousUsername } = payload as {
                    user: PublicUser;
                    previousUsername: string;
                  };
                  setChats((prev) =>
                    prev.map((c) =>
                      c.kind === 'dm' &&
                      (c.user.username === previousUsername ||
                        c.user.username === updatedUser.username)
                        ? { ...c, user: updatedUser }
                        : c,
                    ),
                  );
                  if (updatedUser.username !== meRef.current?.username) {
                    setDirectoryUsers((prev) => {
                      const exists = prev.some(
                        (u) =>
                          u.username === previousUsername ||
                          u.username === updatedUser.username,
                      );
                      if (!exists) return [updatedUser, ...prev];
                      return prev.map((u) =>
                        u.username === previousUsername ||
                        u.username === updatedUser.username
                          ? updatedUser
                          : u,
                      );
                    });
                    setSearchResults((prev) =>
                      prev.map((u) =>
                        u.username === previousUsername ||
                        u.username === updatedUser.username
                          ? updatedUser
                          : u,
                      ),
                    );
                  }
                  setActiveChat((prev) => {
                    if (!prev) return null;
                    if (
                      prev.kind === 'dm' &&
                      (prev.user.username === previousUsername ||
                        prev.user.username === updatedUser.username)
                    ) {
                      return { kind: 'dm', user: updatedUser };
                    }
                    if (prev.kind === 'group' && prev.group.membersInfo) {
                      return {
                        kind: 'group',
                        group: {
                          ...prev.group,
                          membersInfo: prev.group.membersInfo.map((m) =>
                            m.username === previousUsername ||
                            m.username === updatedUser.username
                              ? updatedUser
                              : m,
                          ),
                        },
                      };
                    }
                    return prev;
                  });
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.sender &&
                      (m.sender.username === previousUsername ||
                        m.sender.username === updatedUser.username)
                        ? { ...m, sender: updatedUser }
                        : m,
                    ),
                  );
                  setCallSession((prev) =>
                    prev &&
                    (prev.peer.username === previousUsername ||
                      prev.peer.username === updatedUser.username)
                      ? { ...prev, peer: updatedUser }
                      : prev,
                  );
                } else if (eventName === 'signal') {
                  void handleSignalEvent(payload as SignalEventPayload);
                }
              } catch {
                // Ignore malformed JSON chunk
              }
            }
          }
        } catch {
          if (cancelled) break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    void connect();
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [
    authKey,
    cleanupGroupCallMedia,
    handleGroupCallEvent,
    handleGroupCallSignal,
    handleSignalEvent,
  ]);

  const createPeerConnection = useCallback(
    (peerUsername: string, callId: string, stream: MediaStream, bufferLocalIce: boolean) => {
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 4,
      });
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.ontrack = (e) => {
        const incomingTracks = e.streams[0]?.getTracks() ?? [e.track];
        let added = false;
        for (const track of incomingTracks) {
          if (!remote.getTracks().some((t) => t.id === track.id)) {
            remote.addTrack(track);
            added = true;
          }
        }
        if (added) {
          setRemoteStream(new MediaStream(remote.getTracks()));
        }
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const json = e.candidate.toJSON();
        if (bufferLocalIce && offerReadyCallIdRef.current !== callId) {
          pendingLocalIceRef.current.push(json);
          return;
        }
        void sendSignal(peerUsername, 'ice', callId, { data: json }).catch(() => {});
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          if (disconnectTimerRef.current) {
            clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
          return;
        }
        if (pc.iceConnectionState === 'failed') {
          if (!iceRestartedRef.current && typeof pc.restartIce === 'function') {
            iceRestartedRef.current = true;
            pc.restartIce();
            return;
          }
        }
        if (pc.iceConnectionState === 'disconnected') {
          if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = setTimeout(() => {
            if (
              callSessionRef.current?.callId === callId &&
              (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed')
            ) {
              void sendSignal(peerUsername, 'hangup', callId);
              cleanupCallMedia();
              showToast(TRANSLATIONS[langRef.current].toastCallConnectFailed);
            }
          }, 6000);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected' && disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (pc.connectionState === 'failed' && !iceRestartedRef.current) {
            return;
          }
          if (callSessionRef.current?.callId === callId) {
            void sendSignal(peerUsername, 'hangup', callId);
            cleanupCallMedia();
          }
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [cleanupCallMedia, sendSignal, showToast],
  );

  // ---------- Group Calls Actions ----------
  const joinGroupCall = useCallback(
    async (group: PublicGroup, callType: CallType) => {
      const tr = TRANSLATIONS[langRef.current];
      if (callSessionRef.current || groupCallSessionRef.current) {
        showToast(tr.toastFinishCallFirst);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast(tr.toastMediaUnavailableHttps);
        return;
      }

      if (groupRingStopRef.current) {
        groupRingStopRef.current();
        groupRingStopRef.current = null;
      }
      setGroupIncomingInvite(null);
      unlockAudioGesture();

      let stream: MediaStream;
      try {
        stream = await acquireCallMedia(callType, 'user');
      } catch {
        showToast(callType === 'video' ? tr.toastNoMediaVideo : tr.toastNoMediaAudio);
        return;
      }

      groupLocalStreamRef.current = stream;
      groupFacingModeRef.current = 'user';
      setGroupLocalStream(stream);
      setGroupMuted(false);
      setGroupCameraOff(false);

      try {
        const res = await apiFetch(`/api/groups/${encodeURIComponent(group.id)}/call/join`, {
          method: 'POST',
          body: JSON.stringify({ callType }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          cleanupGroupCallMedia();
          showToast(err.error || tr.toastCallStartFailed);
          return;
        }
        const data = (await res.json()) as {
          room: PublicGroupCallRoom;
          existingParticipants: PublicUser[];
        };

        setGroupCallSession({
          group,
          callId: data.room.callId,
          callType: data.room.callType,
          startedAt: data.room.startedAt,
        });

        // Establish WebRTC mesh with every already-joined participant
        for (const peerUser of data.existingParticipants) {
          const peerState = createGroupPeerConnection(
            group.id,
            data.room.callId,
            peerUser,
            stream,
          );
          try {
            const offer = await peerState.pc.createOffer();
            await peerState.pc.setLocalDescription(offer);
            await sendGroupCallSignal(
              group.id,
              data.room.callId,
              peerUser.username,
              'offer',
              peerState.pc.localDescription ?? offer,
            );
          } catch {
            peerState.pc.close();
            groupPeersMapRef.current.delete(peerUser.username);
            syncGroupPeersState();
          }
        }
      } catch {
        cleanupGroupCallMedia();
        showToast(tr.toastCallStartFailed);
      }
    },
    [
      acquireCallMedia,
      apiFetch,
      cleanupGroupCallMedia,
      createGroupPeerConnection,
      sendGroupCallSignal,
      showToast,
      syncGroupPeersState,
      unlockAudioGesture,
    ],
  );

  const leaveActiveGroupCall = useCallback(async () => {
    const current = groupCallSessionRef.current;
    cleanupGroupCallMedia();
    if (!current) return;
    await apiFetch(`/api/groups/${encodeURIComponent(current.group.id)}/call/leave`, {
      method: 'POST',
    }).catch(() => {});
  }, [apiFetch, cleanupGroupCallMedia]);

  const toggleGroupMute = useCallback(() => {
    const stream = groupLocalStreamRef.current;
    if (!stream) return;
    const nextMuted = !groupMuted;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    setGroupMuted(nextMuted);
  }, [groupMuted]);

  const toggleGroupCamera = useCallback(() => {
    const stream = groupLocalStreamRef.current;
    if (!stream) return;
    const nextOff = !groupCameraOff;
    for (const track of stream.getVideoTracks()) {
      track.enabled = !nextOff;
    }
    setGroupCameraOff(nextOff);
  }, [groupCameraOff]);

  const switchGroupCamera = useCallback(async () => {
    const stream = groupLocalStreamRef.current;
    if (!stream || !navigator.mediaDevices?.getUserMedia) return;
    const nextFacing = groupFacingModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { exact: nextFacing }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const newTrack = nextStream.getVideoTracks()[0];
      if (!newTrack) return;

      for (const old of stream.getVideoTracks()) {
        stream.removeTrack(old);
        old.stop();
      }
      stream.addTrack(newTrack);

      for (const peer of groupPeersMapRef.current.values()) {
        const sender = peer.pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }
      groupFacingModeRef.current = nextFacing;
      setGroupLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      // Single camera device
    }
  }, []);

  // ---------- 1-on-1 Calls Actions ----------
  const startCall = useCallback(
    async (peer: PublicUser, callType: CallType) => {
      const tr = TRANSLATIONS[langRef.current];
      if (callSessionRef.current || groupCallSessionRef.current) {
        showToast(tr.toastFinishCallFirst);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast(tr.toastMediaUnavailableHttps);
        return;
      }

      unlockAudioGesture();

      let stream: MediaStream;
      try {
        stream = await acquireCallMedia(callType, 'user');
      } catch {
        showToast(callType === 'video' ? tr.toastNoMediaVideo : tr.toastNoMediaAudio);
        return;
      }

      const callId = crypto.randomUUID();
      localStreamRef.current = stream;
      facingModeRef.current = 'user';
      setLocalStream(stream);
      pendingLocalIceRef.current = [];
      offerReadyCallIdRef.current = null;

      setCallSession({
        callId,
        peer,
        direction: 'outgoing',
        callType,
        phase: 'ringing',
        connectedAt: null,
      });

      try {
        const pc = createPeerConnection(peer.username, callId, stream, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const res = await sendSignal(peer.username, 'offer', callId, {
          callType,
          data: pc.localDescription ?? offer,
        });

        if (!res.delivered) {
          cleanupCallMedia();
          if (res.busy) {
            showToast(tr.toastUserBusy);
          } else {
            showToast(tr.toastUserOfflineCallLogged);
          }
          return;
        }

        offerReadyCallIdRef.current = callId;
        const bufferedIce = pendingLocalIceRef.current;
        pendingLocalIceRef.current = [];
        for (const cand of bufferedIce) {
          void sendSignal(peer.username, 'ice', callId, { data: cand }).catch(() => {});
        }

        ringStopRef.current = startRingtone('outgoing');
        ringTimeoutRef.current = setTimeout(() => {
          if (
            callSessionRef.current?.callId === callId &&
            callSessionRef.current.phase === 'ringing'
          ) {
            void sendSignal(peer.username, 'missed', callId);
            cleanupCallMedia();
            showToast(tr.toastNoAnswer);
          }
        }, 30_000);
      } catch {
        cleanupCallMedia();
        showToast(tr.toastCallStartFailed);
      }
    },
    [
      acquireCallMedia,
      cleanupCallMedia,
      createPeerConnection,
      sendSignal,
      showToast,
      unlockAudioGesture,
    ],
  );

  const acceptIncomingCall = useCallback(async () => {
    const tr = TRANSLATIONS[langRef.current];
    const current = callSessionRef.current;
    const pending = pendingOfferRef.current;
    if (!current || !pending || current.callId !== pending.callId) return;

    if (ringStopRef.current) {
      ringStopRef.current();
      ringStopRef.current = null;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      await sendSignal(current.peer.username, 'reject', current.callId).catch(() => {});
      cleanupCallMedia();
      showToast(tr.toastMediaUnavailableHttps);
      return;
    }

    unlockAudioGesture();

    let stream: MediaStream;
    try {
      stream = await acquireCallMedia(current.callType, 'user');
    } catch {
      await sendSignal(current.peer.username, 'reject', current.callId).catch(() => {});
      cleanupCallMedia();
      showToast(current.callType === 'video' ? tr.toastNoMediaVideo : tr.toastNoMediaAudio);
      return;
    }

    localStreamRef.current = stream;
    facingModeRef.current = 'user';
    setLocalStream(stream);
    setCallSession((prev) => (prev ? { ...prev, phase: 'connecting' } : null));

    try {
      const pc = createPeerConnection(current.peer.username, current.callId, stream, false);
      await pc.setRemoteDescription(new RTCSessionDescription(pending.offer));

      const queued = earlyIceMapRef.current.get(current.callId) ?? [];
      earlyIceMapRef.current.delete(current.callId);
      for (const candidate of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(current.peer.username, 'answer', current.callId, {
        data: pc.localDescription ?? answer,
      });

      setCallSession((prev) =>
        prev ? { ...prev, phase: 'connected', connectedAt: Date.now() } : null,
      );
    } catch {
      await sendSignal(current.peer.username, 'hangup', current.callId).catch(() => {});
      cleanupCallMedia();
      showToast(tr.toastCallConnectFailed);
    }
  }, [
    acquireCallMedia,
    cleanupCallMedia,
    createPeerConnection,
    sendSignal,
    showToast,
    unlockAudioGesture,
  ]);

  const declineIncomingCall = useCallback(async () => {
    const current = callSessionRef.current;
    if (!current) return;
    earlyIceMapRef.current.delete(current.callId);
    await sendSignal(current.peer.username, 'reject', current.callId).catch(() => {});
    cleanupCallMedia();
  }, [cleanupCallMedia, sendSignal]);

  const hangupCall = useCallback(async () => {
    const current = callSessionRef.current;
    if (!current) return;
    earlyIceMapRef.current.delete(current.callId);
    const signalType = current.phase === 'ringing' ? 'cancel' : 'hangup';
    await sendSignal(current.peer.username, signalType, current.callId).catch(() => {});
    cleanupCallMedia();
  }, [cleanupCallMedia, sendSignal]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    for (const track of stream.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !isCameraOff;
    for (const track of stream.getVideoTracks()) {
      track.enabled = !nextOff;
    }
    setIsCameraOff(nextOff);
  }, [isCameraOff]);

  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream || !navigator.mediaDevices?.getUserMedia) return;
    const nextFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { exact: nextFacing }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const newTrack = nextStream.getVideoTracks()[0];
      if (!newTrack) return;

      const oldTracks = stream.getVideoTracks();
      for (const old of oldTracks) {
        stream.removeTrack(old);
        old.stop();
      }
      stream.addTrack(newTrack);

      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(newTrack);
      }
      facingModeRef.current = nextFacing;
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      // Single camera device or permission denied
    }
  }, []);

  // ---------- Composer: Typing, Send, Edit, Delete, Reactions, Photo, Voice ----------
  const emitTyping = useCallback(() => {
    const current = activeChatRef.current;
    if (!current) return;
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 2000) return;
    lastTypingSentAtRef.current = now;
    const body =
      current.kind === 'group' ? { groupId: current.group.id } : { to: current.user.username };
    void apiFetch('/api/typing', {
      method: 'POST',
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [apiFetch]);

  const handleDraftChange = (val: string) => {
    setDraft(val);
    if (val.trim()) {
      emitTyping();
    }
  };

  const handlePickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await resizeChatImage(file, lang);
      setPendingImage(dataUrl);
      setEditingMsg(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.photoReadError);
    }
  };

  const stopVoiceRecordingCleanup = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordStreamRef.current) {
      for (const tr of recordStreamRef.current.getTracks()) {
        tr.stop();
      }
      recordStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingSec(0);
  }, []);

  const sendVoicePayload = useCallback(
    async (blob: Blob, durationSec: number) => {
      const current = activeChatRef.current;
      if (!current) return;
      setSendingMedia(true);
      try {
        const mediaData = await blobToDataUrl(blob);
        const payload: Record<string, unknown> =
          current.kind === 'group'
            ? { groupId: current.group.id }
            : { to: current.user.username };
        payload.mediaType = 'audio';
        payload.mediaData = mediaData;
        payload.mediaDurationSec = Math.max(1, durationSec);
        if (replyToMsg) payload.replyToId = replyToMsg.id;

        const res = await apiFetch('/api/send', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || TRANSLATIONS[langRef.current].toastSendFailed);
        } else {
          setReplyToMsg(null);
        }
      } catch {
        showToast(TRANSLATIONS[langRef.current].toastSendFailed);
      } finally {
        setSendingMedia(false);
      }
    },
    [apiFetch, replyToMsg, showToast],
  );

  const startVoiceRecording = useCallback(async () => {
    const tr = TRANSLATIONS[langRef.current];
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showToast(tr.toastMediaUnavailableHttps);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordChunksRef.current = [];
      recordDiscardRef.current = false;
      recordStartRef.current = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const shouldDiscard = recordDiscardRef.current;
        const duration = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
        const chunks = [...recordChunksRef.current];
        const finalType = recorder.mimeType || 'audio/webm';
        stopVoiceRecordingCleanup();
        if (!shouldDiscard && chunks.length > 0) {
          const blob = new Blob(chunks, { type: finalType });
          void sendVoicePayload(blob, duration);
        }
      };

      recorder.start(250);
      setIsRecordingVoice(true);
      setRecordingSec(0);
      recordTimerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - recordStartRef.current) / 1000);
        setRecordingSec(sec);
        if (sec >= 60 && mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 300);
    } catch {
      stopVoiceRecordingCleanup();
      showToast(tr.toastMicRecordingError);
    }
  }, [sendVoicePayload, showToast, stopVoiceRecordingCleanup]);

  const finishVoiceRecording = useCallback(() => {
    recordDiscardRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      stopVoiceRecordingCleanup();
    }
  }, [stopVoiceRecordingCleanup]);

  const cancelVoiceRecording = useCallback(() => {
    recordDiscardRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else {
      stopVoiceRecordingCleanup();
    }
  }, [stopVoiceRecordingCleanup]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat) return;
    const text = draft.trim();

    if (editingMsg) {
      if (!text) return;
      const targetId = editingMsg.id;
      setDraft('');
      setEditingMsg(null);
      try {
        const res = await apiFetch(`/api/messages/${encodeURIComponent(targetId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showToast(err.error || t.toastSendFailed);
        }
      } catch {
        showToast(t.networkError);
      }
      return;
    }

    if (!text && !pendingImage) return;

    const imageToSend = pendingImage;
    const replyTarget = replyToMsg;
    setDraft('');
    setPendingImage(null);
    setReplyToMsg(null);
    setSendingMedia(Boolean(imageToSend));

    const payload: Record<string, unknown> =
      activeChat.kind === 'group'
        ? { groupId: activeChat.group.id }
        : { to: activeChat.user.username };
    if (text) payload.text = text;
    if (imageToSend) {
      payload.mediaType = 'image';
      payload.mediaData = imageToSend;
    }
    if (replyTarget) {
      payload.replyToId = replyTarget.id;
    }

    try {
      const res = await apiFetch('/api/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || t.toastSendFailed);
        setDraft(text);
        if (imageToSend) setPendingImage(imageToSend);
      }
    } catch {
      showToast(t.networkError);
      setDraft(text);
      if (imageToSend) setPendingImage(imageToSend);
    } finally {
      setSendingMedia(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    setSelectedMsgId(null);
    try {
      await apiFetch(`/api/messages/${encodeURIComponent(msgId)}`, {
        method: 'DELETE',
      });
    } catch {
      showToast(t.networkError);
    }
  };

  const handleToggleReaction = async (msgId: string, emoji: string) => {
    setSelectedMsgId(null);
    try {
      await apiFetch(`/api/messages/${encodeURIComponent(msgId)}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
    } catch {
      showToast(t.networkError);
    }
  };

  const handleLogout = () => {
    if (groupCallSessionRef.current) {
      void leaveActiveGroupCall();
    }
    cleanupCallMedia();
    stopVoiceRecordingCleanup();
    try {
      localStorage.removeItem(STORAGE_AUTH_KEY);
      localStorage.removeItem(STORAGE_USER_CACHE);
    } catch {
      // Ignore
    }
    setAuthKey(null);
    setMe(null);
    setChats([]);
    setDirectoryUsers([]);
    setActiveChat(null);
    setMessages([]);
    setUnreadCounts({});
    setTypingUsers({});
    setActiveGroupCallByGroupId({});
    setGroupIncomingInvite(null);
    setShowMyProfile(false);
    setShowCreateGroup(false);
    setShowRightDrawer(false);
  };

  const groupedItems = useMemo(() => {
    const items: Array<
      | { kind: 'date'; label: string; key: string }
      | { kind: 'msg'; msg: MessageRecord; key: string }
    > = [];
    let lastDate = '';
    for (const m of messages) {
      const label = formatDateLabel(m.ts, lang);
      if (label !== lastDate) {
        lastDate = label;
        items.push({ kind: 'date', label, key: `date-${label}-${m.ts}` });
      }
      items.push({ kind: 'msg', msg: m, key: m.id });
    }
    return items;
  }, [messages, lang]);

  if (isRestoringSession) {
    return (
      <div className="min-h-[100dvh] w-full bg-[#0E141B] text-[#EBF0F5] flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-2 border-[#5BA4E5] border-t-transparent animate-spin" />
        <p className="mt-4 text-sm text-[#8FA0B2]">{t.restoringSession}</p>
      </div>
    );
  }

  if (!authKey || !me) {
    return (
      <>
        <OfflineBanner lang={lang} />
        <AuthScreen
          lang={lang}
          onChangeLang={setLang}
          onAuthenticated={(key, user) => {
            try {
              localStorage.setItem(STORAGE_AUTH_KEY, key);
              localStorage.setItem(STORAGE_USER_CACHE, JSON.stringify(user));
            } catch {
              // Ignore
            }
            setAuthKey(key);
            setMe(user);
          }}
        />
      </>
    );
  }

  const showingSearch = searchQuery.trim().length > 0;
  const discoverList = directoryUsers.filter(
    (u) => !chats.some((c) => c.kind === 'dm' && c.user.username === u.username),
  );

  const activeGroupOnlineCount =
    activeChat?.kind === 'group' && activeChat.group.membersInfo
      ? activeChat.group.membersInfo.filter((m) => m.online).length
      : 0;

  const activeChatTypingText = (() => {
    if (!activeChat) return null;
    const key =
      activeChat.kind === 'group'
        ? chatKey('group', activeChat.group.id)
        : chatKey('dm', activeChat.user.username);
    const activeTypers = Object.values(typingUsers[key] ?? {});
    if (activeTypers.length === 0) return null;
    if (activeChat.kind === 'dm') return t.typing;
    return `${activeTypers.map((u) => u.name).slice(0, 2).join(', ')} ${t.typing}`;
  })();

  const activeGroupCallRoom =
    activeChat?.kind === 'group' ? activeGroupCallByGroupId[activeChat.group.id] : undefined;

  return (
    <div className="h-[100dvh] w-full bg-[#0E141B] text-[#EBF0F5] flex overflow-hidden">
      <OfflineBanner lang={lang} />
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-[#1D2733] border border-white/10 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Floating incoming group call invite banner */}
      {groupIncomingInvite && !groupCallSession && !callSession && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-88 z-50 bg-[#151E27] border border-[#34C77B]/40 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <GroupAvatar group={groupIncomingInvite.group} size="sm" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#34C77B] truncate">
                {t.incomingGroupCall}
              </div>
              <div className="text-sm font-semibold text-white truncate">
                {groupIncomingInvite.group.name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                void joinGroupCall(
                  groupIncomingInvite.group,
                  groupIncomingInvite.room.callType,
                )
              }
              className="px-3 py-1.5 rounded-xl bg-[#34C77B] hover:bg-[#2BB36D] text-xs font-semibold text-white cursor-pointer"
            >
              {t.joinCall}
            </button>
            <button
              type="button"
              onClick={() => setGroupIncomingInvite(null)}
              aria-label={t.close}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-white hover:bg-white/[0.06] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside
        className={`${
          activeChat ? 'hidden md:flex' : 'flex'
        } w-full md:w-[320px] xl:w-[340px] shrink-0 h-full bg-[#151E27] border-r border-white/[0.07] flex-col`}
      >
        <div className="h-16 px-4 flex items-center justify-between gap-2 border-b border-white/[0.07] shrink-0">
          <span className="font-display text-lg font-bold text-white tracking-tight whitespace-nowrap">
            {t.appName}
          </span>

          <div className="flex items-center gap-1.5 min-w-0">
            <PWAInstallButton lang={lang} compact />
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              title={t.createGroup}
              aria-label={t.createGroup}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            >
              <Users className="w-[18px] h-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => setShowMyProfile(true)}
              title={t.myProfile}
              className="flex items-center gap-2 py-1 pl-1 pr-2.5 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer min-w-0"
            >
              <Avatar user={me} size="sm" showOnline />
              <div className="text-left min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-[100px]">
                  {me.name}
                </div>
                <div className="text-[11px] text-[#8FA0B2] truncate max-w-[100px]">
                  @{me.username}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/[0.05] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-[#6B7C8E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#0E141B] border border-white/[0.07] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t.cancel}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7C8E] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto py-1.5 overscroll-contain">
          {showingSearch ? (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-[#8FA0B2]">{t.searchResults}</div>
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-[#6B7C8E]">{t.noUsersFound}</div>
              ) : (
                searchResults.map((u) => (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      void openDmChat(u);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
                  >
                    <Avatar user={u} size="md" showOnline />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{fullName(u)}</div>
                      <div className="text-xs text-[#8FA0B2] truncate">
                        @{u.username} · {formatLastSeen(u.lastSeen, u.online, lang)}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              {chats.map((chat) => {
                if (chat.kind === 'group') {
                  const isSelected =
                    activeChat?.kind === 'group' && activeChat.group.id === chat.group.id;
                  const lastTs = chat.last?.ts ?? chat.group.created;
                  const unread = unreadCounts[chatKey('group', chat.group.id)] || 0;
                  const hasLiveCall = Boolean(activeGroupCallByGroupId[chat.group.id]);
                  const grpTyping = Object.values(
                    typingUsers[chatKey('group', chat.group.id)] ?? {},
                  );

                  return (
                    <button
                      key={`group-${chat.group.id}`}
                      type="button"
                      onClick={() => void openGroupChat(chat.group)}
                      className={`w-full px-3.5 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#26496C]/45' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <GroupAvatar group={chat.group} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Users className="w-3.5 h-3.5 text-[#6AB2F2] shrink-0" />
                            <span className="text-sm font-semibold text-white truncate">
                              {chat.group.name}
                            </span>
                            {hasLiveCall && (
                              <span className="w-2 h-2 rounded-full bg-[#34C77B] shrink-0" />
                            )}
                          </div>
                          <span className="text-[11px] font-mono-nums text-[#7F91A3] shrink-0">
                            {formatTime(lastTs, lang)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <div
                            className={`text-xs truncate ${
                              grpTyping.length > 0 ? 'text-[#6AB2F2]' : 'text-[#8FA0B2]'
                            }`}
                          >
                            {grpTyping.length > 0
                              ? `${grpTyping[0].name} ${t.typing}`
                              : chat.last
                                ? formatLastMessagePreview(chat.last, me.username, lang)
                                : `${chat.group.memberCount} ${t.membersCount}`}
                          </div>
                          {unread > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#5BA4E5] text-[11px] font-mono-nums font-semibold text-white flex items-center justify-center shrink-0">
                              {unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                }

                const isSelected =
                  activeChat?.kind === 'dm' && activeChat.user.username === chat.user.username;
                const isCall = chat.last.type === 'call';
                const unread = unreadCounts[chatKey('dm', chat.user.username)] || 0;
                const dmTyping =
                  Object.keys(typingUsers[chatKey('dm', chat.user.username)] ?? {}).length > 0;

                return (
                  <button
                    key={`dm-${chat.user.username}`}
                    type="button"
                    onClick={() => void openDmChat(chat.user)}
                    className={`w-full px-3.5 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#26496C]/45' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <Avatar user={chat.user} size="md" showOnline />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white truncate">
                          {fullName(chat.user)}
                        </span>
                        <span className="text-[11px] font-mono-nums text-[#7F91A3] shrink-0">
                          {formatTime(chat.last.ts, lang)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-[#8FA0B2] truncate min-w-0">
                          {isCall && !dmTyping && (
                            <Phone className="w-3 h-3 text-[#6AB2F2] shrink-0" />
                          )}
                          <span className={`truncate ${dmTyping ? 'text-[#6AB2F2]' : ''}`}>
                            {dmTyping
                              ? t.typing
                              : formatLastMessagePreview(chat.last, me.username, lang)}
                          </span>
                        </div>
                        {unread > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#5BA4E5] text-[11px] font-mono-nums font-semibold text-white flex items-center justify-center shrink-0">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {discoverList.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.05]">
                  <div className="px-4 py-2 text-xs font-medium text-[#8FA0B2]">
                    {t.peopleInApp}
                  </div>
                  {discoverList.map((u) => (
                    <button
                      key={u.username}
                      type="button"
                      onClick={() => void openDmChat(u)}
                      className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
                    >
                      <Avatar user={u} size="md" showOnline />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{fullName(u)}</div>
                        <div className="text-xs text-[#8FA0B2] truncate">
                          @{u.username} · {formatLastSeen(u.lastSeen, u.online, lang)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {chats.length === 0 && discoverList.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <MessageSquare className="w-8 h-8 text-[#5B6B7C] mx-auto mb-3" />
                  <p className="text-sm text-[#8FA0B2]">{t.noChatsYet}</p>
                  <p className="mt-1 text-xs text-[#6B7C8E]">{t.noChatsHint}</p>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Main Chat Viewport */}
      <main
        className={`${
          activeChat ? 'flex' : 'hidden md:flex'
        } flex-1 h-full flex-col bg-[#0E141B] min-w-0`}
      >
        {activeChat ? (
          <>
            <header className="h-16 px-4 bg-[#151E27] border-b border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveChat(null);
                    setShowRightDrawer(false);
                  }}
                  aria-label={t.backToChats}
                  className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowRightDrawer((v) => !v)}
                  className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition-opacity cursor-pointer"
                >
                  {activeChat.kind === 'group' ? (
                    <>
                      <GroupAvatar group={activeChat.group} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {activeChat.group.name}
                        </div>
                        <div
                          className={`text-xs truncate font-mono-nums ${
                            activeChatTypingText ? 'text-[#6AB2F2]' : 'text-[#8FA0B2]'
                          }`}
                        >
                          {activeChatTypingText || (
                            <>
                              {activeChat.group.memberCount} {t.membersCount}
                              {activeGroupOnlineCount > 0
                                ? ` · ${activeGroupOnlineCount} ${t.onlineShort}`
                                : ''}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Avatar user={activeChat.user} size="sm" showOnline />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {fullName(activeChat.user)}
                        </div>
                        <div
                          className={`text-xs truncate ${
                            activeChatTypingText
                              ? 'text-[#6AB2F2]'
                              : activeChat.user.online
                                ? 'text-[#34C77B]'
                                : 'text-[#8FA0B2]'
                          }`}
                        >
                          {activeChatTypingText ||
                            formatLastSeen(activeChat.user.lastSeen, activeChat.user.online, lang)}
                        </div>
                      </div>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {activeChat.kind === 'dm' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void startCall(activeChat.user, 'audio')}
                      title={t.callAudio}
                      aria-label={t.callAudio}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void startCall(activeChat.user, 'video')}
                      title={t.callVideo}
                      aria-label={t.callVideo}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void joinGroupCall(activeChat.group, 'audio')}
                      title={t.callAudio}
                      aria-label={t.callAudio}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void joinGroupCall(activeChat.group, 'video')}
                      title={t.callVideo}
                      aria-label={t.callVideo}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] transition-colors cursor-pointer"
                    >
                      <Video className="w-5 h-5" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowRightDrawer((v) => !v)}
                  title={activeChat.kind === 'group' ? t.groupInfo : t.profileTitle}
                  aria-label={activeChat.kind === 'group' ? t.groupInfo : t.profileTitle}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                    showRightDrawer
                      ? 'text-[#6AB2F2] bg-[#6AB2F2]/15'
                      : 'text-[#8FA0B2] hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  {activeChat.kind === 'group' ? (
                    <Users className="w-5 h-5" />
                  ) : (
                    <UserIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </header>

            {/* Active Group Call Banner */}
            {activeChat.kind === 'group' &&
              activeGroupCallRoom &&
              groupCallSession?.group.id !== activeChat.group.id && (
                <div className="px-4 py-2.5 bg-[#1B332A] border-b border-[#34C77B]/25 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#34C77B] animate-pulse shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-[#EBF0F5] truncate">
                      {t.groupCallInProgress} · {activeGroupCallRoom.participants.length}{' '}
                      {t.participantsCount}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void joinGroupCall(activeChat.group, activeGroupCallRoom.callType)
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-[#34C77B] hover:bg-[#2BB36D] text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
                  >
                    {t.joinCall}
                  </button>
                </div>
              )}

            {/* Message stream */}
            <div
              onClick={() => setSelectedMsgId(null)}
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2.5 overscroll-contain"
            >
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-sm text-[#6B7C8E]">
                  {t.loadingMessages}
                </div>
              ) : groupedItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <p className="text-sm font-medium text-[#EBF0F5]">{t.startChatWith}</p>
                  <p className="mt-1 text-xs text-[#6B7C8E] max-w-sm">{t.startChatHint}</p>
                </div>
              ) : (
                groupedItems.map((item) => {
                  if (item.kind === 'date') {
                    return (
                      <div key={item.key} className="flex justify-center py-2">
                        <span className="text-xs font-medium text-[#8FA0B2] px-3 py-1 rounded-full bg-[#151E27] border border-white/[0.05]">
                          {item.label}
                        </span>
                      </div>
                    );
                  }

                  const m = item.msg;
                  if (m.type === 'system') {
                    return (
                      <div key={m.id} className="flex justify-center py-1">
                        <span className="text-xs text-[#8FA0B2] px-3 py-1 rounded-full bg-[#151E27]/80">
                          {formatSystemMessage(m, lang)}
                        </span>
                      </div>
                    );
                  }

                  if (m.type === 'call') {
                    return (
                      <CallBubble
                        key={m.id}
                        message={m}
                        myUsername={me.username}
                        lang={lang}
                        onCallBack={(callType) => {
                          if (activeChat.kind === 'dm') {
                            void startCall(activeChat.user, callType);
                          } else {
                            void joinGroupCall(activeChat.group, callType);
                          }
                        }}
                      />
                    );
                  }

                  const isOutgoing = m.from === me.username;
                  const showGroupSender =
                    activeChat.kind === 'group' && !isOutgoing && Boolean(m.sender);
                  const isSelected = selectedMsgId === m.id && !m.deleted;
                  const reactionsEntries = m.reactions
                    ? Object.entries(m.reactions).filter(([, users]) => users.length > 0)
                    : [];

                  return (
                    <div
                      key={m.id}
                      id={`msg-${m.id}`}
                      className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`flex items-end gap-2 max-w-[85%] sm:max-w-[70%] ${
                          isOutgoing ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {showGroupSender && m.sender && <Avatar user={m.sender} size="xs" />}

                        <div
                          onClick={(e) => {
                            if (m.deleted) return;
                            e.stopPropagation();
                            setSelectedMsgId((prev) => (prev === m.id ? null : m.id));
                          }}
                          className={`relative px-3.5 py-2 rounded-2xl border border-white/[0.05] cursor-pointer transition-colors ${
                            m.deleted
                              ? 'bg-[#151E27] text-[#6B7C8E]'
                              : isOutgoing
                                ? 'bg-[#26496C] text-white rounded-br-sm'
                                : 'bg-[#1D2733] text-[#EBF0F5] rounded-bl-sm'
                          }`}
                        >
                          {showGroupSender && m.sender && (
                            <div
                              style={{ color: m.sender.avatarColor || '#6AB2F2' }}
                              className="text-xs font-semibold mb-0.5 leading-tight"
                            >
                              {fullName(m.sender)}
                            </div>
                          )}

                          {/* Reply Quote */}
                          {m.replyTo && !m.deleted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                document
                                  .getElementById(`msg-${m.replyTo!.id}`)
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }}
                              className={`mb-1.5 w-full text-left px-2.5 py-1.5 rounded-lg border-l-2 border-[#6AB2F2] cursor-pointer ${
                                isOutgoing ? 'bg-black/20' : 'bg-black/25'
                              }`}
                            >
                              <div className="text-[11px] font-semibold text-[#6AB2F2] truncate">
                                {m.replyTo.senderName}
                              </div>
                              <div className="text-xs text-[#C7D3DF] truncate">
                                {m.replyTo.mediaType === 'image' && !m.replyTo.text
                                  ? `📷 ${t.photoMessageLabel}`
                                  : m.replyTo.mediaType === 'audio'
                                    ? `🎤 ${t.voiceMessageLabel}`
                                    : m.replyTo.text}
                              </div>
                            </button>
                          )}

                          {m.deleted ? (
                            <div className="text-sm italic flex items-center gap-2">
                              <span>{t.deletedMessage}</span>
                              <span className="text-[11px] font-mono-nums text-[#5B6B7C]">
                                {formatTime(m.ts, lang)}
                              </span>
                            </div>
                          ) : (
                            <>
                              {m.mediaType === 'image' && m.mediaData && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxSrc(m.mediaData!);
                                  }}
                                  className="block mb-1.5 rounded-xl overflow-hidden bg-black/20 cursor-zoom-in"
                                >
                                  <img
                                    src={m.mediaData}
                                    alt={t.photoMessageLabel}
                                    className="max-h-72 w-auto object-contain rounded-xl"
                                  />
                                </button>
                              )}

                              {m.mediaType === 'audio' && m.mediaData && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="mb-1 cursor-default"
                                >
                                  <VoicePlayer
                                    src={m.mediaData}
                                    durationSec={m.mediaDurationSec}
                                    isOutgoing={isOutgoing}
                                  />
                                </div>
                              )}

                              <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                {m.text}
                                <span
                                  className={`inline-block ${
                                    m.text ? 'ml-2.5' : ''
                                  } text-[11px] font-mono-nums align-bottom ${
                                    isOutgoing ? 'text-[#A8C4DF]' : 'text-[#7F91A3]'
                                  }`}
                                >
                                  {m.editedAt ? `${t.edited} ` : ''}
                                  {formatTime(m.ts, lang)}
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Reactions row */}
                      {reactionsEntries.length > 0 && !m.deleted && (
                        <div
                          className={`mt-1 flex flex-wrap gap-1 ${
                            showGroupSender ? 'pl-8' : ''
                          }`}
                        >
                          {reactionsEntries.map(([emoji, users]) => {
                            const iReacted = users.includes(me.username);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleToggleReaction(m.id, emoji);
                                }}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer ${
                                  iReacted
                                    ? 'bg-[#5BA4E5]/25 border-[#5BA4E5]/60 text-white'
                                    : 'bg-[#151E27] border-white/[0.08] text-[#C7D3DF] hover:bg-[#1D2733]'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="font-mono-nums text-[11px]">{users.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Quick Action Toolbar when message tapped */}
                      {isSelected && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`mt-1.5 flex flex-wrap items-center gap-1 px-2 py-1.5 rounded-xl bg-[#151E27] border border-white/[0.1] shadow-xl ${
                            showGroupSender ? 'ml-8' : ''
                          }`}
                        >
                          {QUICK_REACTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => void handleToggleReaction(m.id, emoji)}
                              className="w-7 h-7 rounded-lg hover:bg-white/[0.08] flex items-center justify-center text-sm cursor-pointer"
                            >
                              {emoji}
                            </button>
                          ))}
                          <span className="w-px h-4 bg-white/[0.1] mx-0.5" />
                          <button
                            type="button"
                            onClick={() => {
                              setReplyToMsg(m);
                              setEditingMsg(null);
                              setSelectedMsgId(null);
                            }}
                            title={t.reply}
                            aria-label={t.reply}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/[0.08] text-xs text-[#EBF0F5] cursor-pointer"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5" />
                            <span>{t.reply}</span>
                          </button>
                          {isOutgoing && m.text && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMsg(m);
                                setReplyToMsg(null);
                                setPendingImage(null);
                                setDraft(m.text || '');
                                setSelectedMsgId(null);
                              }}
                              title={t.edit}
                              aria-label={t.edit}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/[0.08] text-xs text-[#EBF0F5] cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>{t.edit}</span>
                            </button>
                          )}
                          {isOutgoing && (
                            <button
                              type="button"
                              onClick={() => void handleDeleteMessage(m.id)}
                              title={t.deleteMsg}
                              aria-label={t.deleteMsg}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[#E55353]/15 text-xs text-[#EF5B5B] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t.deleteMsg}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply / Edit / Pending Photo Context Bar */}
            {(replyToMsg || editingMsg || pendingImage) && (
              <div className="px-4 py-2 bg-[#151E27] border-t border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {pendingImage && (
                    <img
                      src={pendingImage}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                  )}
                  <div className="min-w-0 border-l-2 border-[#5BA4E5] pl-2.5">
                    <div className="text-xs font-semibold text-[#6AB2F2] truncate">
                      {editingMsg
                        ? t.editingMessage
                        : replyToMsg
                          ? `${t.replyingTo} ${
                              replyToMsg.sender
                                ? fullName(replyToMsg.sender)
                                : replyToMsg.from === me.username
                                  ? fullName(me)
                                  : `@${replyToMsg.from}`
                            }`
                          : t.photoMessageLabel}
                    </div>
                    <div className="text-xs text-[#8FA0B2] truncate">
                      {editingMsg
                        ? editingMsg.text
                        : replyToMsg
                          ? replyToMsg.mediaType === 'image' && !replyToMsg.text
                            ? `📷 ${t.photoMessageLabel}`
                            : replyToMsg.mediaType === 'audio'
                              ? `🎤 ${t.voiceMessageLabel}`
                              : replyToMsg.text
                          : t.addCaptionPlaceholder}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReplyToMsg(null);
                    setEditingMsg(null);
                    setPendingImage(null);
                    if (editingMsg) setDraft('');
                  }}
                  aria-label={t.cancel}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA0B2] hover:text-white hover:bg-white/[0.06] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Composer */}
            {isRecordingVoice ? (
              <div className="px-4 py-3 bg-[#151E27] border-t border-white/[0.07] flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={cancelVoiceRecording}
                  title={t.cancelRecording}
                  aria-label={t.cancelRecording}
                  className="w-10 h-10 rounded-xl bg-[#E55353]/15 hover:bg-[#E55353]/25 text-[#EF5B5B] flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2.5 flex-1 justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#EF5B5B] animate-pulse" />
                  <span className="text-sm font-medium text-white">{t.recordingVoice}</span>
                  <span className="text-sm font-mono-nums text-[#8FA0B2]">
                    {formatTimerMMSS(recordingSec)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={finishVoiceRecording}
                  aria-label={t.sendMessageAria}
                  className="w-11 h-11 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] text-white flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Send className="w-[18px] h-[18px]" />
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSendMessage}
                className="px-3 sm:px-4 py-3 bg-[#151E27] border-t border-white/[0.07] flex items-center gap-2 shrink-0"
              >
                {!editingMsg && (
                  <>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => void handlePickPhoto(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      title={t.sendPhoto}
                      aria-label={t.sendPhoto}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-[#8FA0B2] hover:text-[#6AB2F2] hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </button>
                  </>
                )}

                <input
                  type="text"
                  maxLength={4000}
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  placeholder={
                    pendingImage ? t.addCaptionPlaceholder : t.writeMessagePlaceholder
                  }
                  className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
                />

                {draft.trim() || pendingImage || editingMsg ? (
                  <button
                    type="submit"
                    disabled={sendingMedia || (Boolean(editingMsg) && !draft.trim())}
                    aria-label={t.sendMessageAria}
                    className="w-11 h-11 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    {editingMsg ? (
                      <Check className="w-[18px] h-[18px]" />
                    ) : (
                      <Send className="w-[18px] h-[18px]" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={sendingMedia}
                    onClick={() => void startVoiceRecording()}
                    title={t.recordVoice}
                    aria-label={t.recordVoice}
                    className="w-11 h-11 rounded-xl bg-[#1D2733] hover:bg-[#263342] text-[#6AB2F2] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <Mic className="w-[18px] h-[18px]" />
                  </button>
                )}
              </form>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[#151E27] border border-white/[0.07] flex items-center justify-center text-[#6AB2F2] mb-4">
              <MessageSquare className="w-7 h-7" />
            </div>
            <h2 className="font-display text-lg font-semibold text-white">{t.selectChatTitle}</h2>
            <p className="mt-1.5 text-sm text-[#8FA0B2] max-w-sm">{t.selectChatDesc}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] text-sm font-medium text-white transition-colors cursor-pointer"
              >
                <Users className="w-4 h-4" />
                <span>{t.createGroup}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowMyProfile(true)}
                className="px-4 py-2.5 rounded-xl bg-[#151E27] hover:bg-[#1D2733] border border-white/[0.08] text-sm font-medium text-[#EBF0F5] transition-colors cursor-pointer"
              >
                {t.openMyProfile} (@{me.username})
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Right Drawer: Contact Profile or Group Info */}
      {activeChat && showRightDrawer && (
        <div className="fixed inset-0 z-40 lg:static lg:z-auto flex justify-end bg-black/50 lg:bg-transparent">
          {activeChat.kind === 'dm' ? (
            <ContactProfileDrawer
              contact={activeChat.user}
              myUsername={me.username}
              messages={messages}
              lang={lang}
              onClose={() => setShowRightDrawer(false)}
              onStartCall={(callType) => void startCall(activeChat.user, callType)}
            />
          ) : (
            <GroupInfoDrawer
              group={activeChat.group}
              myUsername={me.username}
              authKey={authKey}
              lang={lang}
              directoryUsers={directoryUsers}
              onClose={() => setShowRightDrawer(false)}
              onUpdated={(updatedGroup) =>
                setActiveChat({ kind: 'group', group: updatedGroup })
              }
              onLeftGroup={(groupId) => {
                setChats((prev) =>
                  prev.filter((c) => !(c.kind === 'group' && c.group.id === groupId)),
                );
                setActiveChat(null);
                setShowRightDrawer(false);
              }}
              onOpenDm={(user) => {
                setShowRightDrawer(false);
                void openDmChat(user);
              }}
            />
          )}
        </div>
      )}

      {/* Own Profile Modal */}
      {showMyProfile && (
        <MyProfileModal
          user={me}
          authKey={authKey}
          lang={lang}
          onChangeLang={setLang}
          onClose={() => setShowMyProfile(false)}
          onUpdated={(updatedUser, previousUsername) => {
            setMe(updatedUser);
            try {
              localStorage.setItem(STORAGE_USER_CACHE, JSON.stringify(updatedUser));
            } catch {
              // Ignore
            }
            if (previousUsername !== updatedUser.username) {
              setMessages((prev) =>
                prev.map((m) => ({
                  ...m,
                  from: m.from === previousUsername ? updatedUser.username : m.from,
                  to: m.to === previousUsername ? updatedUser.username : m.to,
                })),
              );
            }
          }}
          onKeyRotated={(nextKey) => {
            try {
              localStorage.setItem(STORAGE_AUTH_KEY, nextKey);
            } catch {
              // Ignore
            }
            setAuthKey(nextKey);
          }}
          onLogout={handleLogout}
        />
      )}

      {/* Create Group Modal */}
      {showCreateGroup && (
        <CreateGroupModal
          authKey={authKey}
          lang={lang}
          initialUsers={directoryUsers}
          onClose={() => setShowCreateGroup(false)}
          onCreated={(group, last) => {
            setShowCreateGroup(false);
            setChats((prev) => {
              const filtered = prev.filter(
                (c) => !(c.kind === 'group' && c.group.id === group.id),
              );
              return [{ kind: 'group', group, last }, ...filtered];
            });
            void openGroupChat(group);
          }}
        />
      )}

      {/* 1-on-1 WebRTC Call Overlay */}
      {callSession && (
        <CallOverlay
          session={callSession}
          elapsedSec={callElapsedSec}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          localStream={localStream}
          remoteStream={remoteStream}
          lang={lang}
          onAccept={() => void acceptIncomingCall()}
          onDecline={() => void declineIncomingCall()}
          onHangup={() => void hangupCall()}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onSwitchCamera={() => void switchCamera()}
        />
      )}

      {/* Group WebRTC Call Overlay */}
      {groupCallSession && (
        <GroupCallOverlay
          session={groupCallSession}
          me={me}
          peers={groupCallPeers}
          elapsedSec={groupCallElapsedSec}
          isMuted={groupMuted}
          isCameraOff={groupCameraOff}
          localStream={groupLocalStream}
          lang={lang}
          onLeave={() => void leaveActiveGroupCall()}
          onToggleMute={toggleGroupMute}
          onToggleCamera={toggleGroupCamera}
          onSwitchCamera={() => void switchGroupCamera()}
        />
      )}

      {/* Photo Lightbox */}
      {lightboxSrc && (
        <div
          onClick={() => setLightboxSrc(null)}
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4"
        >
          <button
            type="button"
            onClick={() => setLightboxSrc(null)}
            aria-label={t.close}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt={t.photoMessageLabel}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90dvh] rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
