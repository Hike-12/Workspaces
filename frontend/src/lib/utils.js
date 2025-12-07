import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const isDevelopment = import.meta.env.DEV;

export const NODE_BASE_URL = import.meta.env.VITE_NODE_BASE_URL || "http://localhost:5000";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const API_ENDPOINTS = {
  LOGIN: `${NODE_BASE_URL}/api/auth/login`,
  REGISTER: `${NODE_BASE_URL}/api/auth/register`,
  CREATE_ROOM: `${NODE_BASE_URL}/api/rooms/create`,
  JOIN_ROOM: `${NODE_BASE_URL}/api/rooms/join`,
  LEAVE_ROOM: `${NODE_BASE_URL}/api/rooms/leave`,
  GET_ROOM: (roomId) => `${NODE_BASE_URL}/api/rooms/${roomId}`,
  
  GET_FILES: (roomId) => `${NODE_BASE_URL}/api/files/rooms/${roomId}/files`,
  UPLOAD_FILE: (roomId) => `${NODE_BASE_URL}/api/files/rooms/${roomId}/files/upload`,
  VIEW_FILE: (fileId) => `${NODE_BASE_URL}/api/files/${fileId}/view`,
  DELETE_FILE: (fileId) => `${NODE_BASE_URL}/api/files/${fileId}/delete`,
  
  GET_MESSAGES: `${NODE_BASE_URL}/api/messages/messages`,
  SEND_MESSAGE: `${NODE_BASE_URL}/api/messages/messages`
};