import { beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import * as jose from 'jose';
import fs from 'fs';
import path from 'path';
import db,{initDb} from '../db';
import apiRoutes from './api';
import { errorHandler } from '../middleware/error-handler';
import { videoRepo,stateRepo } from '../db/repository';
const app=express();app.use(express.json());app.use('/api',apiRoutes);app.use(errorHandler);
let admin='',viewer='',inactive='';
const token=async(id:string)=>new jose.SignJWT({}).setSubject(id).setProtectedHeader({alg:'HS256'}).setIssuer('reels-private-media').setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_ACCESS_TOKEN_SECRET));
beforeAll(async()=>{
 initDb();
 for(const [id,role,active] of [['admin','admin',1],['viewer','viewer',1],['inactive','viewer',0]]) db.prepare('INSERT INTO users(id,email,password_hash,role,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(id,`${id}@example.test`,'hash',role,active,'now','now');
 admin=await token('admin');viewer=await token('viewer');inactive=await token('inactive');
 db.prepare("INSERT INTO categories(id,name,slug,color,created_at,updated_at) VALUES ('cat','Cat','cat','#8957ff','now','now')").run();
 for(let i=0;i<55;i++) videoRepo.create({id:`v${i}`,title:`Video ${i}`,original_filename:`v${i}.mp4`,storage_key:`v${i}.mp4`,size_bytes:10,category_id:i===54?undefined:'cat',created_at:new Date(2026,0,i+1).toISOString(),updated_at:'now'});
 fs.writeFileSync(path.join(process.env.DATA_DIR!,'uploads','v0.mp4'),'0123456789');
});
const get=(url:string,auth=admin)=>request(app).get(url).set('Authorization',`Bearer ${auth}`);
describe('real authenticated API',()=>{
 it('rejects unauthenticated, query bearer and inactive users',async()=>{
  expect((await request(app).get('/api/summary')).status).toBe(401);
  expect((await request(app).get(`/api/videos?token=${admin}`)).status).toBe(401);
  expect((await get('/api/videos',inactive)).status).toBe(401);
 });
 it('restricts admin operations',async()=>{expect((await get('/api/summary',viewer)).status).toBe(403);expect((await get('/api/libraries',viewer)).status).toBe(403);});
 it('serves bounded pages and category assignments',async()=>{
  const result=await get('/api/videos?limit=20&page=2');expect(result.status).toBe(200);expect(result.body.videos).toHaveLength(20);expect(result.body.pagination.total).toBe(55);
  expect((await get('/api/videos?categoryId=cat&limit=100',viewer)).body.videos).toHaveLength(54);
  expect((await get('/api/videos?limit=1000')).status).toBe(400);
 });
 it('filters search, favorites and source',async()=>{
  expect((await get('/api/videos?search=Video%2054')).body.videos).toHaveLength(1);
  stateRepo.upsertState({user_id:'admin',video_id:'v0',liked:1,note:'private',progress_seconds:4,updated_at:'now'});
  expect((await get('/api/videos?collection=favorites')).body.videos[0].id).toBe('v0');
  expect((await get('/api/videos?source=external')).body.videos).toHaveLength(0);
 });
 it('merges partial state without erasing likes or progress',async()=>{
  const res=await request(app).put('/api/videos/v0/state').set('Authorization',`Bearer ${admin}`).send({note:'edited'});expect(res.status).toBe(200);
  expect(stateRepo.getState('admin','v0')).toMatchObject({liked:1,note:'edited',progress_seconds:4});
  expect((await get('/api/videos/v0/state',viewer)).body.note).toBe('');
 });
 it('checks media and state authorization for inactive categories',async()=>{
  expect((await get('/api/videos/v54/stream',viewer)).status).toBe(404);
  expect((await request(app).put('/api/videos/v54/state').set('Authorization',`Bearer ${viewer}`).send({note:'x'})).status).toBe(404);
 });
 it('streams full, suffix, open and bounded ranges from uploads',async()=>{
  const full=await get('/api/videos/v0/stream');expect(full.status).toBe(200);expect(full.headers['content-length']).toBe('10');
  for(const [range,contentRange,len] of [['bytes=2-4','bytes 2-4/10','3'],['bytes=-3','bytes 7-9/10','3'],['bytes=8-','bytes 8-9/10','2'],['bytes=8-999','bytes 8-9/10','2']]) {const res=await get('/api/videos/v0/stream').set('Range',range);expect(res.status).toBe(206);expect(res.headers['content-range']).toBe(contentRange);expect(res.headers['content-length']).toBe(len);}
 });
 it('rejects invalid ranges',async()=>{for(const range of ['bytes=99-','bytes=4-2','bytes=-0','bytes=a-b','bytes=0-1,3-4']) expect((await get('/api/videos/v0/stream').set('Range',range)).status).toBe(416);});
 it('issues short scoped media tickets that cannot authorize API or another resource',async()=>{
  const issued=await request(app).post('/api/videos/v0/media-ticket').set('Authorization',`Bearer ${admin}`).send({kind:'stream'});
  expect(issued.status).toBe(200);const url=issued.body.url;
  expect((await request(app).get(url)).status).toBe(200);
  expect((await request(app).get(url.replace('/v0/','/v1/'))).status).toBe(401);
  expect((await request(app).get(url.replace('/stream','/thumbnail'))).status).toBe(401);
  const ticket=new URL(`http://localhost${url}`).searchParams.get('ticket');
  expect((await request(app).get(`/api/summary?ticket=${ticket}`)).status).toBe(401);
  expect((await get('/api/summary',ticket!)).status).toBe(401);
 });
 it('validates trusted-root configuration and prevents duplicate source registration',async()=>{
  const create=(body:object)=>request(app).post('/api/libraries').set('Authorization',`Bearer ${admin}`).send(body);
  expect((await create({name:'Unsafe',rootId:'test',relativePath:'../escape'})).status).toBe(400);
  expect((await create({name:'Unknown',rootId:'host',relativePath:''})).status).toBe(400);
  expect((await create({name:'Private',rootId:'test'})).status).toBe(201);
  expect((await create({name:'Duplicate',rootId:'test'})).status).toBe(409);
 });
});

describe('management validation',()=>{
 it('rejects unsafe colors and empty metadata',async()=>{
  expect((await request(app).post('/api/tags').set('Authorization',`Bearer ${admin}`).send({name:'Unsafe',color:'url(example)'})).status).toBe(400);
  expect((await request(app).patch('/api/videos/v0').set('Authorization',`Bearer ${admin}`).send({title:'   '})).status).toBe(400);
 });
 it('rolls back an entire bulk assignment if one selected video is absent',async()=>{
  const before=videoRepo.getById('v0')!.category_id;
  const result=await request(app).patch('/api/videos/bulk').set('Authorization',`Bearer ${admin}`).send({ids:['v0','no-such-video'],categoryId:null});expect(result.status).toBe(404);expect(videoRepo.getById('v0')!.category_id).toBe(before);
 });
});
