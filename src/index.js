const path = require("path")
const fg = require("fast-glob")
const { processFile } = require("./processor")

async function run() {
  const files = fg.stream(
    ["/Users/steven.petryk/src/discord/discord_app/**/*.module.css"],
    {
      ignore: ["**/node_modules/**", "**/dist/**", "**/bazel-discord/**"],
      cwd: path.join(__dirname, "../../discord"),
      absolute: true,
    }
  )
  let numFiles = 0

  const promises = []

  for await (const file of files) {
    promises.push(processFile(file.toString("utf-8")))
    const relPath = path.relative("../discord", file.toString("utf-8"))
    // process.stderr.write(`${relPath}\n`)
    numFiles++
  }

  await Promise.all(promises)

  process.stderr.write(`\nProcessed ${numFiles} files\n`)
}

run()
