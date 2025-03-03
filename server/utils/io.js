const fs = require('fs').promises;
const fsSync = require('fs');
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

/**
 * 파일 읽기
 * @param {string} filePath - 파일 경로
 * @param {string} [encoding='utf8'] - 인코딩
 * @returns {Promise<string|Buffer>}
 */
async function readFile(filePath, encoding = 'utf8') {
    return await fs.readFile(filePath, encoding);
}

/**
 * 파일 쓰기
 * @param {string} filePath - 파일 경로
 * @param {string|Buffer} data - 쓸 데이터
 * @param {string} [encoding='utf8'] - 인코딩
 */
async function writeFile(filePath, data, encoding = 'utf8') {
    await fs.writeFile(filePath, data, encoding);
}

/**
 * 파일 복사
 * @param {string} src - 원본 파일 경로
 * @param {string} dest - 대상 파일 경로
 */
async function copyFile(src, dest) {
    await fs.copyFile(src, dest);
}

/**
 * 디렉토리 내용 읽기
 * @param {string} dir - 디렉토리 경로
 * @returns {Promise<string[]>}
 */
async function readDir(dir) {
    return await fs.readdir(dir);
}

/**
 * 파일 크기 확인 (동기 버전)
 * @param {string} filePath - 파일 경로
 * @returns {number} 파일 크기 (bytes)
 */
function getFileSizeSync(filePath) {
    try {
        const stats = fsSync.statSync(filePath);
        return stats.size;
    } catch {
        return 0;
    }
}

/**
 * 파일 정보 가져오기
 * @param {string} filePath - 파일 경로
 * @returns {Promise<fs.Stats>}
 */
async function getFileStats(filePath) {
    return await fs.stat(filePath);
}

/**
 * 경로가 디렉토리인지 확인
 * @param {string} path - 확인할 경로
 * @returns {Promise<boolean>}
 */
async function isDirectory(path) {
    try {
        const stats = await fs.stat(path);
        return stats.isDirectory();
    } catch {
        return false;
    }
}

/**
 * 파일 확장자 가져오기
 * @param {string} filePath - 파일 경로
 * @returns {string} 확장자 (점 포함)
 */
function getExtension(filePath) {
    return path.extname(filePath);
}

module.exports = {
    exists,
    ensureDir,
    removeFile,
    readFile,
    writeFile,
    copyFile,
    readDir,
    getFileSizeSync,
    getFileStats,
    isDirectory,
    getExtension
}; 