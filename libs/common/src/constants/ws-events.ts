/** Events the client sends → server (@SubscribeMessage) */
export const WsClientEvent = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_MESSAGE: 'send_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  HEARTBEAT: 'heartbeat',
} as const;

/**
 * Events the server emits → client.
 *
 * Two typing paths exist:
 *   USER_TYPING — gateway emits directly on typing_start / typing_stop
 *   TYPING      — emitted via Redis pub/sub (chat service → gateway → client)
 */
export const WsServerEvent = {
  // Room lifecycle
  JOINED_ROOM: 'joined_room',
  LEFT_ROOM: 'left_room',

  // Presence (broadcast to all)
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  /** Snapshot of currently-online users — emitted only to a freshly-connected client */
  ONLINE_USERS: 'online_users',

  // Typing — direct gateway path (no Redis)
  USER_TYPING: 'user_typing',

  // Heartbeat
  HEARTBEAT_ACK: 'heartbeat_ack',

  // ── Room-scoped events (travel via Redis pub/sub) ──────────────────────
  // The `event` field in the Redis payload becomes the Socket.IO event name.

  NEW_MESSAGE: 'new_message',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_READ: 'message_read',

  REACTION_ADDED: 'reaction_added',
  REACTION_REMOVED: 'reaction_removed',

  // Typing — Redis path (chat service publishes, gateway forwards to room)
  TYPING: 'typing',
} as const;

/**
 * Event names embedded in Redis room-channel payloads.
 * Gateway reads `payload.event` and calls `server.to(roomId).emit(event, payload)`.
 * Keep in sync with WsServerEvent values that travel via Redis.
 */
export const WsRoomEvent = {
  NEW_MESSAGE:      WsServerEvent.NEW_MESSAGE,
  MESSAGE_EDITED:   WsServerEvent.MESSAGE_EDITED,
  MESSAGE_DELETED:  WsServerEvent.MESSAGE_DELETED,
  MESSAGE_READ:     WsServerEvent.MESSAGE_READ,
  REACTION_ADDED:   WsServerEvent.REACTION_ADDED,
  REACTION_REMOVED: WsServerEvent.REACTION_REMOVED,
  TYPING:           WsServerEvent.TYPING,
} as const;

/** Redis Pub/Sub channel for a room */
export const WsRedisChannel = {
  ROOM_PATTERN: 'chat:room:*',
  room: (roomId: string) => `chat:room:${roomId}`,
} as const;

/** TTLs in seconds */
export const WsTTL = {
  /** Typing indicator auto-expires if no new typing_start */
  TYPING: 5,
  /** Client must heartbeat within this window to stay "online" */
  PRESENCE: 30,
} as const;
