import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Play } from 'lucide-react';
import { useMultiplayer } from './hooks/useMultiplayer';
import { StartScreen } from './components/StartScreen';
import { RoomsBrowserScreen } from './components/RoomsBrowserScreen';
import { RoomLobbyScreen } from './components/RoomLobbyScreen';
import { GameSelectScreen } from './components/GameSelectScreen';
import { GameTopBar } from './components/GameTopBar';
import { DrawingGame } from './games/DrawingGame';
import { PongGame } from './games/PongGame';
import { GuessGame } from './games/GuessGame';
import { RaceGame } from './games/RaceGame';
import { FarmGame } from './games/FarmGame';
import { soundFX } from './utils/sound';

export default function App() {
  const {
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
  } = useMultiplayer();

  const [homeView, setHomeView] = useState<'start' | 'rooms'>('start');
  const [guestSteppedOut, setGuestSteppedOut] = useState(false);
  const [inviteRoomCode, setInviteRoomCode] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    return code ? code.trim().toUpperCase() : null;
  });

  // Reset guest stepped-out state when room stage or active game changes
  useEffect(() => {
    setGuestSteppedOut(false);
  }, [room?.stage, room?.currentGame]);

  // Clear ?room query string once inside a room
  useEffect(() => {
    if (room && inviteRoomCode) {
      setInviteRoomCode(null);
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [room, inviteRoomCode]);

  // 1. Not inside a room yet -> Start Screen or Rooms Browser
  if (!room) {
    if (homeView === 'rooms') {
      return (
        <RoomsBrowserScreen
          playerName={savedName}
          playerAvatar={savedAvatar}
          rooms={rooms}
          errorMsg={errorMsg}
          onBack={() => {
            clearError();
            setHomeView('start');
          }}
          onRefresh={refreshRooms}
          onJoinRoom={(code) => joinRoom(code, savedName, savedAvatar)}
        />
      );
    }

    return (
      <StartScreen
        initialName={savedName}
        initialAvatar={savedAvatar}
        inviteRoomCode={inviteRoomCode}
        lastRoomCode={lastRoomCode}
        connected={connected}
        errorMsg={errorMsg}
        onClearError={clearError}
        onCreateRoom={(name, avatarId) => createRoom(name, avatarId)}
        onOpenRooms={(name, avatarId) => {
          setSavedName(name);
          setSavedAvatar(avatarId);
          refreshRooms();
          setHomeView('rooms');
        }}
        onJoinInvitedRoom={(code, name, avatarId) => joinRoom(code, name, avatarId)}
        onRejoinLastRoom={(code) => rejoinRoom(code)}
        onSetInviteCode={(code) => setInviteRoomCode(code)}
      />
    );
  }

  // 2. Inside Room: Lobby Stage (or guest stepped out to room lobby)
  if (room.stage === 'lobby' || guestSteppedOut) {
    return (
      <div className="relative">
        {guestSteppedOut && room.stage === 'playing' && (
          <div className="bg-amber-400 border-b-4 border-amber-600 px-4 py-3 text-slate-900">
            <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
              <span className="font-extrabold text-sm sm:text-base">
                اللعبة لا تزال جارية في الغرفة — يمكنك الرجوع للعب في أي لحظة!
              </span>
              <button
                type="button"
                onClick={() => {
                  soundFX.playJoin();
                  setGuestSteppedOut(false);
                }}
                className="toy-btn bg-emerald-500 border-emerald-700 text-white font-black px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>العودة للعبة الجارية</span>
              </button>
            </div>
          </div>
        )}

        <RoomLobbyScreen
          room={room}
          playerId={playerId}
          onStartGameSelect={() =>
            sendMessage({ type: 'room:open_game_select', roomCode: room.code, playerId })
          }
          onLeaveRoom={() => {
            leaveRoom();
            setHomeView('start');
          }}
        />
      </div>
    );
  }

  // 3. Inside Room: Game Selection Stage
  if (room.stage === 'game_select' || !room.currentGame || !room.gameState) {
    return (
      <GameSelectScreen
        room={room}
        playerId={playerId}
        onSelectGame={(gameId) =>
          sendMessage({ type: 'room:select_game', roomCode: room.code, playerId, gameId })
        }
        onBackToLobby={() =>
          sendMessage({ type: 'room:back_to_lobby', roomCode: room.code, playerId })
        }
      />
    );
  }

  // 4. Inside Room: Active Game Stage
  const isHost = room.hostId === playerId;
  const gs = room.gameState;

  return (
    <div className="min-h-screen party-bg py-4 sm:py-6 px-3 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <GameTopBar
          room={room}
          playerId={playerId}
          currentGame={room.currentGame}
          onChangeGame={() =>
            sendMessage({ type: 'room:open_game_select', roomCode: room.code, playerId })
          }
          onBackToLobby={() =>
            sendMessage({ type: 'room:back_to_lobby', roomCode: room.code, playerId })
          }
          onTempStepOut={() => setGuestSteppedOut(true)}
          onLeaveRoom={() => {
            leaveRoom();
            setHomeView('start');
          }}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={gs.kind}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {gs.kind === 'drawing' && (
              <DrawingGame
                roomCode={room.code}
                playerId={playerId}
                isHost={isHost}
                players={room.players}
                state={gs}
                timeOffset={timeOffset}
                sendMessage={sendMessage}
              />
            )}

            {gs.kind === 'pong' && (
              <PongGame
                roomCode={room.code}
                playerId={playerId}
                isHost={isHost}
                state={gs}
                sendMessage={sendMessage}
              />
            )}

            {gs.kind === 'guess' && (
              <GuessGame
                roomCode={room.code}
                playerId={playerId}
                isHost={isHost}
                players={room.players}
                state={gs}
                timeOffset={timeOffset}
                sendMessage={sendMessage}
              />
            )}

            {gs.kind === 'race' && (
              <RaceGame
                roomCode={room.code}
                playerId={playerId}
                isHost={isHost}
                state={gs}
                sendMessage={sendMessage}
              />
            )}

            {gs.kind === 'farm' && (
              <FarmGame
                roomCode={room.code}
                playerId={playerId}
                isHost={isHost}
                players={room.players}
                state={gs}
                timeOffset={timeOffset}
                sendMessage={sendMessage}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
