import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, PublicRoomSummary, RoomState, ServerMessage } from '../types';

const PLAYER_ID_KEY = 'party_player_id';
const PLAYER_NAME_KEY = 'party_player_name';
const PLAYER_AVATAR_KEY = 'party_player_avatar';
const ACTIVE_ROOM_KEY = 'party_active_room';

function getOrCreatePlayerId(): string {
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

export function useMultiplayer() {
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [savedName, setSavedNameState] = useState<string>(() => sessionStorage.getItem(PLAYER_NAME_KEY) || '');
  const [savedAvatar, setSavedAvatarState] = useState<number>(() => {
    const raw = sessionStorage.getItem(PLAYER_AVATAR_KEY);
    return raw ? Number(raw) : Math.floor(Math.random() * 12);
  });
  const [lastRoomCode, setLastRoomCode] = useState<string | null>(() => sessionStorage.getItem(ACTIVE_ROOM_KEY));

  const [connected, setConnected] = useState(false);
  const [rooms, setRooms] = useState<PublicRoomSummary[]>([]);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeOffset, setTimeOffset] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const activeRoomCodeRef = useRef<string | null>(null);
  const pendingQueueRef = useRef<ClientMessage[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSavedName = useCallback((name: string) => {
    setSavedNameState(name);
    sessionStorage.setItem(PLAYER_NAME_KEY, name);
  }, []);

  const setSavedAvatar = useCallback((avatarId: number) => {
    setSavedAvatarState(avatarId);
    sessionStorage.setItem(PLAYER_AVATAR_KEY, String(avatarId));
  }, []);

  const sendMessage = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      pendingQueueRef.current.push(msg);
    }
  }, []);

  const clearError = useCallback(() => setErrorMsg(null), []);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        ws.send(JSON.stringify({ type: 'rooms:subscribe' } satisfies ClientMessage));

        const urlInvite = new URLSearchParams(window.location.search).get('room');
        const codeToRejoin = urlInvite
          ? null
          : activeRoomCodeRef.current || sessionStorage.getItem(ACTIVE_ROOM_KEY);
        if (codeToRejoin) {
          ws.send(
            JSON.stringify({
              type: 'room:rejoin',
              roomCode: codeToRejoin,
              playerId,
            } satisfies ClientMessage)
          );
        }

        while (pendingQueueRef.current.length > 0) {
          const queued = pendingQueueRef.current.shift();
          if (queued) ws.send(JSON.stringify(queued));
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          if (msg.type === 'rooms:list') {
            setRooms(msg.rooms);
          } else if (msg.type === 'room:state') {
            setRoom(msg.room);
            setTimeOffset(msg.room.serverTime - Date.now());
            activeRoomCodeRef.current = msg.room.code;
            sessionStorage.setItem(ACTIVE_ROOM_KEY, msg.room.code);
            setLastRoomCode(msg.room.code);
            setErrorMsg(null);
          } else if (msg.type === 'room:left' || msg.type === 'room:kicked') {
            setRoom(null);
            activeRoomCodeRef.current = null;
            sessionStorage.removeItem(ACTIVE_ROOM_KEY);
            setLastRoomCode(null);
          } else if (msg.type === 'room:error') {
            if (msg.code === 'NOT_FOUND' || msg.code === 'NOT_MEMBER') {
              activeRoomCodeRef.current = null;
              sessionStorage.removeItem(ACTIVE_ROOM_KEY);
              setLastRoomCode(null);
              setRoom(null);
            }
            setErrorMsg(msg.message);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        reconnectTimerRef.current = setTimeout(connect, 1500);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [playerId]);

  const createRoom = useCallback(
    (name: string, avatarId: number) => {
      setSavedName(name);
      setSavedAvatar(avatarId);
      sendMessage({ type: 'room:create', playerId, name, avatarId });
    },
    [playerId, sendMessage, setSavedAvatar, setSavedName]
  );

  const joinRoom = useCallback(
    (roomCode: string, name: string, avatarId: number) => {
      setSavedName(name);
      setSavedAvatar(avatarId);
      sendMessage({ type: 'room:join', roomCode: roomCode.toUpperCase(), playerId, name, avatarId });
    },
    [playerId, sendMessage, setSavedAvatar, setSavedName]
  );

  const rejoinRoom = useCallback(
    (roomCode: string) => {
      sendMessage({ type: 'room:rejoin', roomCode: roomCode.toUpperCase(), playerId });
    },
    [playerId, sendMessage]
  );

  const leaveRoom = useCallback(() => {
    if (!room) return;
    sendMessage({ type: 'room:leave', roomCode: room.code, playerId });
    setRoom(null);
    activeRoomCodeRef.current = null;
    sessionStorage.removeItem(ACTIVE_ROOM_KEY);
    setLastRoomCode(null);
  }, [playerId, room, sendMessage]);

  const refreshRooms = useCallback(() => {
    sendMessage({ type: 'rooms:subscribe' });
  }, [sendMessage]);

  return {
    playerId,
    savedName,
    setSavedName,
    savedAvatar,
    setSavedAvatar,
    lastRoomCode,
    connected,
    rooms,
    room,
    errorMsg,
    clearError,
    timeOffset,
    sendMessage,
    createRoom,
    joinRoom,
    rejoinRoom,
    leaveRoom,
    refreshRooms,
  };
}
