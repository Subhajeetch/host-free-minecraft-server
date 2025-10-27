'use client';
import { Space_Grotesk } from 'next/font/google'
import { useState, useEffect } from 'react';
import ServerStatus from '@/components/ServerStatus';
import ConnectionInfo from '@/components/ConnectionInfo';
import ServerConsole from '@/components/ServerConsole';
import SectionOne from '@/components/SectionOne';
import { io } from 'socket.io-client';


const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700']
})


export default function Home() {
  const [socket, setSocket] = useState(null);
  const [serverStatus, setServerStatus] = useState('offline');

  useEffect(() => {
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return () => newSocket.close();
  }, []);

  return (
    <main className={`${spaceGrotesk.className} min-h-screen bg-background`}>
      <div className="container mx-auto px-6 py-8 space-y-8">

        <SectionOne socket={socket} onStatusChange={setServerStatus} />


        {/* Server Status */}
        <ServerStatus socket={socket} onStatusChange={setServerStatus} />


        {/* Server Console */}
        <div className="space-y-4">
          <ServerConsole socket={socket} serverStatus={serverStatus} />
        </div>
      </div>
    </main>
  );
}
