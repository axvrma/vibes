const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/index.ts');
let code = fs.readFileSync(file, 'utf8');

const log404 = `
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode === 404) {
      fs.appendFileSync(path.join(__dirname, '../../stream-debug.log'), \`[$\{new Date().toISOString()}] 404 NOT FOUND: $\{req.method} $\{req.originalUrl}\\n\`);
    }
  });
  next();
});
`;

// Insert it right after app.use(morgan('dev'));
code = code.replace("app.use(morgan('dev'));", "app.use(morgan('dev'));\n" + log404);

fs.writeFileSync(file, code);
