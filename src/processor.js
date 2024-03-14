// @ts-check

const fs = require("fs/promises")
const { SourceNode } = require("source-map")
const { parse, Rule } = require("postcss")
const selectorParser = require("postcss-selector-parser")

const CLASSNAME_MATCHER = /\.([a-zA-Z0-9_-]+)/g

/**
 * @param {Rule} rule
 */
function getClassNames(rule) {
  /** @type {any[]} */
  let classNames = []
  /**
   * @type {import('postcss-selector-parser').SyncProcessor<any>}
   */
  const transform = (selectors) => {
    selectors.walkClasses((node) => {
      classNames.push(node)
    })
  }

  selectorParser(transform).processSync(rule.selector)
  return classNames
}

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
    ...rules.flatMap((rule) => {
      const classNames = getClassNames(rule)

      return classNames.flatMap((className) => {
        const before = rule.raws.before ?? ""

        let ruleSource = before + rule.toString()
        ruleSource = ruleSource.replace(/^\n+/gm, "")
        const indentationLevel = ruleSource.match(/^\s*/)?.[0].length ?? 0

        ruleSource = ruleSource
          // Replace lines containing only comments with \n
          .replace(/\s*\/\*.*?\*\/\s*\n/g, "\n")
          // Then replace all remaining comments
          .replace(/\/\*.*?\*\//g, "")
          .split("\n")
          .map((line) => line.slice(indentationLevel))
          .join("\n")

        return [
          "  /**\n",
          "   * ```css\n",
          ruleSource
            .split("\n")
            .map((line) => `   * ${line}`)
            .join("\n") + "\n",
          "   * ```\n",
          "   */\n",
          "export const ",
          new SourceNode(
            rule.source?.start?.line ?? 1,
            (rule.source?.start?.column ?? 1) - 1,
            file,
            className.toString().slice(1)
          ),
          new SourceNode(
            rule.source?.end?.line ?? 1,
            rule.source?.end?.column ?? 0,
            file,
            ""
          ),
          `: string;\n`,
        ]
      })
    }),
  ])

  const dts = file.replace(".module.css", ".module.css.d.ts")
  const dtsMap = file.replace(".module.css", ".module.css.d.ts.map")

  const newSource = rootNode.toStringWithSourceMap({ file: dts })

  await Promise.all([
    fs.writeFile(dts, newSource.code),
    fs.writeFile(dtsMap, newSource.map.toString()),
  ])

  process.stderr.write(`${file}\n`)
}

module.exports = { processFile }
