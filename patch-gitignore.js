const fs = require('fs');
let content = fs.readFileSync('.gitignore', 'utf8');
content = content.replace('!/data/uploads/\n!/data/uploads/.gitkeep', '!/data/**/.gitkeep\n!/data/uploads/.gitkeep');
fs.writeFileSync('.gitignore', content);
