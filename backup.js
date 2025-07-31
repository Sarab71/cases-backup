require('dotenv').config();
const cors = require('cors');
const express = require('express'); // ✅ REQUIRED
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const port = process.env.PORT || 3000;

const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors({
  origin: 'https://casesbilling.vercel.app',
  methods: ['GET'],
}));

app.get('/', (req, res) => {
  res.send('✅ Backup server is running!');
});

app.get('/api/backup', async (req, res) => {
  try {
    const timestamp = Date.now();
    const backupDir = path.join(__dirname, 'backups');
    const dumpDir = path.join(backupDir, `dump-${timestamp}`);
    const zipPath = path.join(backupDir, `backup-${timestamp}.zip`);

    // ✅ Step 1: Clear old backups
    if (fs.existsSync(backupDir)) {
      fs.readdirSync(backupDir).forEach(file => {
        const filePath = path.join(backupDir, file);
        fs.rmSync(filePath, { recursive: true, force: true });
      });
    } else {
      fs.mkdirSync(backupDir);
    }

    // ✅ Step 2: Run mongodump
    const dumpCommand = `mongodump --uri="${MONGODB_URI}" --out="${dumpDir}"`;
    exec(dumpCommand, (error, stdout, stderr) => {
      if (error) {
        console.error('Backup failed:', stderr);
        return res.status(500).send('Backup failed');
      }

      // ✅ Step 3: Create zip
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        console.log(`Backup zipped: ${zipPath}`);
        res.download(zipPath, `mongodb-backup-${timestamp}.zip`);
      });

      archive.on('error', err => {
        console.error('Archive error:', err);
        res.status(500).send('Zip creation failed');
      });

      archive.pipe(output);
      archive.directory(dumpDir, false);
      archive.finalize();
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).send('Unexpected error occurred');
  }
});

app.listen(port, () => {
  console.log(`Backup server running at http://localhost:${port}`);
});
