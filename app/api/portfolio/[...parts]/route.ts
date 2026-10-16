import {env} from 'cloudflare:workers';
import {portfolioApi} from '../../../../lib/portfolio-api';
export const dynamic='force-dynamic';
async function handle(request:Request,{params}:any){return portfolioApi(request,env,(await params).parts);}
export {handle as GET,handle as POST,handle as PUT,handle as PATCH};
