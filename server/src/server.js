import { startServer } from './app.js';
import { closeDatabase } from './db/database.js';

const PORT = process.env.PORT || 4000;

startServer().then((app) => {
  const server = app.listen(PORT, () => {
    console.log(`ShopEasy server is running on http://localhost:${PORT}`);
  });

  const shutdown = () => {
    server.close(async (error) => {
      if (error) {
        console.error('Failed to stop HTTP server cleanly:', error.message);
        process.exitCode = 1;
      }
      try {
        await closeDatabase();
      } catch (closeError) {
        console.error('Failed to close SQLite database:', closeError.message);
        process.exitCode = 1;
      }
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
