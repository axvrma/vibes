const db = require('./src/db/index').default;

const videos = db.prepare('SELECT id, category_id FROM videos').all();
console.log("videos:", videos);

const catTags = db.prepare('SELECT * FROM category_tags').all();
console.log("catTags:", catTags);

const tags = db.prepare('SELECT * FROM tags').all();
console.log("tags:", tags);

const videoTags = db.prepare('SELECT * FROM video_tags').all();
console.log("videoTags:", videoTags);
