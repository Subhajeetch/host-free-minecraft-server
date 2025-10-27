'use client';

import { useState, useEffect } from 'react';
import { Play, RotateCcw, Loader2, Power, Check, Shell, Users, Workflow, ChevronRight, UserX, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import ConnectionInfo from '@/components/ConnectionInfo';
import CommandComponent from '@/components/commands';

export default function ServerStatus({ socket, onStatusChange }) {
    const [status, setStatus] = useState({
        status: 'offline',
        uptime: 0,
        running: false,
        ready: false
    });
    const [loading, setLoading] = useState(false);

    const fetchStatus = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/status');
            const data = await response.json();
            setStatus(data);
            onStatusChange?.(data.status);
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    };

    const handleStart = async () => {
        setLoading(true);
        try {
            await fetch('http://localhost:3000/api/server/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            await fetchStatus();
        } catch (error) {
            console.error('Failed to start server:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        setLoading(true);
        try {
            await fetch('http://localhost:3000/api/server/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            await fetchStatus();
        } catch (error) {
            console.error('Failed to stop server:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = () => {
        switch (status.status) {
            case 'online': return 'bg-[#108800]';
            case 'starting': return 'bg-yellow-500 animate-pulse animate-spin';
            case 'stopping': return 'bg-gray-500 animate-pulse animate-spin';
            default: return 'bg-red-500';
        }
    };

    const getStatusIcon = () => {
        switch (status.status) {
            case 'online': return <Check />;
            case 'starting': return <Shell />;
            case 'stopping': return <Shell />;
            default: return <Power />;
        }
    };

    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    };


    const players = [

    ]


    return (
        <section className='flex gap-8 mt-22'>
            <Card className="flex-1">
                <CardHeader className="text-center flex flex-col items-center justify-center">
                    <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl ${getStatusColor()}`}>
                        {getStatusIcon()}
                    </div>

                    <Badge className="px-8 py-1 text-[18px] font-bold" variant={status.status === 'online' ? 'default' : 'secondary'}>
                        {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                    </Badge>
                    {status.uptime > 0 && (
                        <p className="text-gray-300">
                            Uptime: {formatUptime(status.uptime)}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <div className="flex gap-3 justify-center flex-wrap">
                        <Button
                            onClick={handleStart}
                            disabled={status.status !== 'offline' || loading}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                            Start Server
                        </Button>

                        <Button
                            onClick={handleStop}
                            disabled={status.status === 'offline' || loading}
                            variant="destructive"
                        >
                            <Power className="w-4 h-4 mr-2" />
                            Stop Server
                        </Button>

                        <Button onClick={fetchStatus} variant="outline" className="bg-muted">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className='border max-w-[500px] w-full p-0 overflow-hidden gap-0'>
                <div className='flex items-center bg-muted px-4 py-2'>
                    <Workflow size={24} />
                    <p className='text-[18px] ml-4 font-extrabold'>Actions & Info</p>
                </div>

                <div className='p-2'>
                    {status.status === 'online' ? (
                        <div className='flex flex-col gap-4'>
                            <div className='flex flex-col gap-3'>
                                <div className='flex  items-center'>
                                    <img src="/dia-sword.gif" alt="Diamond Sword" className='h-9 w-9 bg-muted p-1 rounded-md' />
                                    <p className='text-[17px] font-semibold ml-3'>Connection Info</p>
                                </div>

                                <div className='px-4'>
                                    <ConnectionInfo />
                                </div>
                            </div>

                            <div className='flex flex-col gap-3'>
                                <div className='flex gap-2 items-center'>
                                    <Settings size={26} />
                                    <p className='text-[17px] font-semibold'>Actions</p>
                                </div>

                                <div className='px-4'>
                                    <CommandComponent serverStatus={status.status} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className='p-4 space-y-4'>
                            <div className='flex items-center justify-between'>
                                <p className='text-sm font-medium'>Server is currently offline.</p>
                                <Power className='text-red-500' />
                            </div>
                            <div className='flex items-center justify-between'>
                                <p className='text-sm font-medium'>Start the server to begin hosting.</p>
                                <Play className='text-gray-400' />
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <Card className='border max-w-[400px] w-full p-0 overflow-hidden flex flex-col gap-0 h-[310px]'>
                <div className='flex items-center bg-muted px-4 py-2'>
                    <Users size={24} />
                    <p className='text-[18px] ml-4 font-extrabold'>Players</p>
                    <ChevronRight />
                </div>

                <div className='max-h-full overflow-auto'>
                    {players?.length === 0 && (
                        <div className='flex flex-col w-full items-center justify-center mt-14'>

                            {status.status === "offline" ? (
                                <Power size={40} className='mx-auto text-gray-400' />
                            ) : (
                                <UserX size={40} className='mx-auto text-gray-400' />
                            )}

                            {status.status === 'offline' ? (
                                <p className='text-gray-400 text-sm text-center py-4 font-semibold'>Server is offline.</p>
                            ) : (
                                <p className='text-gray-400 text-sm text-center py-4 font-semibold'>No players online right now!</p>
                            )}
                        </div>
                    )}
                    {players.map((player, index) => (
                        <div key={index} className='flex gap-3 items-center px-4 py-2 hover:bg-accent/50'>
                            <img src={`https://minotar.net/avatar/${player.username}`} alt={player.username} className='h-6 w-6' />
                            <p className='text-[14px] font-semibold'>{player.username}</p>
                        </div>
                    ))}
                </div>

            </Card>
        </section>
    );
}
