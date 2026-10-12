import { createDb } from './db.js';
import { createApp } from './app.js';

const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const db = createDb(process.env.LAB_DB_PATH ?? './data/lab.sqlite');
createApp(db).listen(port, host, () => console.log(`Local lab API: http://${host}:${port}`));
