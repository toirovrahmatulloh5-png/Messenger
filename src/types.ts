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
  created: number;
}

export interface MessageRecord {
  id: string;
  type: 'text' | 'call' | 'system';
  chatKind?: 'dm' | 'group';
  groupId?: string;
  from: string;
  to: string;
  text?: string;
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
