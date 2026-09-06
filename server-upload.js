import express from 'express';
import { TurboFactory } from '@ardrive/turbo-sdk';
import { Readable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const TURBO_TOKEN = process.env.TURBO_TOKEN || 'base-eth';
const TURBO_UPLOAD_URL = process.env.TURBO_UPLOAD_URL || 'https://upload.services.ar-io.dev';
const TURBO_PAYMENT_URL = process.env.TURBO_PAYMENT_URL || 'https://payment.services.ar-io.dev';
const GATEWAY_URL = process.env.GATEWAY_URL || 'https://sepolia.base.org';

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Jauns endpoints: serveris saņem lietotāja parakstīto transakciju
app.post('/api/upload-signed', async (req, res) => {
    try {
        const { signedDataItem } = req.body;
        
        if (!signedDataItem) {
            return res.status(400).json({ success: false, error: 'Nav parakstīta data item' });
        }
        
        // Serveris izmanto UNAUTHENTICATED Turbo klientu
        const turbo = TurboFactory.unauthenticated({
            token: TURBO_TOKEN,
            uploadServiceConfig: { url: TURBO_UPLOAD_URL },
            paymentServiceConfig: { url: TURBO_PAYMENT_URL }
        });
        
        // Augšupielādē jau parakstīto data item
        const result = await turbo.uploadSignedDataItem({
            dataItemStreamFactory: () => Readable.from(Buffer.from(signedDataItem, 'base64')),
            dataItemSizeFactory: () => Buffer.from(signedDataItem, 'base64').length,
        });
        
        res.json({ success: true, txId: result.id });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
});

app.listen(PORT, () => {
    console.log(`Upload serveris uz porta ${PORT} (bez privātās atslēgas!)`);
});
