import {env} from 'cloudflare:workers';
import {getChatGPTUser,chatGPTSignInPath} from '../chatgpt-auth';
import {ownerAllowed} from '../../lib/portfolio-auth';
import Admin from './panel';
import './panel.css';
export const dynamic='force-dynamic';
export default async function AdminPage(){
 const user=await getChatGPTUser();
 const allowed=await ownerAllowed(user,env);
 if(!allowed)return <main className="login-page"><a className="admin-brand" href="/"><img src="/assets/brand/mark-lime.svg" width="66" height="46" alt=""/>Korney Kolokolnikov</a><div className="login-copy"><span className="eyebrow">Пространство для работы</span><h1>Мои проекты</h1><p>Загрузка сайтов, версии и ссылки для заказчиков. Вход доступен владельцу портфолио.</p>{user?<p className="notice error">У этого аккаунта нет доступа к управлению.</p>:null}<a className="btn primary" href={chatGPTSignInPath('/admin')} target="_top">Войти через ChatGPT</a><a className="quiet-link" href="/">Вернуться в портфолио</a></div></main>;
 return <Admin name={user?.displayName||'Корней'}/>;
}
