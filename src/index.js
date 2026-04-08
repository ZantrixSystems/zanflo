import { handleApplicationRoutes } from './routes/applications.js';
import { runMigrations } from './migrations.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Temporary migration runner — will be removed after first use
    if (url.pathname === '/_migrate' && request.method === 'POST') {
      try {
        const result = await runMigrations(env);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    try {
      return await handleApplicationRoutes(request, env);
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
