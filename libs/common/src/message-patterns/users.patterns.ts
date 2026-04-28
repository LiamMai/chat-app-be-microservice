export const USERS_PATTERNS = {
  // ── Users ────────────────────────────────────────────────────────────────
  FIND_ALL:       'users.findAll',
  FIND_BY_ID:     'users.findById',
  SEARCH:         'users.search',
  UPDATE_PROFILE: 'users.updateProfile',
  UPDATE_AVATAR:  'users.updateAvatar',
  UPDATE_COVER:   'users.updateCover',
  BAN_USER:       'users.banUser',
  ASSIGN_ROLE:    'users.assignRole',

  // ── Friends ──────────────────────────────────────────────────────────────
  FRIEND_REQUEST:          'friends.request',
  FRIEND_ACCEPT:           'friends.accept',
  FRIEND_DECLINE:          'friends.decline',
  FRIEND_UNFRIEND:         'friends.unfriend',
  FRIEND_BLOCK:            'friends.block',
  FRIEND_UNBLOCK:          'friends.unblock',
  FRIEND_LIST:             'friends.list',
  FRIEND_REQUESTS_IN:      'friends.requests.incoming',
  FRIEND_REQUESTS_OUT:     'friends.requests.outgoing',
  FRIEND_SUGGESTIONS:      'friends.suggestions',
  FRIEND_STATUS:           'friends.status',
} as const;
