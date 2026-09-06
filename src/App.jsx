import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { TurboFactory, InjectedEthereumSigner } from '@ardrive/turbo-sdk';

function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [userAddress, setUserAddress] = useState(null);
  const [turboClient, setTurboClient] = useState(null);
  const [status, setStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const connectWallet = useCallback(async () => {
    try {
      if (!window.ethereum) {
        throw new Error('Nav instalēts MetaMask!');
      }

      setStatus('⏳ Savieno maku...');

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      setUserAddress(address);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Pārslēdzas uz Base Sepolia
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x14a34' }]
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x14a34',
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: ['https://sepolia.basescan.org']
            }]
          });
        }
      }

      // Izveido Turbo klientu
      const client = TurboFactory.authenticated({
        signer: new InjectedEthereumSigner({ getSigner: () => signer }),
        token: 'base-eth',
        gatewayUrl: 'https://sepolia.base.org',
        uploadServiceConfig: { url: 'https://upload.services.ar-io.dev' },
        paymentServiceConfig: { url: 'https://payment.services.ar-io.dev' }
      });

      setTurboClient(client);
      setStatus('✅ Maks savienots: ' + address);

    } catch (error) {
      setStatus('❌ ' + error.message);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = useCallback(async () => {
    if (selectedFiles.length === 0 || !turboClient) return;

    setIsUploading(true);
    setStatus('⏳ Augšupielādē...');

    try {
      const uploadResults = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setStatus(`⏳ Augšupielādē ${i + 1}/${selectedFiles.length}: ${file.name}...`);

        let contentType = 'text/html';
        let fileType = 'restore-page';

        if (file.name === 'manifest.json') {
          contentType = 'application/x.arweave-manifest+json';
          fileType = 'path-manifest';
        } else if (file.name.endsWith('.css')) {
          contentType = 'text/css';
          fileType = 'style';
        } else if (file.name.endsWith('.js')) {
          contentType = 'application/javascript';
          fileType = 'script';
        }

        const result = await turboClient.uploadFile({
          fileStreamFactory: () => file.stream(),
          fileSizeFactory: () => file.size,
          dataItemOpts: {
            tags: [
              { name: 'App-Name', value: 'PermRepo' },
              { name: 'Type', value: fileType },
              { name: 'Content-Type', value: contentType },
              { name: 'Title', value: 'PermRepo Restore' }
            ]
          }
        });

        uploadResults.push({ name: file.name, txId: result.id });
      }

      // Izveido manifestu
      const manifest = {
        manifest: 'arweave/paths',
        version: '0.1.0',
        index: { path: 'restore.html' },
        paths: {}
      };

      for (const r of uploadResults) {
        manifest.paths[r.name] = { id: r.txId };
      }

      const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/x.arweave-manifest+json' });

      const manifestResult = await turboClient.uploadFile({
        fileStreamFactory: () => manifestBlob.stream(),
        fileSizeFactory: () => manifestBlob.size,
        dataItemOpts: {
          tags: [
            { name: 'App-Name', value: 'PermRepo' },
            { name: 'Type', value: 'path-manifest' },
            { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
            { name: 'Title', value: 'PermRepo Restore' }
          ]
        }
      });

      let resultText = '✅ Augšupielādēti faili:\n\n';
      for (const r of uploadResults) {
        resultText += `📄 ${r.name}\n${r.txId}\n\n`;
      }
      resultText += `📦 MANIFEST TX ID: ${manifestResult.id}\n\n`;
      resultText += `🌐 URL: https://ar-io.dev/${manifestResult.id}`;

      setStatus(resultText);
      setSelectedFiles([]);

    } catch (error) {
      setStatus('❌ ' + error.message);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFiles, turboClient]);

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px', background: '#0d1117', color: '#e6edf3', borderRadius: '12px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: '#79c0ff' }}>📤 Upload failus uz Arweave</h1>

      <div style={{ background: '#161b22', padding: '30px', borderRadius: '12px' }}>
        <div style={{ padding: '12px', marginBottom: '16px', background: '#0d1117', borderRadius: '8px', color: userAddress ? '#3fb950' : '#8b949e' }}>
          {userAddress ? `✅ Maks savienots: ${userAddress}` : '⚠️ Nav savienots maks'}
        </div>

        {!userAddress && (
          <button onClick={connectWallet} style={{ width: '100%', padding: '12px', background: '#21262d', color: '#fff', border: '1px solid #30363d', borderRadius: '8px', cursor: 'pointer', marginBottom: '16px' }}>
            🔗 Savienot maku
          </button>
        )}

        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => document.getElementById('fileInput').click()}
          style={{
            border: `2px dashed ${isDragging ? '#79c0ff' : '#30363d'}`,
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: '16px',
            background: isDragging ? 'rgba(121,192,255,0.1)' : 'transparent'
          }}
        >
          <p style={{ color: '#8b949e' }}>📁 Ievelc failus šeit</p>
          <p style={{ color: '#8b949e', fontSize: '12px' }}>vai noklikšķini, lai izvēlētos</p>
          <input type="file" id="fileInput" multiple style={{ display: 'none' }} onChange={(e) => setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)])} />
        </div>

        {selectedFiles.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            {selectedFiles.map((file, index) => (
              <div key={index} style={{ padding: '8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📄 {file.name} ({(file.size / 1024).toFixed(2)} KB)</span>
                <button onClick={() => removeFile(index)} style={{ padding: '4px 8px', background: '#f85149', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#fff' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={uploadFiles}
          disabled={selectedFiles.length === 0 || !turboClient || isUploading}
          style={{
            width: '100%',
            padding: '12px',
            background: selectedFiles.length > 0 && turboClient && !isUploading ? 'linear-gradient(135deg, #238636 0%, #1a7f37 50%, #238636 100%)' : '#30363d',
            color: selectedFiles.length > 0 && turboClient && !isUploading ? '#fff' : '#8b949e',
            border: 'none',
            borderRadius: '8px',
            cursor: selectedFiles.length > 0 && turboClient && !isUploading ? 'pointer' : 'not-allowed',
            fontSize: '16px'
          }}
        >
          {isUploading ? '⏳ Augšupielādē...' : 'Augšupielādēt un izveidot manifestu'}
        </button>

        {status && (
          <div style={{ marginTop: '20px', padding: '10px', wordBreak: 'break-all', whiteSpace: 'pre-wrap', color: status.startsWith('✅') ? '#3fb950' : status.startsWith('❌') ? '#f85149' : '#e6edf3' }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
