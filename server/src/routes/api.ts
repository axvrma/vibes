import { Router, RequestHandler } from 'express';
import { upload } from '../middleware/upload';
import { videoRepo, tagRepo, stateRepo, categoryRepo, userRepo, _attachDetailsToVideos } from '../db/repository';
import { inspectVideo, generateThumbnail, cleanupFailedProcessing } from '../services/media-processor';
import { AppError } from '../middleware/error-handler';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { randomUUID as uuidv4 } from 'crypto';
import { authenticate, authorizeRoles } from '../middleware/auth';
import * as argon2 from 'argon2';
import { z } from 'zod';
import db from '../db';
import libraries from './libraries';
import { getLibrary } from '../services/media-library';
import { openBeneath } from '../services/media-paths';
import { canViewVideo } from '../services/video-access';
import { issueMediaTicket } from '../services/media-tickets';
import { listVideos } from '../services/video-query';

const router = Router();
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const thumbnailsDir = path.join(dataDir, 'thumbnails');
const trashDir = path.join(dataDir, '.trash');

// Apply authentication to all /api routes except what's handled before (like /api/auth)
router.use(authenticate);
router.use(libraries);

// Admin only middleware
const requireAdmin = authorizeRoles('admin');

router.get('/summary', requireAdmin, (req, res) => {
  const summary = {...videoRepo.getSummary(),
    uploadedVideos:(db.prepare("SELECT count(*) AS n FROM videos WHERE source_type='upload' AND deleted_at IS NULL").get() as {n:number}).n,
    indexedVideos:(db.prepare("SELECT count(*) AS n FROM videos WHERE source_type='external' AND deleted_at IS NULL").get() as {n:number}).n,
    libraries:(db.prepare('SELECT count(*) AS n FROM media_libraries WHERE archived=0').get() as {n:number}).n,
    failedScans:(db.prepare("SELECT count(*) AS n FROM scan_jobs WHERE status IN ('failed','interrupted')").get() as {n:number}).n,
    processingQueue:(db.prepare("SELECT count(*) AS n FROM scan_jobs WHERE status IN ('queued','running')").get() as {n:number}).n,
    recentScans:db.prepare('SELECT s.*,l.name AS library_name FROM scan_jobs s JOIN media_libraries l ON l.id=s.library_id ORDER BY s.created_at DESC LIMIT 5').all(),
    recentAdditions:db.prepare('SELECT id,title,source_type,created_at FROM videos WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5').all()
  };
  res.json(summary);
});

router.get('/videos', (req,res,next)=>{try {res.json(listVideos(req.user!,req.query));}catch(err){next(err);}});

router.post('/videos/:id/media-ticket', async(req,res,next)=>{
 try {
  const video=videoRepo.getById(req.params.id);
  if(!video || !canViewVideo(req.user!,video)) throw new AppError('NOT_FOUND','Video not found',404);
  const kind=z.enum(['stream','thumbnail']).parse(req.body.kind);
  const ticket=await issueMediaTicket(req.user!,video.id,kind);
  res.setHeader('Cache-Control','no-store');
  res.json({url:`/api/videos/${video.id}/${kind}?ticket=${encodeURIComponent(ticket)}`,expiresAt:new Date(Date.now()+600000).toISOString()});
 }catch(err){next(err);}
});

router.post('/upload', requireAdmin, upload.single('video'), async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('MISSING_FILE', 'No video file provided'));
  }

  const uploadFile=req.file;
  const categoryId = typeof req.body.categoryId==='string'&&req.body.categoryId?req.body.categoryId:undefined;

  const id = uuidv4();
  const storageKey = uploadFile.filename;
  const videoPath = uploadFile.path;
  const thumbnailFilename = `${id}.jpg`;
  const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);

  try {
    const title=z.string().trim().min(1).max(300).parse(req.body.title||uploadFile.originalname);
    const tags=z.array(z.string().min(1).max(200)).max(100).parse(req.body.tags?JSON.parse(req.body.tags):[]);
    for(const id of tags)if(!db.prepare('SELECT 1 FROM tags WHERE id=?').get(id))throw new AppError('INVALID_TAG','One of the selected tags does not exist');
    if(categoryId&&!categoryRepo.getById(categoryId))throw new AppError('INVALID_CATEGORY','The selected category does not exist');
    const metadata = await inspectVideo(videoPath);

    // V1 Compatibility check
    if (metadata.containerFormat !== 'mov,mp4,m4a,3gp,3g2,mj2' && !metadata.containerFormat.includes('mp4')) {
       throw new AppError('UNSUPPORTED_FORMAT', 'Only MP4 containers are fully supported in v1');
    }
    if (metadata.codec !== 'h264') {
       throw new AppError('UNSUPPORTED_CODEC', 'Only H.264 video codec is supported in v1');
    }

    await generateThumbnail(videoPath, thumbnailPath);

    const now = new Date().toISOString();
    db.transaction(()=>{videoRepo.create({
      id,
      title,
      original_filename: uploadFile.originalname,
      storage_key: storageKey,
      mime_type: uploadFile.mimetype,
      size_bytes: uploadFile.size,
      duration_seconds: metadata.durationSeconds,
      width: metadata.width,
      height: metadata.height,
      codec: metadata.codec,
      audio_codec: metadata.audioCodec,
      thumbnail_path: thumbnailFilename,
      processing_status: 'ready',
      category_id: categoryId,
      created_at: now,
      updated_at: now
    });

    for(const tagId of tags)tagRepo.attachToVideo(id,tagId);
    })();
    const v=_attachDetailsToVideos([videoRepo.getById(id)!])[0];

    res.status(201).json({
      video: {
        id: v.id,
        title: v.title,
        originalFilename: v.original_filename,
        durationSeconds: v.duration_seconds,
        width: v.width,
        height: v.height,
        codec: v.codec,
        audioCodec: v.audio_codec,
        sizeBytes: v.size_bytes,
        thumbnailUrl: `/api/videos/${v.id}/thumbnail`,
        streamUrl: `/api/videos/${v.id}/stream`,
        category: v.category,
        tags: v.tags,
        updatedAt: v.updated_at
      }
    });
  } catch (err) {
    await cleanupFailedProcessing(videoPath, thumbnailPath);
    next(err);
  }
});

router.get('/videos/:id/thumbnail', (req,res,next)=>{
 const video=videoRepo.getById(req.params.id);
 if(!video || !canViewVideo(req.user!,video) || !video.thumbnail_path) return next(new AppError('NOT_FOUND','Thumbnail not found',404));
 res.setHeader('Cache-Control','private, max-age=300');
 res.setHeader('Referrer-Policy','no-referrer');
 res.sendFile(path.join(thumbnailsDir,path.basename(video.thumbnail_path)),err=>{if(err && !res.headersSent) next(new AppError('NOT_FOUND','Thumbnail unavailable',404));});
});

router.get('/videos/:id/stream', async(req,res,next)=>{
 const video=videoRepo.getById(req.params.id);
 if(!video || !canViewVideo(req.user!,video)) return next(new AppError('NOT_FOUND','Video not found',404));
 let handle:Awaited<ReturnType<typeof fsPromises.open>>|undefined;
 try {
  if(video.source_type==='external') {
   const lib=video.library_id?getLibrary(video.library_id):undefined;
   if(!lib || lib.archived || !video.relative_path) throw new AppError('MEDIA_UNAVAILABLE','Media library is unavailable',404);
   handle=await openBeneath(lib.root_id,[lib.relative_path,video.relative_path].filter(Boolean).join('/'));
  } else handle=await fsPromises.open(path.join(dataDir,'uploads',path.basename(video.storage_key)),'r');
  const stat=await handle.stat(), size=stat.size;
  let start=0,end=size-1,partial=false;
  const range=req.headers.range;
  if(range) {
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match || (!match[1]&&!match[2])) {await handle.close();res.setHeader('Content-Range',`bytes */${size}`);res.status(416).end();return;}
   if(match[1]) {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
   else {start=Math.max(0,size-Number(match[2]));}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start) {await handle.close();res.setHeader('Content-Range',`bytes */${size}`);res.status(416).end();return;}
   partial=true;
  }
  res.set({'Accept-Ranges':'bytes','Content-Type':video.mime_type||'application/octet-stream','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','Content-Length':String(Math.max(0,end-start+1))});
  if(partial) res.set('Content-Range',`bytes ${start}-${end}/${size}`);
  res.status(partial?206:200);
  if(req.method==='HEAD' || size===0) {await handle.close();res.end();return;}
  const stream=handle.createReadStream({start,end,autoClose:true});
  res.on('close',()=>stream.destroy());
  stream.on('error',err=>{if(res.headersSent)res.destroy();else next(err);});
  stream.pipe(res);
 } catch(err) {
  await handle?.close().catch(()=>{});
  next(err instanceof AppError?err:new AppError('MEDIA_UNAVAILABLE','Media file unavailable; reconnect the library or refresh',404));
 }
});

router.delete('/videos/:id', requireAdmin, async (req, res, next) => {
  const videoId = req.params.id;
  const video = videoRepo.getById(videoId);

  if (!video) {
    return res.status(404).json({
      error: { code: 'VIDEO_NOT_FOUND', message: 'Video was not found.' }
    });
  }

  const now = new Date().toISOString();
  try {
    videoRepo.softDelete(videoId, now);
  } catch (err) {
    return next(new AppError('DB_ERROR', 'Failed to delete video record'));
  }

  if (video.source_type === 'external') return res.status(204).send();

  const vPath = path.join(dataDir, 'uploads', video.storage_key);
  const tPath = video.thumbnail_path ? path.join(thumbnailsDir, video.thumbnail_path) : null;
  const videoTrashDir = path.join(trashDir, videoId);

  setImmediate(async () => {
    try {
      await fsPromises.mkdir(videoTrashDir, { recursive: true });
      if (fs.existsSync(vPath)) {
        await fsPromises.rename(vPath, path.join(videoTrashDir, video.storage_key));
      }
      if (tPath && fs.existsSync(tPath)) {
        await fsPromises.rename(tPath, path.join(videoTrashDir, video.thumbnail_path!));
      }
      videoRepo.hardDelete(videoId);
      await fsPromises.rm(videoTrashDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to move video ${videoId} to trash`, e);
    }
  });

  res.status(204).send();
});

const categorySchema=z.object({name:z.string().trim().min(1).max(100),slug:z.string().trim().min(1).max(150).regex(/^[a-z0-9-]+$/),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),icon:z.string().max(100).nullable().optional(),sort_order:z.number().int().min(0).max(100000).optional(),is_active:z.union([z.literal(0),z.literal(1)]).optional()});
const tagSchema=z.object({name:z.string().trim().min(1).max(100),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)});
const validate=(schema:z.ZodType):RequestHandler=>(req,_res,next)=>{try{req.body=schema.parse(req.body);next();}catch(err){next(err);}};

// Categories
router.get('/categories', (req, res) => {
  const includeInactive = req.user?.role === 'admin' && req.query.includeInactive === 'true';
  const categories = categoryRepo.listAll(includeInactive).map(c => ({
    ...c,
    video_count:(db.prepare('SELECT COUNT(DISTINCT v.id) AS count FROM videos v WHERE v.deleted_at IS NULL AND (v.category_id=? OR v.id IN (SELECT vt.video_id FROM video_tags vt JOIN category_tags ct ON vt.tag_id=ct.tag_id WHERE ct.category_id=?))').get(c.id,c.id) as {count:number}).count,
    tags: categoryRepo.getTags(c.id)
  }));
  res.json(categories);
});

router.post('/categories', requireAdmin, validate(categorySchema), (req, res, next) => {
  const { name, slug, color, icon, sort_order, is_active } = req.body;
  if (!name || !slug || !color) return next(new AppError('INVALID_INPUT', 'Name, slug, and color required'));

  const id = uuidv4();
  const now = new Date().toISOString();
  try {
    categoryRepo.create({
      id, name, slug, color, icon,
      sort_order: sort_order || 0,
      is_active: is_active === undefined ? 1 : is_active,
      created_at: now, updated_at: now
    });
    res.status(201).json(categoryRepo.getById(id));
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return next(new AppError('DUPLICATE', 'Category name or slug already exists', 400));
    }
    next(err);
  }
});

router.patch('/categories/:id', requireAdmin, validate(categorySchema.partial()), (req, res, next) => {
  const { name, slug, color, icon, sort_order, is_active } = req.body;
  const now = new Date().toISOString();
  try {
    categoryRepo.update(req.params.id, {
      ...(name !== undefined && { name }),
      ...(slug !== undefined && { slug }),
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      ...(sort_order !== undefined && { sort_order }),
      ...(is_active !== undefined && { is_active }),
      updated_at: now
    });
    res.json(categoryRepo.getById(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id', requireAdmin, (req, res, next) => {
  try {
    const videos = videoRepo.listReadyWithDetails(req.params.id, undefined, false);
    if (videos.length > 0) {
      return next(new AppError('CATEGORY_HAS_VIDEOS', 'Cannot delete category with assigned videos', 400));
    }
    categoryRepo.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Category Tags
router.post('/categories/:id/tags', requireAdmin, (req, res, next) => {
  const { tagId } = req.body;
  if (!tagId) return next(new AppError('INVALID_INPUT', 'TagId required'));
  try {
    categoryRepo.assignTag(req.params.id, tagId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/categories/:id/tags/:tagId', requireAdmin, (req, res, next) => {
  try {
    categoryRepo.removeTag(req.params.id, req.params.tagId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Tags
router.get('/tags', (req, res) => {
  res.json(req.user!.role==='admin'?tagRepo.listAll():db.prepare('SELECT DISTINCT t.* FROM tags t JOIN category_tags ct ON ct.tag_id=t.id JOIN categories c ON c.id=ct.category_id WHERE c.is_active=1 ORDER BY t.name').all());
});

router.post('/tags', requireAdmin, validate(tagSchema), (req, res, next) => {
  const { name, color } = req.body;
  if (!name || !color) return next(new AppError('INVALID_INPUT', 'Name and color required'));

  const id = uuidv4();
  const now = new Date().toISOString();
  try {
    tagRepo.create({ id, name, color, created_at: now });
    res.status(201).json({ id, name, color, created_at: now });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return next(new AppError('DUPLICATE', 'Tag name already exists', 400));
    }
    next(err);
  }
});

router.patch('/tags/:id', requireAdmin, validate(tagSchema.partial()), (req, res, next) => {
  const { name, color } = req.body;
  try {
    tagRepo.update(req.params.id, {
      ...(name !== undefined && { name }),
      ...(color !== undefined && { color })
    });
    res.json(tagRepo.listAll().find(t => t.id === req.params.id));
  } catch (err) {
    next(err);
  }
});

router.delete('/tags/:id', requireAdmin, (req, res, next) => {
  try {
    tagRepo.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Video Tags
router.post('/videos/:id/tags', requireAdmin, (req, res, next) => {
  const { tagId } = req.body;
  if (!tagId) return next(new AppError('INVALID_INPUT', 'TagId required'));

  try {
    const video = videoRepo.getById(req.params.id);
    if (!video) return next(new AppError('NOT_FOUND', 'Video not found', 404));

    tagRepo.attachToVideo(req.params.id, tagId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.delete('/videos/:id/tags/:tagId', requireAdmin, (req, res, next) => {
  try {
    tagRepo.detachFromVideo(req.params.id, req.params.tagId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch('/videos/:id/category',requireAdmin,(req,res,next)=>{
 try{const video=videoRepo.getById(req.params.id);if(!video)throw new AppError('NOT_FOUND','Video not found',404);const data=z.object({categoryId:z.string().nullable(),removeIncompatibleTags:z.boolean().optional()}).parse(req.body);videoRepo.updateCategory(video.id,data.categoryId);res.json({success:true});}catch(err){next(err);}
});
router.patch('/videos/bulk',requireAdmin,(req,res,next)=>{
 try{const data=z.object({ids:z.array(z.string().min(1).max(200)).min(1).max(100),categoryId:z.string().nullable()}).strict().parse(req.body);db.transaction(()=>{for(const id of data.ids){if(!videoRepo.getById(id))throw new AppError('NOT_FOUND','One of the selected videos no longer exists',404);videoRepo.updateCategory(id,data.categoryId);}})();res.json({updated:data.ids.length});}catch(err){next(err);}
});
router.patch('/videos/:id',requireAdmin,(req,res,next)=>{
 try{const video=videoRepo.getById(req.params.id);if(!video)throw new AppError('NOT_FOUND','Video not found',404);const data=z.object({title:z.string().trim().min(1).max(300)}).strict().parse(req.body);db.prepare("UPDATE videos SET title=?,metadata_overridden=1,updated_at=? WHERE id=?").run(data.title,new Date().toISOString(),video.id);res.json({success:true});}catch(err){next(err);}
});

// State
router.get('/videos/:id/state', (req,res,next)=>{
 const video=videoRepo.getById(req.params.id);
 if(!video || !canViewVideo(req.user!,video)) return next(new AppError('NOT_FOUND','Video not found',404));
 res.json(stateRepo.getState(req.user!.id,video.id)||{user_id:req.user!.id,video_id:video.id,liked:0,note:'',progress_seconds:0});
});
router.put('/videos/:id/state',(req,res,next)=>{
 try {
  const video=videoRepo.getById(req.params.id);
  if(!video || !canViewVideo(req.user!,video)) throw new AppError('NOT_FOUND','Video not found',404);
  const patch=z.object({liked:z.boolean().optional(),note:z.string().max(20000).optional(),progress_seconds:z.number().finite().min(0).optional()}).strict().parse(req.body);
  const existing=stateRepo.getState(req.user!.id,video.id);
  stateRepo.upsertState({user_id:req.user!.id,video_id:video.id,liked:patch.liked===undefined?(existing?.liked||0):+patch.liked,note:patch.note??existing?.note??'',progress_seconds:patch.progress_seconds??existing?.progress_seconds??0,updated_at:new Date().toISOString()});
  res.json({success:true});
 }catch(err){next(err);}
});

// Users
router.get('/users', requireAdmin, (req, res) => {
  res.json(userRepo.listAll());
});

router.patch('/users/:id/status', requireAdmin, (req, res, next) => {
  const { is_active } = req.body;
  if (is_active !== 0 && is_active !== 1) {
    return next(new AppError('INVALID_INPUT', 'is_active must be a number (0 or 1)'));
  }

  if (req.user?.id === req.params.id) {
    return next(new AppError('FORBIDDEN', 'Cannot change your own status', 403));
  }

  try {
    userRepo.updateStatus(req.params.id, is_active);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/users/:id', requireAdmin, (req, res, next) => {
  if (req.user?.id === req.params.id) {
    return next(new AppError('FORBIDDEN', 'Cannot delete yourself', 403));
  }
  try {
    userRepo.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/password', requireAdmin, async (req, res, next) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || password.length < 12) {
    return next(new AppError('INVALID_INPUT', 'Password must be at least 12 characters'));
  }

  try {
    const passwordHash = await argon2.hash(password);
    userRepo.updatePassword(req.params.id, passwordHash);
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
