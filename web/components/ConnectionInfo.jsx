'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Copy, Wifi, Globe, Home, Server, Smartphone, LaptopMinimal, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from "sonner";

export default function ConnectionInfo() {
    const [connections, setConnections] = useState(null);
    const [playitStatus, setPlayitStatus] = useState(null);
    const [javaDialogOpen, setJavaDialogOpen] = useState(false);
    const [bedrockDialogOpen, setBedrockDialogOpen] = useState(false);

    const fetchConnections = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:3000/api/status');
            const data = await response.json();
            if (data.status === 'online' && data.connections) {
                // Only update state if data has actually changed to prevent unnecessary re-renders
                setConnections(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(data.connections)) {
                        return data.connections;
                    }
                    return prev;
                });
                setPlayitStatus(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(data.playit)) {
                        return data.playit;
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error('Failed to fetch connections:', error);
        }
    }, []);

    const copyToClipboard = useCallback(async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard!", {
                description: `${text}`,
                duration: 2000,
            });
        } catch (error) {
            toast.error("Failed to copy", {
                description: "Could not copy to clipboard",
                duration: 2000,
            });
        }
    }, []);

    // Helper function to parse address and port for Bedrock
    const parseBedrockAddress = useCallback((address) => {
        if (!address) return { address: '', port: '' };
        const parts = address.split(':');
        return {
            address: parts[0] || '',
            port: parts[1] || ''
        };
    }, []);

    useEffect(() => {
        fetchConnections();
        const interval = setInterval(fetchConnections, 3000);
        return () => clearInterval(interval);
    }, [fetchConnections]);

    // Memoize the ConnectionTab component to prevent unnecessary re-renders
    const ConnectionTab = useMemo(() => ({ title, icon: Icon, address, isJava = true, status }) => {
        const bedrockData = !isJava ? parseBedrockAddress(address) : null;

        return (
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                <CardHeader className="pb-3 flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg text-white">
                        <Icon className="w-5 h-5" />
                        {title}
                    </CardTitle>
                    {status && (
                        <Badge variant={status === 'active' ? 'default' : 'secondary'} className="w-fit">
                            {status.toUpperCase()}
                        </Badge>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    {isJava ? (
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-yellow-400">Server Address:</p>
                            <div className="flex items-center gap-2 p-2 bg-black/30 rounded-md font-mono text-sm">
                                <span className="flex-1 break-all text-white">{address}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(address)}
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                >
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-yellow-400">Server Address:</p>
                                <div className="flex items-center gap-2 p-2 bg-black/30 rounded-md font-mono text-sm">
                                    <span className="flex-1 break-all text-white">{bedrockData.address}</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard(bedrockData.address)}
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-yellow-400">Port:</p>
                                <div className="flex items-center gap-2 p-2 bg-black/30 rounded-md font-mono text-sm">
                                    <span className="flex-1 break-all text-white">{bedrockData.port}</span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard(bedrockData.port)}
                                        className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }, [copyToClipboard, parseBedrockAddress]);

    // Memoize ConnectionDialog to prevent re-renders when dialogs are open
    const ConnectionDialog = useMemo(() => ({
        isOpen,
        onOpenChange,
        title,
        description,
        isJava = true
    }) => (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-[#00880713] backdrop-blur-lg border-white/20">
                <DialogHeader>
                    <DialogTitle className="text-white">{title}</DialogTitle>
                    <DialogDescription className="text-gray-300">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="local" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-white/10">
                        <TabsTrigger value="local" className="data-[state=active]:bg-white/20">
                            Local
                        </TabsTrigger>
                        <TabsTrigger value="network" className="data-[state=active]:bg-white/20">
                            Network
                        </TabsTrigger>
                        <TabsTrigger value="public" className="data-[state=active]:bg-white/20">
                            Public
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="local" className="mt-4">
                        <ConnectionTab
                            title="Local Access"
                            icon={Home}
                            address={isJava ? connections?.local?.java : connections?.local?.bedrock}
                            isJava={isJava}
                        />
                        <p className="text-sm text-gray-400 mt-2">
                            Use this address when connecting from the same computer where the server is running.
                        </p>
                    </TabsContent>

                    <TabsContent value="network" className="mt-4">
                        <ConnectionTab
                            title="Network Access"
                            icon={Wifi}
                            address={isJava ? connections?.network?.java : connections?.network?.bedrock}
                            isJava={isJava}
                        />
                        <p className="text-sm text-gray-400 mt-2">
                            Use this address when connecting from other devices on your WiFi network.
                        </p>
                    </TabsContent>

                    <TabsContent value="public" className="mt-4">
                        <ConnectionTab
                            title="Public Access (Playit.gg)"
                            icon={Globe}
                            address={
                                isJava
                                    ? playitStatus?.addresses?.java || (playitStatus?.installed ? 'Setting up tunnels...' : 'Playit.gg not installed')
                                    : playitStatus?.addresses?.bedrock || (playitStatus?.installed ? 'Setting up tunnels...' : 'Playit.gg not installed')
                            }
                            isJava={isJava}
                            status={playitStatus?.tunnelsActive ? 'active' : playitStatus?.installed ? 'setting up' : 'not available'}
                        />
                        <p className="text-sm text-gray-400 mt-2">
                            Use this address when connecting from anywhere on the internet. Requires Playit.gg tunnel to be active.
                        </p>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    ), [ConnectionTab, connections, playitStatus]);

    if (!connections) return null;

    return (
        <div className="flex gap-4 justify-center w-full">
            {/* Java Edition Button */}
            <Dialog open={javaDialogOpen} onOpenChange={setJavaDialogOpen}>
                <DialogTrigger asChild className="flex-1">
                    <Button
                        variant="outline"
                        className="bg-white/10 backdrop-blur-lg border-white/20 text-white hover:bg-white/20 flex items-center gap-2 px-6 py-3"
                    >
                        <LaptopMinimal className="w-5 h-5" />
                        Java Edition
                        <ChevronRight />
                    </Button>
                </DialogTrigger>
                <ConnectionDialog
                    isOpen={javaDialogOpen}
                    onOpenChange={setJavaDialogOpen}
                    title="Java Edition Connection Info"
                    description="Choose how you want to connect to the Minecraft Java Edition server."
                    isJava={true}
                />
            </Dialog>

            {/* Bedrock Edition Button */}
            <Dialog open={bedrockDialogOpen} onOpenChange={setBedrockDialogOpen}>
                <DialogTrigger asChild className="flex-1">
                    <Button
                        variant="outline"
                        className="bg-white/10 backdrop-blur-lg border-white/20 text-white hover:bg-white/20 flex items-center gap-2 px-6 py-3"
                    >
                        <Smartphone className="w-5 h-5" />
                        Bedrock Edition
                        <ChevronRight />
                    </Button>
                </DialogTrigger>
                <ConnectionDialog
                    isOpen={bedrockDialogOpen}
                    onOpenChange={setBedrockDialogOpen}
                    title="Bedrock Edition Connection Info"
                    description="Choose how you want to connect to the Minecraft Bedrock Edition server. Address and port are shown separately for easy input."
                    isJava={false}
                />
            </Dialog>
        </div>
    );
}
