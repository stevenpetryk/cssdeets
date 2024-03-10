const fs = require("fs/promises")
const path = require("path")
const fg = require("fast-glob")
const { SourceNode } = require("source-map")
const { parse } = require("postcss")

const CLASSNAME_MATCHER = /.([a-zA-Z0-9_-]+)/g

const files = fg.sync(
  path.join(__dirname, "../../discord/discord_app/modules/a*/**/*.module.css")
)

files.map(async (file) => {
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
    `declare const styles: {\n`,
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
})
