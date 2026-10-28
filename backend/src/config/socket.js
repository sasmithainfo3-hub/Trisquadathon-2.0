import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './env.js';

let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000
  });

  io.use((socket, next) => {
    // Optional auth on connect: check token from handshake auth or query
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        socket.userId = decoded.userId;
      } catch (err) {
        // Allow unauthenticated connection for public alert token viewers (contacts)
        socket.userId = null;
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    // If authenticated user, automatically join user room
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Join room explicitly (e.g. trip or alert room)
    socket.on('join', ({ room, token }) => {
      if (room) {
        socket.join(room);
      }
    });

    socket.on('leave', ({ room }) => {
      if (room) {
        socket.leave(room);
      }
    });

    socket.on('disconnect', () => {
      // socket disconnected
    });
  });

  return io;
}

export function getIo() {
  return io;
}

export function emitToUser(userId, event, data) {
  if (io && userId) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToTrip(tripId, event, data) {
  if (io && tripId) {
    io.to(`trip:${tripId}`).emit(event, data);
  }
}

export function emitToAlert(alertId, event, data) {
  if (io && alertId) {
    io.to(`alert:${alertId}`).emit(event, data);
  }
}
