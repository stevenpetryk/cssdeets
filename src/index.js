const os = require("node:os")
const path = require("path")
const fg = require("fast-glob")
const { Worker } = require("node:worker_threads")

const numWorkers = os.cpus().length - 1

class WorkerPool {
  constructor() {
    /** @type {any[]} */
    this.workers = []
  }

  async run() {
    for (let i = 0; i < numWorkers; i++) {
      const worker = new Worker(path.join(__dirname, "worker.js"))
      this.workers.push(worker)

      worker.on("message", (message) => {
        if (message.type === "error") {
          console.error(message.error)
        }
      })
    }

    const files = fg.sync(["discord_app/**/*.module.css"], {
      ignore: ["**/node_modules/**"],
      cwd: path.join(__dirname, "../../discord"),
      absolute: true,
    })

    process.stderr.write(
      `Processing ${files.length} files with ${numWorkers} workers\n`
    )

    for (const file of files) {
      const worker = this.workers.pop()
      worker.postMessage({ type: "process", file })
      this.workers.unshift(worker)
    }

    for (const worker of this.workers) {
      worker.postMessage({ type: "exit" })
    }
  }
}

const pool = new WorkerPool()
pool.run()
