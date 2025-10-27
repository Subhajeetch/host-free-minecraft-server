'use client';

import { useServerStatus } from '@/contexts/ServerContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Square, RotateCcw, Loader2, Clock9 } from 'lucide-react';
import Image from 'next/image';

export default function Header() {
    const {
        status,
        loading,
        startServer,
        stopServer,
        refreshStatus,
        getStatusColor,
        getStatusIcon,
        formatUptime,
        isServerOnline,
        isServerOffline
    } = useServerStatus();

    return (
        <header className="w-full bg-muted backdrop-blur-xl border-b border-border sticky top-0 z-50">
            <div className="container mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo and Title */}
                    <div className="flex items-center gap-4">
                        <Image
                            src="/mc-logo.svg"
                            alt="MineHost Logo"
                            width={40}
                            height={40}
                        />
                        <div className='flex flex-col gap-0.5'>
                            <h1 className="text-2xl font-bold text-white">{status?.config?.serverName ? status?.config?.serverName : 'Loading...'}</h1>
                            {status.uptime > 0 && (
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock9 size={14} /> {formatUptime(status.uptime)}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Server Status Indicator */}
                    <div className="flex items-center gap-4">
                        {/* Status Indicator */}
                        <Badge variant={"outline"} className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
                            <div className="text-right">
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-bold uppercase">
                                        {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                                    </span>
                                </div>

                            </div>
                        </Badge>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={startServer}
                                disabled={!isServerOffline || loading}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 h-8"
                            >
                                {loading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Play className="w-3 h-3" />
                                )}
                            </Button>

                            <Button
                                onClick={stopServer}
                                disabled={isServerOffline || loading}
                                variant="destructive"
                                size="sm"
                                className="h-8"
                            >
                                <Square className="w-3 h-3" />
                            </Button>

                            <Button
                                onClick={refreshStatus}
                                variant="outline"
                                size="sm"
                                className="h-8 border-white/20 text-white hover:bg-white/10"
                            >
                                <RotateCcw className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
