import home from '../public/index.html?raw';
export function GET(){return new Response(home,{headers:{'Content-Type':'text/html; charset=utf-8'}});}
