const os = require('os');
const https = require('https');

class NetworkUtils {
    constructor() {
        this.publicIP = null;
    }

    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const networkInterface of interfaces[name]) {
                if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                    return networkInterface.address;
                }
            }
        }
        return 'localhost';
    }

    async getPublicIP() {
        if (this.publicIP) {
            return this.publicIP;
        }

        return new Promise((resolve) => {
            try {
                const options = {
                    hostname: 'api.ipify.org',
                    port: 443,
                    path: '/',
                    method: 'GET'
                };

                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        this.publicIP = data.trim();
                        resolve(this.publicIP);
                    });
                });

                req.on('error', (error) => {
                    console.log(`Could not detect public IP: ${error.message}`);
                    this.publicIP = 'Unable to detect';
                    resolve(this.publicIP);
                });

                req.end();
            } catch (error) {
                this.publicIP = 'Unable to detect';
                resolve(this.publicIP);
            }
        });
    }

    getPublicIP() {
        return this.publicIP;
    }
}

module.exports = NetworkUtils;
