const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/routes/api.ts');
let code = fs.readFileSync(file, 'utf8');

const logStatement = `
  console.log('Stream request for ID:', req.params.id, 'Range:', req.headers.range);
`;

code = code.replace(
  "const video = videoRepo.getById(req.params.id);",
  logStatement + "\n  const video = videoRepo.getById(req.params.id);\n  console.log('Video found:', !!video);"
);

code = code.replace(
  "if (!fs.existsSync(vPath)) {",
  "console.log('File exists:', fs.existsSync(vPath), vPath);\n  if (!fs.existsSync(vPath)) {"
);

fs.writeFileSync(file, code);
