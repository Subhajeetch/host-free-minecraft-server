'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from "sonner";
import { io } from 'socket.io-client';

// Create context
const ServerContext = createContext();

// Custom hook to use server context
export const useServerStatus = () => {
    const context = useContext(ServerContext);
    if (!context) {
        throw new Error('useServerStatus must be used within a ServerProvider');
    }
    return context;
};

// Axios instance with base configuration
const api = axios.create({
    baseURL: 'http://localhost:3000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error);

        if (error.code === 'ECONNREFUSED') {
            toast.error("Connection Failed", {
                description: "Cannot connect to server. Is it running?",
            });
        } else if (error.response?.status >= 500) {
            toast.error("Server Error", {
                description: "Internal server error occurred",
            });
        } else if (error.response?.status >= 400) {
            toast.error("Request Error", {
                description: error.response?.data?.message || "Bad request",
            });
        }

        return Promise.reject(error);
    }
);

export const ServerProvider = ({ children }) => {
    const [status, setStatus] = useState({
        status: 'offline',
        uptime: 0,
        running: false,
        ready: false,
        connections: null,
        playit: null,
        config: null,
        localIP: 'localhost',
        publicIP: null,
        javaPort: 25565,
        bedrockPort: 19132,
        serverName: 'MADE BY MANTO999'
    });

    const [loading, setLoading] = useState(false);
    const [socket, setSocket] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Refs to prevent memory leaks
    const fetchIntervalRef = useRef(null);
    const socketRef = useRef(null);

    // Fetch server status
    const fetchStatus = useCallback(async (showErrors = false) => {
        try {
            const response = await api.get('/status');
            const data = response.data;

            setStatus(prevStatus => {
                // Only update if there are actual changes to prevent unnecessary re-renders
                if (JSON.stringify(prevStatus) !== JSON.stringify(data)) {
                    return data;
                }
                return prevStatus;
            });

            return data;
        } catch (error) {
            if (showErrors) {
                toast.error("Status Update Failed", {
                    description: "Could not fetch server status",
                });
            }
            return null;
        }
    }, []);

    // Start server
    const startServer = useCallback(async () => {
        if (loading || status.status !== 'offline') return;

        setLoading(true);
        try {
            await api.post('/server/start');

            toast.success("Server Starting", {
                description: "Minecraft server is starting up...",
                duration: 3000,
            });

            // Fetch status immediately after starting
            setTimeout(() => fetchStatus(true), 1000);

        } catch (error) {
            toast.error("Start Failed", {
                description: "Could not start the server",
            });
        } finally {
            setLoading(false);
        }
    }, [loading, status.status, fetchStatus]);

    // Stop server
    const stopServer = useCallback(async () => {
        if (loading || status.status === 'offline') return;

        setLoading(true);
        try {
            await api.post('/server/stop');

            toast.success("Server Stopping", {
                description: "Minecraft server is shutting down...",
                duration: 3000,
            });

            // Fetch status immediately after stopping
            setTimeout(() => fetchStatus(true), 1000);

        } catch (error) {
            toast.error("Stop Failed", {
                description: "Could not stop the server",
            });
        } finally {
            setLoading(false);
        }
    }, [loading, status.status, fetchStatus]);

    // Send command to server
    const sendCommand = useCallback(async (command) => {
        if (!command || status.status !== 'online') return false;

        try {
            await api.post('/server/command', { command });

            toast.success("Command Sent", {
                description: `Executed: ${command}`,
                duration: 2000,
            });

            return true;
        } catch (error) {
            toast.error("Command Failed", {
                description: "Could not execute command",
            });
            return false;
        }
    }, [status.status]);

    // Refresh status manually
    const refreshStatus = useCallback(() => {
        fetchStatus(true);
        toast.success("Status Refreshed", {
            description: "Server status updated",
            duration: 1000,
        });
    }, [fetchStatus]);

    // Initialize socket connection
    useEffect(() => {
        if (!socketRef.current) {
            socketRef.current = io('http://localhost:3000', {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            const socketInstance = socketRef.current;

            socketInstance.on('connect', () => {
                console.log('🔗 Connected to server via WebSocket');
                setSocket(socketInstance);
            });

            socketInstance.on('disconnect', () => {
                console.log('❌ Disconnected from server');
            });

            socketInstance.on('new-log', (logEntry) => {
                setLogs(prev => [...prev.slice(-199), logEntry]); // Keep last 200 logs

                // Show important notifications
                if (logEntry.message.includes('SERVER IS NOW ONLINE')) {
                    toast.success("🎉 Server Online!", {
                        description: "Friends can now join your server!",
                        duration: 4000,
                    });
                }
            });

            socketInstance.on('recent-logs', (recentLogs) => {
                setLogs(recentLogs.slice(-199)); // Limit initial logs
            });

            socketInstance.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
            }
        };
    }, []);

    // Set up status polling
    useEffect(() => {
        // Initial fetch
        fetchStatus(true).then(() => {
            setIsInitialized(true);
        });

        // Set up polling interval
        fetchIntervalRef.current = setInterval(() => {
            fetchStatus(false); // Don't show errors for polling
        }, 2000);

        return () => {
            if (fetchIntervalRef.current) {
                clearInterval(fetchIntervalRef.current);
            }
        };
    }, [fetchStatus]);

    // Utility functions
    const getStatusColor = useCallback(() => {
        switch (status.status) {
            case 'online': return 'bg-green-500';
            case 'starting': return 'bg-yellow-500 animate-pulse';
            case 'stopping': return 'bg-gray-500';
            default: return 'bg-red-500';
        }
    }, [status.status]);

    const getStatusIcon = useCallback(() => {
        switch (status.status) {
            case 'online': return '✅';
            case 'starting': return '⚡';
            case 'stopping': return '⏸️';
            default: return '⏹️';
        }
    }, [status.status]);

    const formatUptime = useCallback((seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }, []);

    const isServerOnline = status.status === 'online';
    const isServerOffline = status.status === 'offline';

    const contextValue = {
        // State
        status,
        loading,
        socket,
        logs,
        isInitialized,

        // Actions
        startServer,
        stopServer,
        sendCommand,
        refreshStatus,
        fetchStatus,

        // Utilities
        getStatusColor,
        getStatusIcon,
        formatUptime,
        isServerOnline,
        isServerOffline,

        // Direct access to specific data
        connections: status.connections,
        playitStatus: status.playit,
        uptime: status.uptime,
        serverConfig: status.config,
    };

    return (
        <ServerContext.Provider value={contextValue}>
            {children}
        </ServerContext.Provider>
    );
};
