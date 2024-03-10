const fs = require("fs/promises")
const { SourceNode } = require("source-map")
const { parse } = require("postcss")
const { parentPort } = require("node:worker_threads")

const CLASSNAME_MATCHER = /.([a-zA-Z0-9_-]+)/g

/**
 * @param {string} file
 */
async function processFile(file) {
  const content = await fs.readFile(file, "utf-8")

  /** @type {import('postcss').Rule[]} */
  const rules = []

  parse(content).walkRules((rule) => {
    const matches = rule.selector.match(CLASSNAME_MATCHER)

    if (matches) {
      rules.push(rule)
    }
  })

  const rootNode = new SourceNode(1, 0, null, [
    "// prettier-ignore\n",
    "/* eslint-disable */\n",
    "declare const styles: {\n",
    ...rules.flatMap((rule) => {
      const matches = rule.selector.match(CLASSNAME_MATCHER)

      if (matches) {
        return matches.flatMap((match) => {
          return [
            '  "',
            new SourceNode(
              rule.source?.start?.line ?? 1,
              (rule.source?.start?.column ?? 1) - 1,
              file,
              match.slice(1)
            ),
            new SourceNode(
              rule.source?.end?.line ?? 1,
              rule.source?.end?.column ?? 0,
              file,
              ""
            ),
            `\": string;\n`,
          ]
        })
      } else {
        return []
      }
    }),
    `};\n`,
    `export default styles;`,
  ])

  const dts = file.replace(".module.css", ".module.css.d.ts")
  const dtsMap = file.replace(".module.css", ".module.css.d.ts.map")

  const newSource = rootNode.toStringWithSourceMap({ file: dts })

  await fs.writeFile(dts, newSource.code)
  await fs.writeFile(dtsMap, newSource.map.toString())
}

if (!parentPort) {
  throw new Error("This module must be run as a worker")
}

parentPort.on("message", async (message) => {
  if (message.type === "process") {
    try {
      await processFile(message.file)
      parentPort?.postMessage({ type: "done", fileProcessed: message.file })
    } catch (error) {
      parentPort?.postMessage({ type: "error", error })
    }
  }

  if (message.type === "exit") {
    parentPort?.unref()
  }
})
