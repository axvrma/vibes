const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/routes/api.ts');
let code = fs.readFileSync(file, 'utf8');

const logStatement = `
  const logMsg = \`[$\{new Date().toISOString()}] Stream request for ID: $\{req.params.id} Range: $\{req.headers.range}\\n\`;
  fs.appendFileSync(path.join(__dirname, '../../../stream-debug.log'), logMsg);
`;

code = code.replace(
  "console.log('Stream request for ID:', req.params.id, 'Range:', req.headers.range);",
  logStatement
);

const logVideo = `
  const vidMsg = \`[$\{new Date().toISOString()}] Video found: $\{!!video}\\n\`;
  fs.appendFileSync(path.join(__dirname, '../../../stream-debug.log'), vidMsg);
`;

code = code.replace(
  "console.log('Video found:', !!video);",
  logVideo
);

const logFile = `
  const fileMsg = \`[$\{new Date().toISOString()}] File exists: $\{fs.existsSync(vPath)} $\{vPath}\\n\`;
  fs.appendFileSync(path.join(__dirname, '../../../stream-debug.log'), fileMsg);
`;

code = code.replace(
  "console.log('File exists:', fs.existsSync(vPath), vPath);",
  logFile
);

fs.writeFileSync(file, code);
