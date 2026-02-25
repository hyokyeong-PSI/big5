import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if it exists, otherwise .env
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

// Google Sheets Auth
const getSheetsClient = () => {
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;
  let clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  // Fallback to JSON file if environment variables are missing
  const jsonKeyPath = path.join(__dirname, 'bigpro-488501-f02cdc55f79b.json');
  if ((!privateKey || !clientEmail) && fs.existsSync(jsonKeyPath)) {
    try {
      const keyFile = JSON.parse(fs.readFileSync(jsonKeyPath, 'utf8'));
      privateKey = keyFile.private_key;
      clientEmail = keyFile.client_email;
      console.log('Using service account key from JSON file fallback');
    } catch (e) {
      console.error('Failed to read JSON key file:', e);
    }
  }
  
  if (privateKey) {
    privateKey = privateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  }

  const credentials = {
    client_email: clientEmail,
    private_key: privateKey,
  };
  
  console.log(`Initializing Sheets API with client_email: ${clientEmail}`);
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  
  return google.sheets({ version: 'v4', auth });
};

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Helper for retrying Google API calls
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && error.status === 429) {
      console.log(`Rate limit hit, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    env: {
      hasSheetId: !!process.env.GOOGLE_SHEET_ID,
      hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL || 'using-json-fallback'
    }
  });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: '이름과 이메일을 입력해주세요.' });
    }

    const sheets = getSheetsClient();
    
    if (!SPREADSHEET_ID) {
      return res.status(500).json({ error: 'GOOGLE_SHEET_ID 환경 변수가 설정되지 않았습니다.' });
    }
    
    const response = await withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A:H', 
    }));

    const rows = response.data.values;
    
    if (rows && rows.length > 0) {
      console.log(`Sheet data fetched. Total rows: ${rows.length}`);
      // Log headers and first data row for debugging
      console.log('Header Row:', rows[0]);
      if (rows[1]) console.log('First Data Row (sanitized):', [rows[1][0] ? 'NameSet' : 'Empty', rows[1][1] ? 'EmailSet' : 'Empty']);
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: '데이터를 찾을 수 없습니다.' });
    }

    let userRowIndex = -1;
    let userData = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sheetName = (row[0] || '').toString().trim();
      const sheetEmail = (row[1] || '').toString().trim().toLowerCase();
      
      if (sheetName === name.trim() && sheetEmail === email.trim().toLowerCase()) {
        userRowIndex = i;
        userData = row;
        break;
      }
    }

    if (userRowIndex === -1 || !userData) {
      return res.status(401).json({ error: '등록된 사용자가 아닙니다.' });
    }

    const totalAllowed = parseInt(userData[5] || '0', 10);
    const remainingCount = parseInt(userData[7] || '0', 10); 

    if (totalAllowed < 1) {
      return res.status(403).json({ error: '사용 권한이 없습니다. (사용수량 부족)' });
    }

    if (remainingCount <= 0) {
      return res.status(403).json({ error: '결제를 먼저 진행해주세요. PSI컴파스 담당자 문의' });
    }

    res.json({
      success: true,
      user: {
        name,
        email,
        rowIndex: userRowIndex + 1,
        remainingCount
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/usage/increment', async (req, res) => {
  try {
    const { rowIndex } = req.body;
    if (!rowIndex) {
      return res.status(400).json({ error: 'rowIndex is required' });
    }

    if (!SPREADSHEET_ID) {
      return res.status(500).json({ error: 'GOOGLE_SHEET_ID 환경 변수가 설정되지 않았습니다.' });
    }

    const sheets = getSheetsClient();
    
    const getRes = await withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `G${rowIndex}`,
    }));
    
    const currentUsed = parseInt(getRes.data.values?.[0]?.[0] || '0', 10);
    const newUsed = currentUsed + 1;

    await withRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `G${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[newUsed]]
      }
    }));

    const getFRes = await withRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `F${rowIndex}`,
    }));
    const totalAllowed = parseInt(getFRes.data.values?.[0]?.[0] || '0', 10);
    const newRemaining = totalAllowed - newUsed;

    res.json({ success: true, newRemaining });
  } catch (error: any) {
    console.error('Increment error:', error);
    res.status(500).json({ error: '사용량 업데이트 중 오류가 발생했습니다.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
