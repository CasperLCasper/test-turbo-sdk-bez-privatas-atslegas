import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    
    let filePath = path.join(PUBLIC_DIR, url === '/' ? 'index.html' : url);
    
    if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found: ' + url);
            return;
        }
        
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.svg': 'image/svg+xml',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon'
        };
        
        res.writeHead(200, { 
            'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 STATISKO FAILU SERVERIS');
    console.log('='.repeat(60));
    console.log(`   Ports: ${PORT}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Mape: ${PUBLIC_DIR}`);
    console.log('='.repeat(60) + '\n');
});
