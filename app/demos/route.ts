// /demos/ is routed to the worker first (vite.config.ts: run_worker_first "/demos/*"), so the static
// directory page never reached visitors (404); served here the way app/route.ts serves the home page.
import directory from '../../public/demos/index.html?raw';
export function GET(){return new Response(directory,{headers:{'Content-Type':'text/html; charset=utf-8'}});}
