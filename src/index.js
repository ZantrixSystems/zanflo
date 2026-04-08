import { handleApplicationRoutes } from './routes/applications.js';

export default {
  async fetch(request, env) {
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
