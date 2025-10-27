import axios from 'axios';
import { useState, useEffect } from 'react';
import config from '@/my.config';
import Image from 'next/image';
import { Users, MemoryStick, DatabaseZap, Cpu } from 'lucide-react';

const SectionOne = ({ socket, serverStatus }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState({
        status: 'offline',
        uptime: 0,
        running: false,
        ready: false
    });


    const fetchStatus = async () => {
        try {
            const response = await axios.get(`${config.backendUrl}/api/status`);
            const data = response.data;
            setStatus(data);
            onStatusChange?.(data.status);
        } catch (error) {
            console.error('Failed to fetch status:', error);
        }
    };

    return (
        <div className='mt-10'>
            <div>
                <div className='grid grid-cols-2 gap-4'>
                    <div className='grid grid-cols-2 gap-4 mb-10'>
                        <div className='bg-muted flex gap-4 items-center p-2 rounded-md px-6'>
                            <Users size={40} />
                            <span className='flext flex-col gap-1'>
                                <p className='text-lg font-bold'>Players Online</p>
                                <p className='text-sm'>0/20</p>
                            </span>
                        </div>
                        <div className='bg-muted flex gap-4 items-center p-2 rounded-md px-6'>
                            <DatabaseZap size={40} />
                            <span className='flext flex-col gap-1'>
                                <p className='text-lg font-bold'>Storage</p>
                                <p className='text-sm'>1.4 GB</p>
                            </span>
                        </div>
                        <div className='bg-muted flex gap-4 items-center p-2 rounded-md px-6'>
                            <MemoryStick size={40} />
                            <span className='flext flex-col gap-1'>
                                <p className='text-lg font-bold'>Memory Usage</p>
                                <p className='text-sm'>2456 MB</p>
                            </span>
                        </div>
                        <div className='bg-muted flex gap-4 items-center p-2 rounded-md px-6'>
                            <Cpu size={40} />
                            <span className='flext flex-col gap-1'>
                                <p className='text-lg font-bold'>CPU Usage</p>
                                <p className='text-sm'>0%</p>
                            </span>
                        </div>
                    </div>

                    <div className='relative flex items-center justify-center h-54'>
                        <div className="aspect-square h-[70%] rounded-full bg-purple-500 blur-3xl opacity-70"></div>
                        <Image
                            src="/minecraft-char.png"
                            alt="Banner"
                            width={400}
                            height={400}
                            className='absolute'
                        />
                    </div>
                </div>
                <div>
                    {/* player names div */}
                </div>
            </div>
            <div></div>
        </div>
    )
}

export default SectionOne;
