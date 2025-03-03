const fs = require('fs').promises;
const path = require('path');

/**
 * 파일 또는 디렉토리 존재 여부 확인
 * @param {string} path - 확인할 경로
 * @returns {Promise<boolean>}
 */
async function exists(path) {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * 디렉토리 생성 (없는 경우)
 * @param {string} dir - 생성할 디렉토리 경로
 */
async function ensureDir(dir) {
    if (!(await exists(dir))) {
        await fs.mkdir(dir, { recursive: true });
    }
}

/**
 * 파일 삭제 (존재하는 경우)
 * @param {string} filePath - 삭제할 파일 경로
 */
async function removeFile(filePath) {
    if (await exists(filePath)) {
        await fs.unlink(filePath);
    }
}

module.exports = {
    exists,
    ensureDir,
    removeFile
}; 