const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/middleware/error-handler.ts');
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "console.error('Error handling request:', err);",
  "console.error('Error handling request:', req.method, req.url, err.statusCode, err.message);"
);

fs.writeFileSync(file, code);
