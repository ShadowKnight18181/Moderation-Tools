const fs = require("fs")
const path = require("path")

const localDataDirectory = path.join(__dirname, "../data")
const dataDirectory =
    process.env.DATA_DIR ||
    (process.env.DATABASE_PATH
        ? path.dirname(process.env.DATABASE_PATH)
        : localDataDirectory)

function getDataPath(filename) {
    return path.join(dataDirectory, filename)
}

function ensureDataDirectory() {
    fs.mkdirSync(dataDirectory, { recursive: true })
}

function ensureJsonFiles(filenames) {
    ensureDataDirectory()

    for (const filename of filenames) {
        const filePath = getDataPath(filename)
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "{}\n")
        }
    }
}

module.exports = {
    dataDirectory,
    ensureDataDirectory,
    ensureJsonFiles,
    getDataPath
}
