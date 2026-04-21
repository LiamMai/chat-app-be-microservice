export const CHAT_PATTERNS = {
  // ── Rooms ────────────────────────────────────────────────────────────────
  ROOM_CREATE:     'chat.room.create',
  ROOM_GET:        'chat.room.get',
  ROOM_LIST:       'chat.room.list',
  ROOM_ADD_MEMBER: 'chat.room.addMember',
  ROOM_LEAVE:      'chat.room.leave',

  // ── Messages ─────────────────────────────────────────────────────────────
  MESSAGE_SEND:    'chat.message.send',
  MESSAGE_HISTORY: 'chat.message.history',
  MESSAGE_MARK_READ: 'chat.message.markRead',
} as const;
