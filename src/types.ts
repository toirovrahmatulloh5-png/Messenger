export type CallType = 'audio' | 'video';

export type CallStatus = 'completed' | 'missed' | 'declined' | 'cancelled' | 'busy';

export interface PublicUser {
  username: string;
  name: string;
  surname: string;
  bio: string;
  avatar: string;
  avatarColor: string;
  created: number;
  lastSeen: number;
  online: boolean;
}

export interface PublicGroupCallRoom {
  callId: string;
  groupId: string;
  callType: CallType;
  host: string;
  startedAt: number;
  participants: string[];
  participantsInfo?: PublicUser[];
}

export interface PublicGroup {
  id: string;
  name: string;
  description: string;
  avatar: string;
  avatarColor: string;
  owner: string;
  members: string[];
  memberCount: number;
  membersInfo?: PublicUser[];
  activeCall?: PublicGroupCallRoom | null;
  created: number;
}

export interface ReplyPreview {
  id: string;
  from: string;
  senderName: string;
  text?: string;
  mediaType?: 'image' | 'audio';
}

export interface MessageRecord {
  id: string;
  type: 'text' | 'call' | 'system';
  chatKind?: 'dm' | 'group';
  groupId?: string;
  from: string;
  to: string;
  text?: string;
  mediaType?: 'image' | 'audio';
  mediaData?: string;
  mediaDurationSec?: number;
  replyTo?: ReplyPreview;
  editedAt?: number;
  deleted?: boolean;
  reactions?: Record<string, string[]>;
  sender?: PublicUser;
  systemAction?: 'created' | 'left' | 'added' | 'removed';
  systemTarget?: string;
  callType?: CallType;
  callStatus?: CallStatus;
  durationSec?: number;
  ts: number;
}

export type ChatSummary =
  | {
      kind: 'dm';
      user: PublicUser;
      last: MessageRecord;
    }
  | {
      kind: 'group';
      group: PublicGroup;
      last: MessageRecord | null;
    };

export type SignalType =
  | 'offer'
  | 'answer'
  | 'ice'
  | 'hangup'
  | 'reject'
  | 'cancel'
  | 'busy'
  | 'missed';

export interface SignalEventPayload {
  from: PublicUser;
  type: SignalType;
  callId: string;
  callType?: CallType;
  data?: unknown;
}

export interface GroupCallEventPayload {
  groupId: string;
  groupName?: string;
  event: 'started' | 'participant-joined' | 'participant-left' | 'ended';
  room: PublicGroupCallRoom | null;
  actor?: PublicUser;
}

export interface GroupCallSignalPayload {
  groupId: string;
  callId: string;
  from: PublicUser;
  type: 'offer' | 'answer' | 'ice';
  data?: unknown;
}

export interface TypingEventPayload {
  chatKind: 'dm' | 'group';
  groupId?: string;
  from: PublicUser;
}
