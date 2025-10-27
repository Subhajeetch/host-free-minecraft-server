'use client';

import { useState, useEffect } from 'react';
import { Send, Terminal as TerminalIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AnimatedSpan,
    Terminal,
    TypingAnimation,
} from "@/components/ui/terminal";

export default function ServerConsole({ socket, serverStatus }) {
    const [logs, setLogs] = useState([]);
    const [command, setCommand] = useState('');
    const [currentInput, setCurrentInput] = useState('');
    const [showTyping, setShowTyping] = useState(false);

    useEffect(() => {
        if (!socket) return;

        socket.on('new-log', (logEntry) => {
            setLogs(prev => [...prev.slice(-99), logEntry]); // Keep fewer logs for better performance
        });

        socket.on('recent-logs', (recentLogs) => {
            setLogs(recentLogs.slice(-99)); // Limit initial logs
        });

        return () => {
            socket.off('new-log');
            socket.off('recent-logs');
        };
    }, [socket]);

    const sendCommand = async (cmd) => {
        const commandToSend = cmd || command;
        if (!commandToSend || serverStatus !== 'online') return;

        // Show the command being typed in terminal
        setCurrentInput(`> ${commandToSend}`);
        setShowTyping(true);

        try {
            await fetch('http://localhost:3000/api/server/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: commandToSend })
            });
            if (!cmd) setCommand('');

            // Hide typing animation after command is sent
            setTimeout(() => {
                setShowTyping(false);
                setCurrentInput('');
            }, 1000);
        } catch (error) {
            console.error('Failed to send command:', error);
            setShowTyping(false);
            setCurrentInput('');
        }
    };

    const getLogColor = (type) => {
        switch (type) {
            case 'error': return 'text-red-400';
            case 'warn': return 'text-yellow-400';
            case 'success': return 'text-green-400';
            case 'player': return 'text-blue-400';
            case 'world': return 'text-purple-400';
            default: return 'text-green-300';
        }
    };

    const getLogIcon = (type) => {
        switch (type) {
            case 'error': return '❌';
            case 'warn': return '⚠️';
            case 'success': return '✅';
            case 'player': return '👤';
            case 'world': return '🌍';
            default: return 'ℹ️';
        }
    };

    const isServerOnline = serverStatus === 'online';

    return (
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                    <TerminalIcon className="w-5 h-5" />
                    Server Console
                    <Badge variant={isServerOnline ? 'default' : 'secondary'}>
                        {isServerOnline ? 'Online' : 'Offline'}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {/* Terminal with proper height and scrolling */}
                <Terminal
                    className="mb-4"
                    sequence={false}
                    height="320px"
                >
                    {/* Server Status Message */}
                    {!isServerOnline && (
                        <TypingAnimation className="text-yellow-400" startOnView={false}>
                            🎮 Minecraft Server Console - Server is offline
                        </TypingAnimation>
                    )}

                    {isServerOnline && logs.length === 0 && (
                        <TypingAnimation className="text-green-400" startOnView={false}>
                            🎮 Minecraft Server Console - Ready for commands
                        </TypingAnimation>
                    )}

                    {/* Display logs */}
                    {logs.map((log, index) => (
                        <AnimatedSpan
                            key={`${log.timestamp}-${index}`}
                            className={`${getLogColor(log.type)}`}
                            startOnView={false}
                        >
                            <span className="text-gray-500 text-xs mr-2">[{log.time}]</span>
                            <span>
                                {getLogIcon(log.type)} {log.message}
                            </span>
                        </AnimatedSpan>
                    ))}

                    {/* Show current command being typed */}
                    {showTyping && currentInput && (
                        <TypingAnimation className="text-blue-400" startOnView={false}>
                            {currentInput}
                        </TypingAnimation>
                    )}

                    {/* Interactive prompt */}
                    {isServerOnline && !showTyping && (
                        <AnimatedSpan className="text-green-400" startOnView={false}>
                            <span className="mr-2">minecraft@server:~$</span>
                            <span className="text-gray-400 opacity-70">
                                Waiting for command...
                            </span>
                        </AnimatedSpan>
                    )}
                </Terminal>

                {/* Command Input */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Enter server command (e.g., say Hello World)"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendCommand()}
                        disabled={!isServerOnline}
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 font-mono"
                    />
                    <Button
                        onClick={() => sendCommand()}
                        disabled={!isServerOnline || showTyping}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <Send className="w-4 h-4 mr-2" />
                        Send
                    </Button>
                </div>

                {/* Helper text */}
                <div className="mt-2 text-xs text-gray-400 font-mono">
                    {isServerOnline
                        ? "💡 Server is online - Commands will be executed immediately"
                        : "⚠️ Server is offline - Start the server to send commands"
                    }
                </div>
            </CardContent>
        </Card>
    );
}
