const fs = require('fs');
const path = require('path');

class FileUtils {
    static async copyDirectory(src, dest) {
        return new Promise((resolve, reject) => {
            try {
                FileUtils.copyDirectorySync(src, dest);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    static copyDirectorySync(src, dest) {
        const stats = fs.statSync(src);
        if (stats.isDirectory()) {
            fs.mkdirSync(dest, { recursive: true });
            const files = fs.readdirSync(src);
            files.forEach(file => {
                FileUtils.copyDirectorySync(path.join(src, file), path.join(dest, file));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    }

    static async removeDirectory(dirPath) {
        return new Promise((resolve, reject) => {
            try {
                if (fs.existsSync(dirPath)) {
                    fs.rmSync(dirPath, { recursive: true, force: true });
                }
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }
}

module.exports = FileUtils;
