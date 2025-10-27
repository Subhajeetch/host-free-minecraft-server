'use client';

import { useState } from 'react';
import { Sun, Cloud } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";

export default function CommandComponent({ serverStatus }) {
    const [isExecuting, setIsExecuting] = useState(false);

    const executeCommand = async (command) => {
        if (serverStatus !== 'online' || isExecuting) return;

        setIsExecuting(true);

        try {
            const response = await fetch('http://localhost:3000/api/server/command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            if (response.ok) {
                toast.success("Command executed!", {
                    description: `Successfully executed: ${command}`,
                    duration: 2000,
                });
            } else {
                throw new Error(`Failed to execute command: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Failed to send command:', error);
            toast.error("Command failed", {
                description: `Failed to execute: ${command}`,
                duration: 3000,
            });
        } finally {
            setIsExecuting(false);
        }
    };

    const isServerOnline = serverStatus === 'online';

    return (
        <div>
            <div className="flex flex-wrap gap-2">
                <Button
                    onClick={() => executeCommand('time set day')}
                    disabled={!isServerOnline || isExecuting}
                    size="sm"
                >
                    <Sun className="w-4 h-4 mr-2" />
                    {isExecuting ? 'Executing...' : 'Set Day'}
                </Button>
                <Button
                    onClick={() => executeCommand('weather clear')}
                    disabled={!isServerOnline || isExecuting}
                    size="sm"
                >
                    <Cloud className="w-4 h-4 mr-2" />
                    {isExecuting ? 'Executing...' : 'Clear Weather'}
                </Button>
            </div>
        </div>
    );
}
