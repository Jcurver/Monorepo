import fs, { promises as fsAsync } from 'fs'
import path from 'path'
import yaml from 'js-yaml'

// @see https://blog.logrocket.com/alternatives-dirname-node-js-es-modules/
// /!\ __dirname must be recomputed for each file, don't try to move this code
import * as url from 'url'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
//const __filename = url.fileURLToPath(import.meta.url)

const logsDirectory = '.logs'

export const logToFile = async (fileName: string, object: any, options: any = {}) => {
    const { mode = 'append', timestamp = false } = options
    // __dirname = /Users/sacha/Dev/state-of-js-graphql-results-api/dist
    console.log('dirname value in debug.ts', __dirname)
    const path = __dirname.split('/').slice(1, -1).join('/')
    const logsDirPath = `/${path}/${logsDirectory}`
    if (!fs.existsSync(logsDirPath)) {
        fs.mkdirSync(logsDirPath, { recursive: true })
    }
    const fullPath = `${logsDirPath}/${fileName}`
    let contents
    if (typeof object === 'string') {
        contents = object
    } else {
        if (fileName.includes('.yml') || fileName.includes('.yaml')) {
            contents = yaml.dump(object, { noRefs: true, skipInvalid: true })
        } else {
            contents = JSON.stringify(object, null, 2)
        }
    }
    const now = new Date()
    const text = timestamp ? now.toString() + '\n---\n' + contents : contents
    if (mode === 'append') {
        const stream = fs.createWriteStream(fullPath, { flags: 'a' })
        stream.write(text + '\n')
        stream.end()
    } else {
        fs.readFile(fullPath, (error, data) => {
            let shouldWrite = false
            if (error && error.code === 'ENOENT') {
                // the file just does not exist, ok to write
                shouldWrite = true
            } else if (error) {
                // maybe EACCESS or something wrong with the disk
                throw error
            } else {
                const fileContent = data.toString()
                if (fileContent !== text) {
                    shouldWrite = true
                }
            }

            if (shouldWrite) {
                fs.writeFile(fullPath, text, error => {
                    // throws an error, you could also catch it here
                    if (error) throw error

                    // eslint-disable-next-line no-console
                    console.log(`Log saved to ${fullPath}`)
                })
            }
        })
    }
}
