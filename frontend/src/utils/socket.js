import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem('safepath_token');
    const socketServerUrl = import.meta.env.VITE_SOCKET_URL || 
      (typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'))
        ? 'https://trisquadathon-2-0.onrender.com'
        : (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:5000' : window.location.origin));
    socket = io(socketServerUrl, {
      auth: { token },
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    socket.on('connect', () => {
      console.log('[SafePath Socket] Connected with ID:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[SafePath Socket] Disconnected:', reason);
    });
  }

  return socket;
}

export function updateSocketAuth(token) {
  if (socket) {
    socket.auth = { token };
    socket.disconnect().connect();
  }
}

export function joinRoom(room) {
  const s = getSocket();
  s.emit('join', { room });
}

export function leaveRoom(room) {
  const s = getSocket();
  s.emit('leave', { room });
}
