"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '127.0.0.1';
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// Ensure data directories exist
const dataDir = process.env.DATA_DIR || path_1.default.join(__dirname, '../../data');
const uploadsDir = path_1.default.join(dataDir, 'uploads');
const thumbnailsDir = path_1.default.join(dataDir, 'thumbnails');
const trashDir = path_1.default.join(dataDir, '.trash');
[uploadsDir, thumbnailsDir, trashDir].forEach((dir) => {
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
});
