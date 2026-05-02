export const CHAT_PATTERNS = {
  // ── Rooms ────────────────────────────────────────────────────────────────
  ROOM_CREATE:     'chat.room.create',
  ROOM_GET:        'chat.room.get',
  ROOM_LIST:       'chat.room.list',
  ROOM_ADD_MEMBER: 'chat.room.addMember',
  ROOM_LEAVE:      'chat.room.leave',

  // ── Messages ─────────────────────────────────────────────────────────────
  MESSAGE_SEND:      'chat.message.send',
  MESSAGE_HISTORY:   'chat.message.history',
  MESSAGE_MARK_READ: 'chat.message.markRead',
  MESSAGE_EDIT:      'chat.message.edit',
  MESSAGE_DELETE:    'chat.message.delete',
  MESSAGE_REACT_ADD: 'chat.message.react.add',
  MESSAGE_REACT_REMOVE: 'chat.message.react.remove',

  // ── Typing / presence ────────────────────────────────────────────────────
  TYPING_SET:    'chat.typing.set',
  PRESENCE_GET:  'chat.presence.get',
} as const;
