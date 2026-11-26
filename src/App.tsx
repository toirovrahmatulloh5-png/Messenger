import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Search,
  Send,
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
import { GroupInfoDrawer } from './components/GroupInfoDrawer.tsx';
import { MyProfileModal } from './components/MyProfileModal.tsx';
import { TRANSLATIONS, type Lang } from './i18n.ts';
import type {
  CallType,
  ChatSummary,
  MessageRecord,
  PublicGroup,
  PublicUser,
  SignalEventPayload,
} from './types.ts';
import {
  formatDateLabel,
  formatLastMessagePreview,
  formatLastSeen,
  formatSystemMessage,
  formatTime,
  fullName,
  startRingtone,
} from './utils/format.ts';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

type ActiveChat =
  | { kind: 'dm'; user: PublicUser }
  | { kind: 'group'; group: PublicGroup };

export default function App() {
  const [lang, setLang] = useState<Lang>('ru');
  const t = TRANSLATIONS[lang];

  const [authKey, setAuthKey] = useState<string | null>(null);
  const [me, setMe] = useState<PublicUser | null>(null);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<PublicUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);

  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState('');

  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // WebRTC call state
  const [callSession, setCallSession] = useState<ActiveCallSession | null>(null);
  const [callElapsedSec, setCallElapsedSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<{ offer: RTCSessionDescriptionInit; callId: string } | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const ringStopRef = useRef<(() => void) | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callSessionRef = useRef<ActiveCallSession | null>(null);
  const activeChatRef = useRef<ActiveChat | null>(null);
  const meRef = useRef<PublicUser | null>(null);
  const authKeyRef = useRef<string | null>(null);
  const langRef = useRef<Lang>(lang);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  callSessionRef.current = callSession;
  activeChatRef.current = activeChat;
  meRef.current = me;
  authKeyRef.current = authKey;
  langRef.current = lang;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${TRANSLATIONS[lang].appName} — ${TRANSLATIONS[lang].tagline}`;
  }, [lang]);

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

  const cleanupCallMedia = useCallback(() => {
    if (ringStopRef.current) {
      ringStopRef.current();
      ringStopRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
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
    iceQueueRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setCallSession(null);
    setCallElapsedSec(0);
    setIsMuted(false);
    setIsCameraOff(false);
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

  // Live call duration ticker
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

  const loadChatsAndDirectory = useCallback(async () => {
    try {
      const [chatsRes, usersRes] = await Promise.all([
        apiFetch('/api/chats'),
        apiFetch('/api/users'),
      ]);
      if (chatsRes.ok) {
        const list: ChatSummary[] = await chatsRes.json();
        setChats(list);
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
  }, [authKey, loadChatsAndDirectory]);

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

  const openDmChat = useCallback(
    async (peer: PublicUser) => {
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
        }
      } catch {
        showToast(TRANSLATIONS[langRef.current].toastLoadHistoryFailed);
      } finally {
        setLoadingMessages(false);
      }
    },
    [apiFetch, showToast],
  );

  const openGroupChat = useCallback(
    async (group: PublicGroup) => {
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
        }
      } catch {
        showToast(TRANSLATIONS[langRef.current].toastLoadHistoryFailed);
      } finally {
        setLoadingMessages(false);
      }
    },
    [apiFetch, showToast],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeChat]);

  const handleSignalEvent = useCallback(
    async (payload: SignalEventPayload) => {
      const currentCall = callSessionRef.current;
      const tr = TRANSLATIONS[langRef.current];

      if (payload.type === 'offer') {
        if (currentCall) {
          void sendSignal(payload.from.username, 'busy', payload.callId);
          return;
        }
        pendingOfferRef.current = {
          offer: payload.data as RTCSessionDescriptionInit,
          callId: payload.callId,
        };
        iceQueueRef.current = [];
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

      if (!currentCall || currentCall.callId !== payload.callId) return;

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
          await pc.setRemoteDescription(
            new RTCSessionDescription(payload.data as RTCSessionDescriptionInit),
          );
          for (const candidate of iceQueueRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          }
          iceQueueRef.current = [];
        }
        setCallSession((prev) =>
          prev ? { ...prev, phase: 'connected', connectedAt: Date.now() } : null,
        );
        return;
      }

      if (payload.type === 'ice') {
        const candidate = payload.data as RTCIceCandidateInit | null;
        if (!candidate) return;
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        } else {
          iceQueueRef.current.push(candidate);
        }
        return;
      }

      if (
        payload.type === 'hangup' ||
        payload.type === 'reject' ||
        payload.type === 'cancel' ||
        payload.type === 'busy' ||
        payload.type === 'missed'
      ) {
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

                    if (
                      activeChatRef.current?.kind === 'group' &&
                      activeChatRef.current.group.id === msg.groupId
                    ) {
                      setMessages((prev) =>
                        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
                      );
                    }
                  } else {
                    const peerUser = payload.user as PublicUser;
                    const otherUsername = msg.from === currentMe.username ? msg.to : msg.from;

                    setChats((prev) => {
                      const filtered = prev.filter(
                        (c) => !(c.kind === 'dm' && c.user.username === otherUsername),
                      );
                      return sortChats([{ kind: 'dm', user: peerUser, last: msg }, ...filtered]);
                    });

                    if (
                      activeChatRef.current?.kind === 'dm' &&
                      activeChatRef.current.user.username === otherUsername
                    ) {
                      setMessages((prev) =>
                        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
                      );
                    }
                  }
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
                  setDirectoryUsers((prev) =>
                    prev.map((u) =>
                      u.username === previousUsername || u.username === updatedUser.username
                        ? updatedUser
                        : u,
                    ),
                  );
                  setActiveChat((prev) => {
                    if (!prev) return null;
                    if (
                      prev.kind === 'dm' &&
                      (prev.user.username === previousUsername ||
                        prev.user.username === updatedUser.username)
                    ) {
                      return { kind: 'dm', user: updatedUser };
                    }
                    return prev;
                  });
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
  }, [authKey, handleSignalEvent]);

  const createPeerConnection = useCallback(
    (peerUsername: string, callId: string, stream: MediaStream) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      const remote = new MediaStream();
      setRemoteStream(remote);

      pc.ontrack = (e) => {
        for (const track of e.streams[0]?.getTracks() ?? [e.track]) {
          remote.addTrack(track);
        }
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void sendSignal(peerUsername, 'ice', callId, { data: e.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          if (callSessionRef.current?.callId === callId) {
            void sendSignal(peerUsername, 'hangup', callId);
            cleanupCallMedia();
          }
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [cleanupCallMedia, sendSignal],
  );

  const startCall = useCallback(
    async (peer: PublicUser, callType: CallType) => {
      const tr = TRANSLATIONS[langRef.current];
      if (callSessionRef.current) {
        showToast(tr.toastFinishCallFirst);
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video',
        });
      } catch {
        showToast(callType === 'video' ? tr.toastNoMediaVideo : tr.toastNoMediaAudio);
        return;
      }

      const callId = crypto.randomUUID();
      localStreamRef.current = stream;
      setLocalStream(stream);
      iceQueueRef.current = [];

      setCallSession({
        callId,
        peer,
        direction: 'outgoing',
        callType,
        phase: 'ringing',
        connectedAt: null,
      });

      const pc = createPeerConnection(peer.username, callId, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      try {
        const res = await sendSignal(peer.username, 'offer', callId, {
          callType,
          data: offer,
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
    [cleanupCallMedia, createPeerConnection, sendSignal, showToast],
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

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: current.callType === 'video',
      });
    } catch {
      await sendSignal(current.peer.username, 'reject', current.callId);
      cleanupCallMedia();
      showToast(tr.toastNoMediaVideo);
      return;
    }

    localStreamRef.current = stream;
    setLocalStream(stream);
    setCallSession((prev) => (prev ? { ...prev, phase: 'connecting' } : null));

    const pc = createPeerConnection(current.peer.username, current.callId, stream);
    await pc.setRemoteDescription(new RTCSessionDescription(pending.offer));
    for (const candidate of iceQueueRef.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
    }
    iceQueueRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendSignal(current.peer.username, 'answer', current.callId, { data: answer });

    setCallSession((prev) =>
      prev ? { ...prev, phase: 'connected', connectedAt: Date.now() } : null,
    );
  }, [cleanupCallMedia, createPeerConnection, sendSignal, showToast]);

  const declineIncomingCall = useCallback(async () => {
    const current = callSessionRef.current;
    if (!current) return;
    await sendSignal(current.peer.username, 'reject', current.callId);
    cleanupCallMedia();
  }, [cleanupCallMedia, sendSignal]);

  const hangupCall = useCallback(async () => {
    const current = callSessionRef.current;
    if (!current) return;
    const signalType = current.phase === 'ringing' ? 'cancel' : 'hangup';
    await sendSignal(current.peer.username, signalType, current.callId);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat) return;
    const text = draft.trim();
    if (!text) return;
    setDraft('');

    const payload =
      activeChat.kind === 'group'
        ? { groupId: activeChat.group.id, text }
        : { to: activeChat.user.username, text };

    try {
      const res = await apiFetch('/api/send', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || t.toastSendFailed);
        setDraft(text);
      }
    } catch {
      showToast(t.networkError);
      setDraft(text);
    }
  };

  const handleLogout = () => {
    cleanupCallMedia();
    setAuthKey(null);
    setMe(null);
    setChats([]);
    setDirectoryUsers([]);
    setActiveChat(null);
    setMessages([]);
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

  if (!authKey || !me) {
    return (
      <AuthScreen
        lang={lang}
        onChangeLang={setLang}
        onAuthenticated={(key, user) => {
          setAuthKey(key);
          setMe(user);
        }}
      />
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

  return (
    <div className="h-screen w-screen bg-[#0E141B] text-[#EBF0F5] flex overflow-hidden">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-[#1D2733] border border-white/10 text-sm text-white shadow-lg">
          {toast}
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
        <div className="flex-1 overflow-y-auto py-1.5">
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
                          </div>
                          <span className="text-[11px] font-mono-nums text-[#7F91A3] shrink-0">
                            {formatTime(lastTs, lang)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#8FA0B2] truncate">
                          {chat.last
                            ? formatLastMessagePreview(chat.last, me.username, lang)
                            : `${chat.group.memberCount} ${t.membersCount}`}
                        </div>
                      </div>
                    </button>
                  );
                }

                const isSelected =
                  activeChat?.kind === 'dm' && activeChat.user.username === chat.user.username;
                const isCall = chat.last.type === 'call';
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
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#8FA0B2] truncate">
                        {isCall && <Phone className="w-3 h-3 text-[#6AB2F2] shrink-0" />}
                        <span className="truncate">
                          {formatLastMessagePreview(chat.last, me.username, lang)}
                        </span>
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
            <header className="h-16 px-4 bg-[#151E27] border-b border-white/[0.07] flex items-center justify-between gap-4 shrink-0">
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
                        <div className="text-xs text-[#8FA0B2] truncate font-mono-nums">
                          {activeChat.group.memberCount} {t.membersCount}
                          {activeGroupOnlineCount > 0
                            ? ` · ${activeGroupOnlineCount} ${t.onlineShort}`
                            : ''}
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
                            activeChat.user.online ? 'text-[#34C77B]' : 'text-[#8FA0B2]'
                          }`}
                        >
                          {formatLastSeen(activeChat.user.lastSeen, activeChat.user.online, lang)}
                        </div>
                      </div>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeChat.kind === 'dm' && (
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

            {/* Message stream */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2.5">
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

                  if (m.type === 'call' && activeChat.kind === 'dm') {
                    return (
                      <CallBubble
                        key={m.id}
                        message={m}
                        myUsername={me.username}
                        lang={lang}
                        onCallBack={(callType) => void startCall(activeChat.user, callType)}
                      />
                    );
                  }

                  const isOutgoing = m.from === me.username;
                  const showGroupSender =
                    activeChat.kind === 'group' && !isOutgoing && Boolean(m.sender);

                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 ${
                        isOutgoing ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {showGroupSender && m.sender && <Avatar user={m.sender} size="xs" />}
                      <div
                        className={`max-w-[78%] sm:max-w-[65%] px-3.5 py-2 rounded-2xl border border-white/[0.05] ${
                          isOutgoing
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
                        <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                          {m.text}
                          <span
                            className={`inline-block ml-2.5 text-[11px] font-mono-nums align-bottom ${
                              isOutgoing ? 'text-[#A8C4DF]' : 'text-[#7F91A3]'
                            }`}
                          >
                            {formatTime(m.ts, lang)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSendMessage}
              className="px-4 py-3 bg-[#151E27] border-t border-white/[0.07] flex items-center gap-2.5 shrink-0"
            >
              <input
                type="text"
                maxLength={4000}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.writeMessagePlaceholder}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0E141B] border border-white/[0.08] text-sm text-white placeholder-[#5B6B7C] focus:outline-none focus:border-[#5BA4E5]"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label={t.sendMessageAria}
                className="w-11 h-11 rounded-xl bg-[#5BA4E5] hover:bg-[#4B95D8] disabled:opacity-40 disabled:hover:bg-[#5BA4E5] text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Send className="w-[18px] h-[18px]" />
              </button>
            </form>
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
          onKeyRotated={(nextKey) => setAuthKey(nextKey)}
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

      {/* Active / Incoming WebRTC Call Overlay */}
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
        />
      )}
    </div>
  );
}
