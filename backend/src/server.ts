import path from 'node:path';
import { buildApp } from './app';

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'app.db');
const port = parseInt(process.env.PORT ?? '3000', 10);

const { app } = buildApp(dbPath);
app.listen(port, () => {
  console.log(`Listening on :${port}`);
});
