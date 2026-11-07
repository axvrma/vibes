import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import db, { initDb } from './db';
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import { errorHandler } from './middleware/error-handler';
import { recoverScans, stopScans } from './services/media-library';
import { trustedRoots } from './services/media-paths';
const app=express();
const port=Number(process.env.PORT||3000), host=process.env.HOST||'127.0.0.1';
if(process.env.NODE_ENV==='production' && (!process.env.AUTH_ACCESS_TOKEN_SECRET || process.env.AUTH_ACCESS_TOKEN_SECRET.length<32 || !process.env.AUTH_REFRESH_TOKEN_PEPPER || process.env.AUTH_REFRESH_TOKEN_PEPPER.length<32)) throw new Error('Production requires separate AUTH_ACCESS_TOKEN_SECRET and AUTH_REFRESH_TOKEN_PEPPER, each at least 32 characters');
trustedRoots(); // Validate configuration without requiring optional drives at startup.
app.set('trust proxy',process.env.TRUST_PROXY || 'loopback');
app.use(helmet({crossOriginResourcePolicy:{policy:'same-site'}}));
const origins=(process.env.CORS_ORIGIN||'http://localhost:4200,http://localhost:9001,http://127.0.0.1:9001').split(',').map(s=>s.trim());
if(origins.includes('*')) throw new Error('CORS_ORIGIN must list explicit origins');
app.use(cors({origin:(origin,cb)=>cb(null,!origin||origins.includes(origin)),credentials:true,exposedHeaders:['Content-Range','Accept-Ranges','Content-Length']}));
app.use(express.json({limit:'64kb'}));
// Never log media tickets, access tokens, cookies, or request bodies.
app.use(morgan((tokens,req,res)=>JSON.stringify({time:new Date().toISOString(),method:req.method,path:(req.url||'').split('?')[0],status:Number(tokens.status(req,res)||0),durationMs:Number(tokens['response-time'](req,res)||0)}),{skip:req=>req.path==='/api/health'}));
app.use(cookieParser());
// Cookie refresh endpoints are protected by SameSite=Strict plus an origin/Fetch-Metadata check.
app.use('/api/auth',(req,res,next)=>{
 if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
  const origin=req.get('origin');
  if((origin && !origins.includes(origin)) || req.get('sec-fetch-site')==='cross-site') {res.status(403).json({error:{code:'ORIGIN_REJECTED',message:'Cross-site authentication request rejected'}});return;}
 }
 next();
});
const dataDir=process.env.DATA_DIR||path.join(__dirname,'../../data');
for(const folder of ['uploads','thumbnails','.trash']) fs.mkdirSync(path.join(dataDir,folder),{recursive:true});
initDb();
app.get('/api/health',(_req,res)=>{db.prepare('SELECT 1').get();res.json({status:'ok',version:'2.3.0'});});
app.use('/api/auth',authRoutes);
app.use('/api',apiRoutes);
app.use(errorHandler);
recoverScans();
const server=app.listen(port,host,()=>console.log(`Vibes API listening on ${host}:${port}`));
async function shutdown() {
 const timeout=setTimeout(()=>process.exit(1),70000);timeout.unref();
 server.close();
 await stopScans();
 server.closeAllConnections();
 db.close();clearTimeout(timeout);
}
process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());
